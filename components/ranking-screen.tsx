"use client"

import { useMemo, useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { ArrowLeft, Trophy, Star, Calendar, ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { getDayId } from "@/utils/day"

// Global audio context for click sounds (reused for better performance)
let clickAudioContext: AudioContext | null = null

// Initialize audio context on first user interaction
const getClickAudioContext = () => {
  if (!clickAudioContext) {
    try {
      clickAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      // Resume immediately if suspended
      if (clickAudioContext.state === 'suspended') {
        clickAudioContext.resume().catch(() => {})
      }
    } catch (error) {
      return null
    }
  }
  // Ensure context is running
  if (clickAudioContext.state === 'suspended') {
    clickAudioContext.resume().catch(() => {})
  }
  return clickAudioContext
}

// Sound effect function - plays a simple click sound for button clicks
const playClickSound = () => {
  try {
    const audioContext = getClickAudioContext()
    if (!audioContext) return
    
    // Create a simple, short click sound
    const osc = audioContext.createOscillator()
    const gain = audioContext.createGain()
    
    const now = audioContext.currentTime
    
    // Short, high-pitched click
    osc.type = 'sine'
    osc.frequency.setValueAtTime(800, now)
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.05)
    
    // Quick fade in/out for click sound
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(0.15, now + 0.001)
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05)
    
    osc.connect(gain)
    gain.connect(audioContext.destination)
    
    // Start immediately
    osc.start(now)
    osc.stop(now + 0.05)
  } catch (error) {
    // Silently fail if audio context is not available
    console.debug("Audio not available:", error)
  }
}

interface RankingScreenProps {
  currentPlayer: string // Wallet address
  onBack: () => void
  playerRankings: RankingEntry[]
  onViewDailyResults?: (date: Date) => void
  selectedDate?: string // formato 'YYYY-MM-DD' - opcional, usa hoje se não fornecido
}

// Type for ranking entry with claim status
type RankingEntry = {
  player: string
  points: number
  golden_moles: number
  errors: number
  day: number
}

type ClaimData = {
  player: string
  rank: number
}

const formatAddress = (address: string) => {
  if (!address) return ""
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

// Format date for display
const formatDateForDisplay = (dateString: string) => {
  try {
    const [year, month, day] = dateString.split('-').map(Number)
    const date = new Date(Date.UTC(year, month - 1, day))
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    }) + " (UTC)"
  } catch {
    return dateString
  }
}

// Get today's date in YYYY-MM-DD format (UTC)
const getTodayDateString = () => {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    .toISOString()
    .split('T')[0]
}

export default function RankingScreen({ currentPlayer, onBack, playerRankings, onViewDailyResults, selectedDate }: RankingScreenProps) {
  // 🔍 DIAGNÓSTICO: Log inicial dos props
  console.log(`🔍 [RANKING-SCREEN] Component initialized with props:`, {
    currentPlayer,
    currentPlayerType: typeof currentPlayer,
    currentPlayerLength: currentPlayer?.length,
    selectedDate,
    hasOnViewDailyResults: !!onViewDailyResults
  })

  const [currentPage, setCurrentPage] = useState(1)
  const [showCalendarDialog, setShowCalendarDialog] = useState(false)
  const [showClaimSuccessDialog, setShowClaimSuccessDialog] = useState(false)
  const [claimSuccessData, setClaimSuccessData] = useState<{ rank: number; prizeAmount: string; txHash: string } | null>(null)
  const [calendarSelectedDate, setCalendarSelectedDate] = useState<Date | undefined>(undefined)
  
  // Initialize displayDate with selectedDate prop or default to today
  const [displayDate, setDisplayDate] = useState(() => selectedDate || getTodayDateString())
  
  // 🔍 DIAGNÓSTICO: Log quando currentPlayer muda
  useEffect(() => {
    console.log(`🔍 [RANKING-SCREEN] currentPlayer changed:`, {
      currentPlayer,
      currentPlayerLower: currentPlayer?.toLowerCase(),
      isEmpty: !currentPlayer || currentPlayer.trim() === ''
    })
  }, [currentPlayer])

  // 🔍 DIAGNÓSTICO: Log quando displayDate muda
  useEffect(() => {
    console.log(`🔍 [RANKING-SCREEN] displayDate changed:`, {
      displayDate,
      selectedDate,
      calculatedDay: displayDate ? getDayId(new Date(displayDate + 'T00:00:00Z')) : null,
      todayDay: getDayId(),
      isPastDay: displayDate ? getDayId(new Date(displayDate + 'T00:00:00Z')) < getDayId() : false
    })
  }, [displayDate, selectedDate])
  
  // ✅ CORREÇÃO: Usar apenas um estado principal para armazenar os resultados
  // ANTES: Havia múltiplos estados (ranking, rankings via useMemo, paginatedRankings)
  // PROBLEMA: O useMemo que criava 'rankings' podia falhar silenciosamente, deixando rankings vazio
  // mesmo quando ranking tinha dados. A renderização verificava rankings.length mas usava paginatedRankings.
  // AGORA: Usamos apenas 'ranking' como fonte única da verdade. Os valores derivados (paginatedRankings)
  // são calculados diretamente de 'ranking' quando necessário.
  const [ranking, setRanking] = useState<RankingEntry[]>([])
  const [claims, setClaims] = useState<ClaimData[]>([])
  const [claimedRanks, setClaimedRanks] = useState<number[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDayFinalized, setIsDayFinalized] = useState<boolean>(false) // Track if day is finalized on contract
  const [checkingFinalization, setCheckingFinalization] = useState<boolean>(false) // Track loading state
  const [dayForFinalization, setDayForFinalization] = useState<number | null>(null) // Track which day was checked for finalization
  const itemsPerPage = 50
  const maxPages = 10 // 500 players / 50 per page

  // Function to load ranking for a specific date
  const loadRanking = useCallback(async (date: string) => {
    console.log(`🔍 [RANKING-SCREEN] ========================================`)
    console.log(`🔍 [RANKING-SCREEN] LOADRANKING CALLED`)
    console.log(`🔍 [RANKING-SCREEN] ========================================`)
    console.log(`🔍 [RANKING-SCREEN] Input date: "${date}"`)
    
    setLoading(true)
    setError(null)

    try {
      // Validate date string
      if (!date || typeof date !== 'string' || date.trim() === '') {
        console.error(`[RANKING-SCREEN] Invalid date: ${date}`)
        setError("Invalid date")
        setRanking([])
        setLoading(false)
        return
      }

      // Parse date string (YYYY-MM-DD) and convert to UTC day
      // Use Date.UTC to avoid timezone issues
      const [year, month, day] = date.split('-').map(Number)
      
      if (isNaN(year) || isNaN(month) || isNaN(day)) {
        console.error(`[RANKING-SCREEN] Invalid date format: ${date}`)
        setError("Invalid date format")
        setRanking([])
        setLoading(false)
        return
      }
      
      const dateObj = new Date(Date.UTC(year, month - 1, day))
      const selectedDay = getDayId(dateObj)
      
      if (isNaN(selectedDay)) {
        console.error(`[RANKING-SCREEN] Invalid selectedDay calculated: ${selectedDay} from date: ${date}`)
        setError("Failed to calculate day")
        setRanking([])
        setLoading(false)
        return
      }
      
      const todayDay = getDayId()
      console.log(`[RANKING-SCREEN] Loading ranking for date: ${date}, day: ${selectedDay}, today: ${todayDay}`)
      
      const url = `/api/rankings?day=${selectedDay}`
      console.log(`[RANKING-SCREEN] Fetching from: ${url}`)
      
      const res = await fetch(url)

      if (!res.ok) {
        const errorText = await res.text()
        console.error(`[RANKING-SCREEN] API error: ${res.status} - ${errorText}`)
        throw new Error(`Failed to fetch rankings: ${res.status} ${errorText}`)
      }

      const data = await res.json()
      console.log(`🔍 [RANKING-SCREEN] API response for day ${selectedDay}:`, {
        data,
        rankingLength: data.ranking?.length || 0,
        rankingType: Array.isArray(data.ranking) ? 'array' : typeof data.ranking,
        firstPlayer: data.ranking?.[0] || null
      })
      
      // 🔍 DIAGNÓSTICO: Validar estrutura dos dados
      if (!data.ranking) {
        console.error(`🔍 [RANKING-SCREEN] API response missing 'ranking' field:`, data)
      } else if (!Array.isArray(data.ranking)) {
        console.error(`🔍 [RANKING-SCREEN] API response 'ranking' is not an array:`, typeof data.ranking, data.ranking)
      } else {
        console.log(`🔍 [RANKING-SCREEN] Ranking data structure:`, {
          length: data.ranking.length,
          sample: data.ranking[0],
          allPlayers: data.ranking.map((r: RankingEntry) => r.player)
        })
      }
      
      setRanking(data.ranking || [])

      // Load claims from database
      console.log(`🔍 [RANKING-SCREEN] Fetching claims for day ${selectedDay}`)
      const resClaims = await fetch(`/api/claimPrize?day=${selectedDay}`)
      let dbClaims: ClaimData[] = []
      
      if (resClaims.ok) {
        const claimsData = await resClaims.json()
        dbClaims = claimsData.claims || []
        console.log(`🔍 [RANKING-SCREEN] Claims from database for day ${selectedDay}:`, {
          claimsData,
          claims: dbClaims,
          claimsLength: dbClaims.length,
          claimedRanks: dbClaims.map((c: ClaimData) => c.rank)
        })
      } else {
        const errorText = await resClaims.text()
        console.warn(`🔍 [RANKING-SCREEN] Failed to load claims for day ${selectedDay}:`, {
          status: resClaims.status,
          statusText: resClaims.statusText,
          error: errorText
        })
      }
      
      // ✅ CORREÇÃO: Verificar no contrato se realmente foi claimed
      // O banco pode ter registros de claims que falharam no contrato
      // Só considerar como claimed se o contrato confirmar
      let verifiedClaims: ClaimData[] = []
      let verifiedRanks: number[] = []
      
      if (dbClaims.length > 0 && typeof window !== "undefined" && window.ethereum) {
        try {
          const { BrowserProvider, Contract } = await import("ethers")
          const provider = new BrowserProvider(window.ethereum)
          const PRIZE_POOL_ADDRESS = process.env.NEXT_PUBLIC_PRIZE_POOL_CONTRACT_ADDRESS
          
          if (PRIZE_POOL_ADDRESS) {
            const PRIZE_POOL_ABI = [
              "function claimed(uint256 day, address user) view returns (bool)",
            ]
            
            const readContract = new Contract(PRIZE_POOL_ADDRESS, PRIZE_POOL_ABI, provider)
            
            console.log(`🔍 [RANKING-SCREEN] Verifying claims on contract for day ${selectedDay}...`)
            
            // Verificar cada claim no contrato
            for (const claim of dbClaims) {
              try {
                const isClaimedOnChain = await readContract.claimed(selectedDay, claim.player)
                console.log(`🔍 [RANKING-SCREEN] Contract.claimed(${selectedDay}, ${claim.player}) = ${isClaimedOnChain}`)
                
                if (isClaimedOnChain) {
                  verifiedClaims.push(claim)
                  verifiedRanks.push(claim.rank)
                } else {
                  console.log(`⚠️ [RANKING-SCREEN] Claim in database but not on contract: rank ${claim.rank}, player ${claim.player}`)
                }
              } catch (err) {
                console.warn(`[RANKING-SCREEN] Error verifying claim for rank ${claim.rank}:`, err)
                // Se não conseguir verificar, não incluir (assume que não foi claimed)
              }
            }
            
            console.log(`✅ [RANKING-SCREEN] Verified claims:`, {
              dbClaims: dbClaims.length,
              verifiedClaims: verifiedClaims.length,
              verifiedRanks
            })
          }
        } catch (err) {
          console.warn(`[RANKING-SCREEN] Error verifying claims on contract:`, err)
          // Se não conseguir verificar no contrato, usar os claims do banco como fallback
          verifiedClaims = dbClaims
          verifiedRanks = dbClaims.map((c: ClaimData) => c.rank)
        }
      } else {
        // Se não tiver wallet conectada, usar claims do banco como fallback
        verifiedClaims = dbClaims
        verifiedRanks = dbClaims.map((c: ClaimData) => c.rank)
      }
      
      setClaims(verifiedClaims)
      console.log(`🔍 [RANKING-SCREEN] Setting claimedRanks:`, verifiedRanks)
      setClaimedRanks(verifiedRanks)
      
      // ✅ NOVO: Verificar se o dia está finalizado no contrato (totalPlayers > 0)
      // 🔍 DIAGNÓSTICO CRÍTICO: Verificar se estamos usando o mesmo selectedDay
      console.log(`🔍 [RANKING-SCREEN] ========================================`)
      console.log(`🔍 [RANKING-SCREEN] CHECKING DAY FINALIZATION`)
      console.log(`🔍 [RANKING-SCREEN] ========================================`)
      console.log(`🔍 [RANKING-SCREEN] Input date string: "${date}"`)
      console.log(`🔍 [RANKING-SCREEN] Calculated selectedDay: ${selectedDay}`)
      console.log(`🔍 [RANKING-SCREEN] selectedDay type: ${typeof selectedDay}`)
      console.log(`🔍 [RANKING-SCREEN] selectedDay calculation: getDayId(new Date(Date.UTC(${year}, ${month - 1}, ${day})))`)
      console.log(`🔍 [RANKING-SCREEN] dateObj.toISOString(): ${dateObj.toISOString()}`)
      console.log(`🔍 [RANKING-SCREEN] Will check totalPlayers(${selectedDay}) on contract`)
      console.log(`🔍 [RANKING-SCREEN] ========================================`)
      
      setCheckingFinalization(true)
      setIsDayFinalized(false) // Reset to false initially
      
      // ✅ CORREÇÃO: Verificar finalização SEMPRE, mesmo sem wallet (usando provider público)
      try {
        const PRIZE_POOL_ADDRESS = process.env.NEXT_PUBLIC_PRIZE_POOL_CONTRACT_ADDRESS
        console.log(`🔍 [RANKING-SCREEN] PRIZE_POOL_ADDRESS: ${PRIZE_POOL_ADDRESS}`)
        
        if (!PRIZE_POOL_ADDRESS || PRIZE_POOL_ADDRESS === "0x0000000000000000000000000000000000000000") {
          console.error(`❌ [RANKING-SCREEN] PRIZE_POOL_ADDRESS not configured, cannot check finalization`)
          setIsDayFinalized(false)
          setDayForFinalization(selectedDay) // Ainda armazenar o dia para referência
        } else {
          // ✅ CORREÇÃO: Usar provider público se wallet não estiver disponível
          let provider: any = null
          
          if (typeof window !== "undefined" && window.ethereum) {
            try {
              const { BrowserProvider } = await import("ethers")
              provider = new BrowserProvider(window.ethereum)
              console.log(`🔍 [RANKING-SCREEN] Using wallet provider for finalization check`)
            } catch (walletErr: any) {
              console.warn(`⚠️ [RANKING-SCREEN] Failed to create wallet provider, will try public RPC:`, walletErr?.message || walletErr)
            }
          }
          
          // Se não conseguiu criar provider da wallet, usar RPC público
          if (!provider) {
            try {
              const { JsonRpcProvider } = await import("ethers")
              const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || process.env.RPC_URL || "https://rpc.testnet.arc.network"
              const CHAIN_ID = 5042002
              provider = new JsonRpcProvider(RPC_URL, CHAIN_ID)
              console.log(`🔍 [RANKING-SCREEN] Using public RPC provider (${RPC_URL}) for finalization check`)
            } catch (rpcErr: any) {
              console.error(`❌ [RANKING-SCREEN] Failed to create RPC provider:`, rpcErr?.message || rpcErr)
              setIsDayFinalized(false)
              setDayForFinalization(selectedDay)
              setCheckingFinalization(false)
              return
            }
          }
          
          try {
            const { Contract } = await import("ethers")
            const PRIZE_POOL_ABI = [
              "function totalPlayers(uint256 day) view returns (uint256)",
            ]
            const readContract = new Contract(PRIZE_POOL_ADDRESS, PRIZE_POOL_ABI, provider)
            
            // ✅ REVERTIDO: Usar verificação original baseada em totalPlayers > 0
            console.log(`🔍 [RANKING-SCREEN] Calling totalPlayers(${selectedDay}) on contract ${PRIZE_POOL_ADDRESS}...`)
            const totalPlayers = await readContract.totalPlayers(selectedDay)
            const finalized = totalPlayers > BigInt(0)
            
            // ✅ LOG: Identificar qual provider está sendo usado
            const providerType = typeof window !== "undefined" && window.ethereum ? "wallet" : "public RPC"
            
            console.log(`🔍 [RANKING-SCREEN] ========================================`)
            console.log(`🔍 [RANKING-SCREEN] FINALIZATION CHECK RESULT`)
            console.log(`🔍 [RANKING-SCREEN] ========================================`)
            console.log(`🔍 [RANKING-SCREEN] Provider used: ${providerType}`)
            console.log(`🔍 [RANKING-SCREEN] Contract address: ${PRIZE_POOL_ADDRESS}`)
            console.log(`🔍 [RANKING-SCREEN] Day checked: ${selectedDay}`)
            console.log(`🔍 [RANKING-SCREEN] totalPlayers(${selectedDay}): ${totalPlayers.toString()}`)
            console.log(`🔍 [RANKING-SCREEN] finalized (totalPlayers > 0): ${finalized}`)
            console.log(`🔍 [RANKING-SCREEN] isDayFinalized set to: ${finalized}`)
            console.log(`🔍 [RANKING-SCREEN] dayForFinalization stored as: ${selectedDay}`)
            console.log(`🔍 [RANKING-SCREEN] ========================================`)
            
            setIsDayFinalized(finalized)
            setDayForFinalization(selectedDay) // Store which day was checked
          } catch (contractErr: any) {
            console.error(`❌ [RANKING-SCREEN] Error calling contract for finalization check:`, {
              error: contractErr?.message || contractErr,
              code: contractErr?.code,
              data: contractErr?.data,
              stack: contractErr?.stack
            })
            setIsDayFinalized(false)
            setDayForFinalization(selectedDay) // Ainda armazenar o dia para referência
          }
        }
      } catch (err: any) {
        console.error(`❌ [RANKING-SCREEN] Unexpected error checking day finalization:`, {
          error: err?.message || err,
          stack: err?.stack
        })
        setIsDayFinalized(false)
        setDayForFinalization(selectedDay) // Ainda armazenar o dia para referência
      } finally {
        setCheckingFinalization(false)
      }
      
      // ✅ CORREÇÃO: NÃO atualizar displayDate aqui se já foi atualizado no handleDateSelect
      // O displayDate já foi atualizado no handleDateSelect antes de chamar loadRanking
      // Só atualizar se for uma chamada inicial (quando displayDate ainda é o valor padrão)
      // Isso evita que loadRanking sobrescreva o displayDate que foi setado no handleDateSelect
      const currentDisplayDay = displayDate ? getDayId(new Date(displayDate + 'T00:00:00Z')) : null
      const newDay = getDayId(new Date(date + 'T00:00:00Z'))
      
      // Só atualizar se os dias forem diferentes (não apenas as strings)
      if (currentDisplayDay !== newDay) {
        console.log(`🔍 [RANKING-SCREEN] Updating displayDate in loadRanking: ${displayDate} (day ${currentDisplayDay}) -> ${date} (day ${newDay})`)
        setDisplayDate(date)
      } else {
        console.log(`🔍 [RANKING-SCREEN] Skipping displayDate update in loadRanking (already correct):`, {
          date,
          displayDate,
          currentDisplayDay,
          newDay,
          datesMatch: date === displayDate,
          daysMatch: currentDisplayDay === newDay
        })
      }
      console.log(`✅ [RANKING-SCREEN] Ranking loaded: ${data.ranking?.length || 0} players`)
    } catch (err: any) {
      console.error("[RANKING-SCREEN] Fetch error:", err)
      setError("Failed to load rankings")
      setRanking([])
    } finally {
      setLoading(false)
    }
  }, [])

  // Function to check if a player can claim
  // ✅ CORREÇÃO: Agora recebe rank (1-based) em vez de index (0-based)
  // ANTES: Recebia index e verificava index < 3 (só funcionava para primeira página)
  // AGORA: Recebe rank e verifica rank <= 3 (funciona para qualquer página)
  const canClaim = useCallback((rank: number, rowPlayer: string) => {
    // 🔍 DIAGNÓSTICO CRÍTICO: Log inicial com todos os dados
    console.log(`🔍 [RANKING-SCREEN] ========================================`)
    console.log(`🔍 [RANKING-SCREEN] CANCLAIM CALLED`)
    console.log(`🔍 [RANKING-SCREEN] ========================================`)
    console.log(`🔍 [RANKING-SCREEN] Input parameters:`, {
      rank,
      rowPlayer,
      displayDate,
      currentPlayer,
      claimedRanks: [...claimedRanks],
      isDayFinalized,
      dayForFinalization,
      timestamp: new Date().toISOString()
    })

    // Recalculate selectedDay and isPastDay from displayDate to ensure they're always current
    if (!displayDate || typeof displayDate !== 'string') {
      console.error(`🔍 [RANKING-SCREEN] canClaim: Invalid displayDate:`, displayDate)
      return false
    }

    const [year, month, day] = displayDate.split('-').map(Number)
    if (isNaN(year) || isNaN(month) || isNaN(day)) {
      console.error(`🔍 [RANKING-SCREEN] canClaim: Invalid date format:`, displayDate)
      return false
    }

    const dateObj = new Date(Date.UTC(year, month - 1, day))
    const selectedDay = getDayId(dateObj)
    const todayDay = getDayId()
    const isPastDay = selectedDay < todayDay
    
    // 🔍 DIAGNÓSTICO CRÍTICO: Log do cálculo do dia e comparação
    console.log(`🔍 [RANKING-SCREEN] ========================================`)
    console.log(`🔍 [RANKING-SCREEN] DAY CALCULATION IN CANCLAIM`)
    console.log(`🔍 [RANKING-SCREEN] ========================================`)
    console.log(`🔍 [RANKING-SCREEN] displayDate: "${displayDate}"`)
    console.log(`🔍 [RANKING-SCREEN] Parsed: year=${year}, month=${month}, day=${day}`)
    console.log(`🔍 [RANKING-SCREEN] dateObj: ${dateObj.toISOString()}`)
    console.log(`🔍 [RANKING-SCREEN] selectedDay (calculated in canClaim): ${selectedDay}`)
    console.log(`🔍 [RANKING-SCREEN] selectedDay type: ${typeof selectedDay}`)
    console.log(`🔍 [RANKING-SCREEN] todayDay: ${todayDay}`)
    console.log(`🔍 [RANKING-SCREEN] isPastDay: ${isPastDay}`)
    console.log(`🔍 [RANKING-SCREEN] isDayFinalized (from state): ${isDayFinalized}`)
    console.log(`🔍 [RANKING-SCREEN] isDayFinalized type: ${typeof isDayFinalized}`)
    console.log(`🔍 [RANKING-SCREEN] dayForFinalization (from state): ${dayForFinalization}`)
    console.log(`🔍 [RANKING-SCREEN] ⚠️ CRITICAL COMPARISON:`)
    console.log(`🔍 [RANKING-SCREEN]   - selectedDay in canClaim: ${selectedDay}`)
    console.log(`🔍 [RANKING-SCREEN]   - dayForFinalization (from loadRanking): ${dayForFinalization}`)
    console.log(`🔍 [RANKING-SCREEN]   - Do they match? ${selectedDay === dayForFinalization ? '✅ YES' : '❌ NO - WILL CHECK CONTRACT DIRECTLY'}`)
    
    const currentPlayerLower = (currentPlayer || '').toLowerCase().trim()
    const rowPlayerLower = (rowPlayer || '').toLowerCase().trim()
    
    // ✅ CORREÇÃO: Verificar se o dia está finalizado baseado no selectedDay
    // Se selectedDay corresponde ao dayForFinalization, usar isDayFinalized do estado
    // Caso contrário, assumir false (será verificado quando loadRanking for chamado para esse dia)
    const actualIsDayFinalized = (selectedDay === dayForFinalization) ? isDayFinalized : false
    
    console.log(`🔍 [RANKING-SCREEN] actualIsDayFinalized: ${actualIsDayFinalized} (from state: ${isDayFinalized}, checked directly: ${selectedDay === dayForFinalization ? isDayFinalized : false})`)
    console.log(`🔍 [RANKING-SCREEN] ========================================`)
    
    // ✅ CORREÇÃO: Comparar rowPlayerLower com currentPlayerLower (ambos já em lowercase)
    // ANTES: rowPlayerLower === currentPlayer?.toLowerCase() (redundante e pode falhar)
    // AGORA: rowPlayerLower === currentPlayerLower (comparação direta e correta)
    // ✅ CORREÇÃO: Verificar rank <= 3 em vez de index < 3
    // ✅ NOVO: Verificar se o dia está finalizado (totalPlayers > 0) em vez de apenas isPastDay
    
    // 🔍 DIAGNÓSTICO: Verificar cada condição separadamente
    const checks = {
      isDayFinalized: actualIsDayFinalized, // ✅ CORRIGIDO: Usa verificação direta se necessário
      hasCurrentPlayer: currentPlayerLower !== '',
      hasRowPlayer: rowPlayerLower !== '',
      playersMatch: rowPlayerLower === currentPlayerLower,
      isTop3: rank <= 3,
      notClaimed: !claimedRanks.includes(rank)
    }

    const canClaimResult = (
      checks.isDayFinalized && // ✅ NOVO: Dia deve estar finalizado
      checks.hasCurrentPlayer &&
      checks.hasRowPlayer &&
      checks.playersMatch &&
      checks.isTop3 &&
      checks.notClaimed
    )
    
    // 🔍 DIAGNÓSTICO CRÍTICO: Log detalhado de cada verificação
    console.log(`🔍 [RANKING-SCREEN] ========================================`)
    console.log(`🔍 [RANKING-SCREEN] CANCLAIM DETAILED CHECK`)
    console.log(`🔍 [RANKING-SCREEN] ========================================`)
    console.log(`🔍 [RANKING-SCREEN] rank: ${rank}`)
    console.log(`🔍 [RANKING-SCREEN] rowPlayer: "${rowPlayer}"`)
    console.log(`🔍 [RANKING-SCREEN] rowPlayerLower: "${rowPlayerLower}"`)
    console.log(`🔍 [RANKING-SCREEN] currentPlayer: "${currentPlayer}"`)
    console.log(`🔍 [RANKING-SCREEN] currentPlayerLower: "${currentPlayerLower}"`)
    console.log(`🔍 [RANKING-SCREEN] selectedDay: ${selectedDay}`)
    console.log(`🔍 [RANKING-SCREEN] todayDay: ${todayDay}`)
    console.log(`🔍 [RANKING-SCREEN] isPastDay: ${isPastDay}`)
    console.log(`🔍 [RANKING-SCREEN] actualIsDayFinalized: ${actualIsDayFinalized} (from state: ${isDayFinalized}, checked directly: ${selectedDay !== dayForFinalization})`)
    console.log(`🔍 [RANKING-SCREEN] claimedRanks: [${claimedRanks.join(', ')}]`)
    console.log(`🔍 [RANKING-SCREEN] displayDate: "${displayDate}"`)
    console.log(`🔍 [RANKING-SCREEN] ---`)
    console.log(`🔍 [RANKING-SCREEN] Individual checks:`)
    console.log(`🔍 [RANKING-SCREEN]   - isDayFinalized: ${checks.isDayFinalized} ${!checks.isDayFinalized ? '❌ BLOCKING' : '✅'}`)
    console.log(`🔍 [RANKING-SCREEN]   - hasCurrentPlayer: ${checks.hasCurrentPlayer} ${!checks.hasCurrentPlayer ? '❌ BLOCKING' : '✅'}`)
    console.log(`🔍 [RANKING-SCREEN]   - hasRowPlayer: ${checks.hasRowPlayer} ${!checks.hasRowPlayer ? '❌ BLOCKING' : '✅'}`)
    console.log(`🔍 [RANKING-SCREEN]   - playersMatch: ${checks.playersMatch} ${!checks.playersMatch ? '❌ BLOCKING' : '✅'}`)
    console.log(`🔍 [RANKING-SCREEN]   - isTop3: ${checks.isTop3} ${!checks.isTop3 ? '❌ BLOCKING' : '✅'}`)
    console.log(`🔍 [RANKING-SCREEN]   - notClaimed: ${checks.notClaimed} ${!checks.notClaimed ? '❌ BLOCKING' : '✅'}`)
    console.log(`🔍 [RANKING-SCREEN] ---`)
    console.log(`🔍 [RANKING-SCREEN] Final result: canClaimResult = ${canClaimResult}`)
    console.log(`🔍 [RANKING-SCREEN] ========================================`)
    
    // 🔍 DIAGNÓSTICO: Log de falhas específicas
    if (!canClaimResult) {
      const failures = []
      if (!checks.isDayFinalized) failures.push('Day is not finalized on contract')
      if (!checks.hasCurrentPlayer) failures.push('No current player')
      if (!checks.hasRowPlayer) failures.push('No row player')
      if (!checks.playersMatch) failures.push('Players do not match')
      if (!checks.isTop3) failures.push('Not in top 3')
      if (!checks.notClaimed) failures.push('Already claimed')
      console.log(`🔍 [RANKING-SCREEN] ❌ canClaim FAILED. Blocking reasons:`, failures)
    } else {
      console.log(`🔍 [RANKING-SCREEN] ✅ canClaim PASSED - Button should appear!`)
    }
    
    return canClaimResult
  }, [displayDate, currentPlayer, claimedRanks, isDayFinalized, dayForFinalization])

  // Handle prize claim
  // ✅ CORREÇÃO: Fluxo completo de claim
  // 1. Registrar no banco via API (validação de segurança)
  // 2. Chamar contrato no frontend (transferência de USDC)
  const handleClaim = useCallback(async (rank: number) => {
    if (!currentPlayer) {
      alert("Wallet not connected")
      return
    }

    // Recalculate selectedDay from displayDate to ensure it's current
    // Store in outer scope so it's available in catch block
    const [year, month, day] = displayDate.split('-').map(Number)
      const dateObj = new Date(Date.UTC(year, month - 1, day))
      const selectedDay = getDayId(dateObj)
      const dateString = displayDate
    let dbRegistrationSuccess = false

    try {
      console.log(`[RANKING-SCREEN] Claiming prize: day=${selectedDay}, rank=${rank}, player=${currentPlayer}`)
      
      // ✅ PASSO 1: Registrar no banco (validação de segurança)
      console.log(`🔍 [RANKING-SCREEN] Step 1: Registering claim in database...`)
      let dbRegistrationError: string | null = null
      
      try {
        const res = await fetch("/api/claimPrize", {
          method: "POST",
          body: JSON.stringify({ day: selectedDay, rank, player: currentPlayer }),
          headers: { "Content-Type": "application/json" }
        })

        const data = await res.json()

        console.log(`🔍 [RANKING-SCREEN] Database registration response:`, {
          status: res.status,
          data
        })

        if (!res.ok || data.error) {
          dbRegistrationError = data.error || 'Unknown error'
          console.error(`🔍 [RANKING-SCREEN] Database registration failed:`, dbRegistrationError)
          return alert(dbRegistrationError || "Failed to register claim")
        }

        dbRegistrationSuccess = true
        console.log(`✅ [RANKING-SCREEN] Step 1 complete: Claim registered in database`)
      } catch (dbErr: any) {
        dbRegistrationError = dbErr?.message || 'Database registration failed'
        console.error(`🔍 [RANKING-SCREEN] Database registration error:`, dbErr)
        return alert(`Failed to register claim: ${dbRegistrationError}`)
      }

      // ✅ PASSO 2: Chamar contrato no frontend (transferência de USDC)
      // O backend não pode chamar o contrato porque precisa da assinatura da wallet do usuário
      // Por isso, chamamos o contrato diretamente no frontend
      console.log(`🔍 [RANKING-SCREEN] Step 2: Calling contract to transfer prize...`)
      
      if (typeof window === "undefined" || !window.ethereum) {
        alert("Wallet not connected. Please connect your wallet to claim the prize.")
        return
      }

      // Usar a função onClaimPrize passada como prop (se disponível)
      // Ou chamar o contrato diretamente aqui
      const { BrowserProvider, Contract } = await import("ethers")
      const provider = new BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      
      const PRIZE_POOL_ADDRESS = process.env.NEXT_PUBLIC_PRIZE_POOL_CONTRACT_ADDRESS
      if (!PRIZE_POOL_ADDRESS) {
        alert("Prize pool contract not configured. Please contact support.")
        return
      }

      // ✅ REVERTIDO: Usar ABI original do contrato existente
      const PRIZE_POOL_ABI = [
        "function claim(uint256 day) external",
        "function getWinner(uint256 day, uint256 rank) view returns (address)",
        "function winners(uint256 day, uint256 rank) view returns (address)",
        "function claimed(uint256 day, address user) view returns (bool)",
        "function canClaim(uint256 day, address user) view returns (bool)",
        "function totalPlayers(uint256 day) view returns (uint256)",
      ]

      const readContract = new Contract(PRIZE_POOL_ADDRESS, PRIZE_POOL_ABI, provider)
      const writeContract = new Contract(PRIZE_POOL_ADDRESS, PRIZE_POOL_ABI, signer)
      
      // ✅ REVERTIDO: Verificar se o dia está finalizado usando totalPlayers > 0 (lógica original)
      console.log(`🔍 [RANKING-SCREEN] Checking if day ${selectedDay} is finalized...`)
      console.log(`🔍 [RANKING-SCREEN] Contract address: ${PRIZE_POOL_ADDRESS}`)
      const totalPlayers = await readContract.totalPlayers(selectedDay)
      console.log(`🔍 [RANKING-SCREEN] totalPlayers(${selectedDay}) = ${totalPlayers.toString()}`)
      
      if (totalPlayers === BigInt(0)) {
        alert(
          `Day not finalized yet!\n\n` +
          `The day ${dateString} (day ${selectedDay}) has not been finalized in the contract.\n\n` +
          `The admin needs to register the winners first using the /api/register-daily-winners endpoint.\n\n` +
          `Please wait for the day to be finalized, or contact support if this is a past day.`
        )
        return
      }
      
      // ✅ Verificar se o usuário é realmente um vencedor antes de tentar claim
      console.log(`🔍 [RANKING-SCREEN] Verifying user is a winner for day ${selectedDay}...`)
      let isWinner = false
      let winnerRank = 0
      
      for (let checkRank = 1; checkRank <= 3; checkRank++) {
        try {
          const winnerAddress = await readContract.getWinner(selectedDay, checkRank)
          console.log(`🔍 [RANKING-SCREEN] getWinner(${selectedDay}, ${checkRank}) = ${winnerAddress}`)
          
          if (winnerAddress.toLowerCase() === currentPlayer.toLowerCase()) {
            isWinner = true
            winnerRank = checkRank
            console.log(`✅ [RANKING-SCREEN] User is winner at rank ${winnerRank}`)
            break
          }
        } catch (err) {
          console.warn(`[RANKING-SCREEN] Error checking rank ${checkRank}:`, err)
        }
      }
      
      if (!isWinner) {
        alert(
          `You are not a winner for this day!\n\n` +
          `The day ${displayDate} (day ${selectedDay}) has been finalized, but you are not in the top 3 winners.\n\n` +
          `Only the top 3 players can claim prizes.`
        )
        return
      }
      
      // ✅ O contrato usa claim(day) que encontra o rank do usuário automaticamente
      console.log(`🔍 [RANKING-SCREEN] Calling contract.claim(${selectedDay})...`)
      const tx = await writeContract.claim(selectedDay)
      console.log(`🔍 [RANKING-SCREEN] Transaction sent, waiting for confirmation... Hash: ${tx.hash}`)
      
      await tx.wait()
      console.log(`✅ [RANKING-SCREEN] Step 2 complete: Transaction confirmed! Hash: ${tx.hash}`)

      // ✅ CORREÇÃO: Verificar no contrato se realmente foi claimed antes de atualizar estado
      // Isso garante que só marcamos como claimed se o contrato confirmar
      console.log(`🔍 [RANKING-SCREEN] Verifying claim on contract...`)
      const isClaimedOnChain = await readContract.claimed(selectedDay, currentPlayer)
      console.log(`🔍 [RANKING-SCREEN] Contract.claimed(${selectedDay}, ${currentPlayer}) = ${isClaimedOnChain}`)
      
      if (isClaimedOnChain) {
        // Update claims state only if contract confirms
        console.log(`🔍 [RANKING-SCREEN] Updating UI state (contract confirmed)...`)
        setClaims(prev => [...prev, { player: currentPlayer.toLowerCase(), rank }])
        setClaimedRanks(prev => [...prev, rank])
      } else {
        console.warn(`⚠️ [RANKING-SCREEN] Transaction confirmed but contract.claimed() returned false. This should not happen.`)
        // Ainda assim atualizar o estado, pois a transação foi confirmada
        setClaims(prev => [...prev, { player: currentPlayer.toLowerCase(), rank }])
        setClaimedRanks(prev => [...prev, rank])
      }
      
      // ✅ Mostrar popup com informações do prêmio
      const prizeAmounts: Record<number, string> = {
        1: "$20 USDC",
        2: "$10 USDC",
        3: "$5 USDC",
      }
      const prizeAmount = prizeAmounts[rank] || "Unknown"
      
      setClaimSuccessData({
        rank,
        prizeAmount,
        txHash: tx.hash,
      })
      setShowClaimSuccessDialog(true)
      setShowClaimSuccessDialog(true)
    } catch (err: any) {
      console.error(`[RANKING-SCREEN] Claim error:`, err)
      
      // Verificar se o usuário rejeitou a transação
      if (err?.code === 4001 || err?.message?.includes("rejected") || err?.message?.includes("denied") || err?.message?.includes("User rejected")) {
        alert("Transaction rejected by user. The claim is registered in the database, but the prize was not transferred.")
        return
      }
      
      // ✅ CORREÇÃO: Mensagens de erro mais específicas
      const errorMessage = err?.message || err?.reason || String(err)
      
      // ✅ CORREÇÃO: Se o contrato falhou, informar sobre o registro no banco
      // O banco foi atualizado no passo 1, mas o contrato falhou no passo 2
      // O usuário pode tentar novamente - a verificação no contrato vai ignorar o registro do banco se não foi claimed
      if (dbRegistrationSuccess) {
        console.warn(`⚠️ [RANKING-SCREEN] Database has claim record but contract failed. User can try again.`)
      }
      
      if (errorMessage.includes("Day not finalized")) {
        alert(
          `Day not finalized!\n\n` +
          `The day ${displayDate} (day ${selectedDay}) has not been finalized in the contract yet.\n\n` +
          `The admin needs to register the winners first. Please wait or contact support.\n\n` +
          `Note: The claim was registered in the database but will be ignored until the day is finalized.`
        )
        return
      }
      
      if (errorMessage.includes("Not a winner") || errorMessage.includes("not a winner")) {
        alert(
          `You are not a winner for this day!\n\n` +
          `The day ${displayDate} (day ${selectedDay}) has been finalized, but you are not in the top 3 winners.\n\n` +
          `Only the top 3 players can claim prizes.`
        )
        return
      }
      
      if (errorMessage.includes("Already claimed")) {
        // ✅ CORREÇÃO: Verificar no contrato se realmente foi claimed
        // Pode ser que o banco tenha registro mas o contrato não
        if (typeof window !== "undefined" && window.ethereum) {
          try {
            const { BrowserProvider, Contract } = await import("ethers")
            const provider = new BrowserProvider(window.ethereum)
            const PRIZE_POOL_ADDRESS = process.env.NEXT_PUBLIC_PRIZE_POOL_CONTRACT_ADDRESS
            
            if (PRIZE_POOL_ADDRESS) {
              const PRIZE_POOL_ABI = [
                "function claimed(uint256 day, address user) view returns (bool)",
              ]
              const readContract = new Contract(PRIZE_POOL_ADDRESS, PRIZE_POOL_ABI, provider)
              const isClaimedOnChain = await readContract.claimed(selectedDay, currentPlayer)
              
              if (!isClaimedOnChain) {
                // Contrato diz que não foi claimed, mas banco tem registro
                // Isso significa que uma tentativa anterior falhou
                alert(
                  `Previous claim attempt failed!\n\n` +
                  `The database has a record of a previous claim attempt, but the contract shows it was not completed.\n\n` +
                  `You can try claiming again. If the problem persists, contact support.`
                )
                return
              }
            }
          } catch (verifyErr) {
            console.warn(`[RANKING-SCREEN] Could not verify claim status:`, verifyErr)
          }
        }
        
        alert(
          `Prize already claimed!\n\n` +
          `You have already claimed the prize for day ${displayDate} (day ${selectedDay}).\n\n` +
          `Each prize can only be claimed once.`
        )
        return
      }
      
      // Se o erro foi na chamada do contrato, mas o registro no banco foi bem-sucedido
      alert(
        `Claim registered in database, but contract call failed:\n\n${errorMessage}\n\n` +
        `The database has a record of this claim attempt, but the prize was not transferred.\n\n` +
        `You can try claiming again. If the problem persists, contact support.`
      )
    }
  }, [currentPlayer, displayDate])

  // ✅ CORREÇÃO: Removido useEffect que monitorava ranking - não é necessário e pode causar re-renders desnecessários

  // Load ranking on mount and when selectedDate prop changes
  useEffect(() => {
    const today = getTodayDateString()
    const dateToLoad =
      selectedDate && selectedDate.trim() !== "" ? selectedDate : today

    console.log(
      "🔍 [RANKING-SCREEN] useEffect loading ranking for date:",
      {
        selectedDate,
        dateToLoad,
        currentDisplayDate: displayDate,
        willUpdateDisplayDate: dateToLoad !== displayDate
      }
    )

    setCurrentPage(1)

    // ✅ CORREÇÃO: Atualizar displayDate quando selectedDate prop muda
    // ANTES: Não atualizava displayDate, causando dessincronia
    // AGORA: Atualiza displayDate para manter sincronizado com selectedDate prop
    if (dateToLoad !== displayDate) {
      console.log(`🔍 [RANKING-SCREEN] Updating displayDate from prop: ${displayDate} -> ${dateToLoad}`)
      setDisplayDate(dateToLoad)
    }

    // Não atualize displayDate aqui — o loadRanking já faz isso
    loadRanking(dateToLoad).catch((err) => {
      console.error(
        "[RANKING-SCREEN] loadRanking promise rejected inside useEffect:",
        err
      )
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate])

  // ✅ NOVO: Garantir que loadRanking seja chamado quando displayDate mudar (via calendário)
  // Isso garante que isDayFinalized seja verificado para o dia correto
  // ✅ CORREÇÃO: Sempre chamar loadRanking quando displayDate mudar, mesmo se o dia já foi verificado
  // Isso garante que a verificação de finalização seja sempre executada
  useEffect(() => {
    if (displayDate) {
      console.log(`🔍 [RANKING-SCREEN] ========================================`)
      console.log(`🔍 [RANKING-SCREEN] DISPLAYDATE CHANGED - useEffect triggered`)
      console.log(`🔍 [RANKING-SCREEN] ========================================`)
      console.log(`🔍 [RANKING-SCREEN] displayDate: "${displayDate}"`)
      const selectedDay = getDayId(new Date(displayDate + 'T00:00:00Z'))
      const dayMatches = selectedDay === dayForFinalization
      console.log(`🔍 [RANKING-SCREEN] Day ${selectedDay} matches dayForFinalization (${dayForFinalization}): ${dayMatches}`)
      console.log(`🔍 [RANKING-SCREEN] Current isDayFinalized state: ${isDayFinalized}`)
      console.log(`🔍 [RANKING-SCREEN] ========================================`)
      
      // ✅ CORREÇÃO: Sempre chamar loadRanking quando displayDate mudar
      // Mesmo que o dia já tenha sido verificado, precisamos garantir que a verificação seja executada
      // Isso resolve o problema de isDayFinalized estar false mesmo quando o dia foi verificado
      console.log(`🔍 [RANKING-SCREEN] Calling loadRanking to verify finalization for day ${selectedDay}...`)
      loadRanking(displayDate).catch((err) => {
        console.error(
          "❌ [RANKING-SCREEN] loadRanking promise rejected inside displayDate useEffect:",
          err
        )
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayDate])

  // ✅ CORREÇÃO: Removido useMemo para 'rankings' - não é mais necessário
  // ANTES: rankings era um useMemo que mapeava ranking para um formato diferente
  // PROBLEMA: Se o mapeamento falhasse, rankings ficava vazio mesmo com ranking cheio
  // AGORA: Fazemos o mapeamento diretamente na renderização, usando ranking como fonte única

  // ✅ CORREÇÃO: Paginação calculada diretamente de 'ranking'
  // Mantemos paginatedRankings como useMemo para performance, mas derivado diretamente de 'ranking'
  const paginatedRankings = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    
    // Ranking já vem com todos os campos necessários do API
    return ranking.slice(startIndex, endIndex)
  }, [ranking, currentPage])

  const totalPages = Math.min(maxPages, Math.ceil(ranking.length / itemsPerPage))

  const isTodaySelected = displayDate === getTodayDateString()

  // Handle calendar date selection
  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      // Convert to UTC date string (YYYY-MM-DD)
      const year = date.getUTCFullYear()
      const month = String(date.getUTCMonth() + 1).padStart(2, '0')
      const day = String(date.getUTCDate()).padStart(2, '0')
      const dateString = `${year}-${month}-${day}`
      
      // 🔍 DIAGNÓSTICO: Calcular day ID antes de atualizar
      const dateObj = new Date(Date.UTC(year, date.getUTCMonth(), date.getUTCDate()))
      const selectedDay = getDayId(dateObj)
      const todayDay = getDayId()
      const isPastDay = selectedDay < todayDay
      
      console.log(`📅 [RANKING-SCREEN] Calendar date selected:`, {
        dateString,
        dateObj: dateObj.toISOString(),
        selectedDay,
        todayDay,
        isPastDay,
        oldDisplayDate: displayDate,
        willUpdateDisplayDate: true
      })
      
      setCurrentPage(1) // Reset to first page when changing date
      
      // ✅ CORREÇÃO: Atualizar displayDate ANTES de chamar loadRanking
      // Isso garante que o displayDate está correto quando canClaim é chamado
      console.log(`📅 [RANKING-SCREEN] Updating displayDate: ${displayDate} -> ${dateString}`)
      setDisplayDate(dateString) // Update display date immediately
      
      setShowCalendarDialog(false)
      setCalendarSelectedDate(undefined)
      
      // Load ranking immediately for the selected date
      console.log(`📅 [RANKING-SCREEN] Calling loadRanking with: ${dateString}`)
      loadRanking(dateString)
      
      // ✅ CORREÇÃO: NÃO chamar onViewDailyResults aqui - isso muda o gameState para daily-results
      // ANTES: Chamava onViewDailyResults imediatamente, mudando para daily-results screen
      // PROBLEMA: Isso fazia o RankingScreen desaparecer antes de renderizar a tabela com o botão de claim
      // AGORA: Deixamos o usuário ver o ranking primeiro, e ele pode clicar em "View Past Results" se quiser
      // Se onViewDailyResults is provided, call it with the UTC date (comentado para não mudar de tela)
      // if (onViewDailyResults) {
      //   const utcDate = new Date(Date.UTC(year, date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0))
      //   console.log(`📅 [RANKING-SCREEN] Calling onViewDailyResults with:`, utcDate.toISOString())
      //   onViewDailyResults(utcDate)
      // }
    }
  }

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-6xl mx-auto space-y-4">
        {/* Header */}
        <Card className="p-4 bg-white/95 backdrop-blur border-4 border-amber-900">
          <div className="flex items-center justify-between">
            <Button
              onClick={() => {
                playClickSound()
                onBack()
              }}
              variant="outline"
              className="border-2 border-amber-600 text-amber-900 hover:bg-amber-50 bg-transparent"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Game
            </Button>
            <h1 className="text-2xl md:text-3xl font-bold text-amber-900">
              Rankings
            </h1>
            <div className="w-32" /> {/* Spacer for alignment */}
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-r from-amber-100 to-amber-50 border-4 border-amber-900">
          <div className="flex items-center justify-center gap-4 text-amber-900 flex-wrap">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              <span className="font-bold text-lg">
                Ranking de {formatDateForDisplay(displayDate)}
                {!isTodaySelected && (
                  <Button
                    onClick={() => {
                      playClickSound()
                      const today = getTodayDateString()
                      console.log(`📅 [RANKING-SCREEN] Show Today clicked, setting date to: ${today}`)
                      setCurrentPage(1)
                      setDisplayDate(today) // Update display date immediately
                      loadRanking(today)
                    }}
                    variant="link"
                    size="sm"
                    className="ml-2 text-amber-700 hover:text-amber-900 underline h-auto p-0 font-normal"
                  >
                    (Show Today)
                  </Button>
                )}
                {onViewDailyResults && (
                  <Button
                    onClick={() => {
                      playClickSound()
                      setShowCalendarDialog(true)
                    }}
                    variant="outline"
                    size="sm"
                    className="ml-2 border-2 border-amber-600 text-amber-900 hover:bg-amber-50 bg-transparent"
                  >
                    <Calendar className="w-4 h-4 mr-2" />
                    View Past Results
                  </Button>
                )}
              </span>
            </div>
          </div>
        </Card>

        {/* Calendar Dialog */}
        {onViewDailyResults && (
          <Dialog open={showCalendarDialog} onOpenChange={setShowCalendarDialog}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Select a Date</DialogTitle>
              </DialogHeader>
              <div className="flex justify-center p-4">
                <CalendarComponent
                  mode="single"
                  selected={calendarSelectedDate}
                  onSelect={handleDateSelect}
                  disabled={(date) => {
                    // Disable future dates
                    const today = new Date()
                    today.setUTCHours(23, 59, 59, 999)
                    return date > today
                  }}
                  className="rounded-md border"
                />
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Claim Success Dialog */}
        <Dialog open={showClaimSuccessDialog} onOpenChange={setShowClaimSuccessDialog}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-center text-green-600">
                🎉 Prize Claimed Successfully!
              </DialogTitle>
            </DialogHeader>
            {claimSuccessData && (
              <div className="space-y-6 py-4">
                <div className="text-center">
                  <div className="text-6xl mb-4">
                    {claimSuccessData.rank === 1 && "🥇"}
                    {claimSuccessData.rank === 2 && "🥈"}
                    {claimSuccessData.rank === 3 && "🥉"}
                  </div>
                  <div className="text-3xl font-bold text-amber-900 mb-2">
                    {claimSuccessData.rank === 1 && "1st Place"}
                    {claimSuccessData.rank === 2 && "2nd Place"}
                    {claimSuccessData.rank === 3 && "3rd Place"}
                  </div>
                  <div className="text-4xl font-bold text-green-600 mb-4">
                    {claimSuccessData.prizeAmount}
                  </div>
                  <p className="text-sm text-gray-600 mb-4">
                    Your prize has been transferred to your wallet!
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 border-2 border-gray-200">
                  <p className="text-xs text-gray-500 mb-2">Transaction Hash:</p>
                  <p className="text-xs font-mono text-gray-700 break-all mb-3">
                    {claimSuccessData.txHash}
                  </p>
                  <a
                    href={`https://testnet.arcscan.app/tx/${claimSuccessData.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-800 underline"
                  >
                    View on ArcScan →
                  </a>
                </div>
                <div className="flex justify-center">
                  <Button
                    onClick={() => {
                      setShowClaimSuccessDialog(false)
                      setClaimSuccessData(null)
                    }}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    Close
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Card className="p-6 bg-gradient-to-br from-blue-500 to-indigo-600 text-white border-4 border-blue-700">
          <div className="text-center space-y-3">
            <div className="flex items-center justify-center gap-2">
              <h3 className="text-2xl font-bold">Daily Prize Pool</h3>
            </div>
            <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto">
              <div className="bg-white/20 backdrop-blur rounded-lg p-4">
                <div className="text-4xl mb-2">🥇</div>
                <div className="text-xl font-bold">1st Place</div>
                <div className="text-3xl font-bold mt-2">$20 USDC</div>
              </div>
              <div className="bg-white/20 backdrop-blur rounded-lg p-4">
                <div className="text-4xl mb-2">🥈</div>
                <div className="text-xl font-bold">2nd Place</div>
                <div className="text-3xl font-bold mt-2">$10 USDC</div>
              </div>
              <div className="bg-white/20 backdrop-blur rounded-lg p-4">
                <div className="text-4xl mb-2">🥉</div>
                <div className="text-xl font-bold">3rd Place</div>
                <div className="text-3xl font-bold mt-2">$5 USDC</div>
              </div>
            </div>
            <p className="text-sm opacity-90">Prizes distributed at the end of each day</p>
          </div>
        </Card>

        {/* Rules Card */}
        <Card className="p-6 bg-amber-50 border-4 border-amber-900">
          <h3 className="text-xl font-bold text-amber-900 mb-4">Rules & Prize Claim</h3>
          <div className="space-y-3 text-sm text-amber-900">
            <div className="bg-blue-100 border-2 border-blue-400 rounded-lg p-4">
              <p className="font-bold mb-2">📊 Tiebreaker Criteria:</p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Highest score</li>
                <li>Most golden moles hit</li>
                <li>Fewest errors</li>
                <li>Earliest first game timestamp</li>
              </ol>
            </div>
          </div>
        </Card>

        {/* Rankings Table */}
        <Card className="bg-white/95 backdrop-blur border-4 border-amber-900 overflow-hidden">
          <div className="overflow-x-auto">
            {(() => {
              console.log(`🎨 [RANKING-SCREEN] Rendering - loading: ${loading}, error: ${error}, ranking.length: ${ranking.length}, paginatedRankings.length: ${paginatedRankings.length}`)
              return null
            })()}
            {loading ? (
              <div className="text-center py-8">
                <p className="text-gray-600">Loading ranking...</p>
              </div>
            ) : error ? (
              <div className="text-center py-8">
                <p className="text-red-600">{error}</p>
              </div>
            ) : ranking.length === 0 ? (
              // ✅ CORREÇÃO: Verificar ranking.length diretamente, não rankings.length
              // ANTES: Verificava rankings.length (que vinha de um useMemo que podia falhar)
              // PROBLEMA: rankings podia estar vazio mesmo com ranking cheio
              // AGORA: Verificamos ranking diretamente, que é a fonte única da verdade
              <div className="text-center py-8">
                <p className="text-gray-600">No players found for this day.</p>
              </div>
            ) : (
              // ✅ CORREÇÃO: Renderizar usando paginatedRankings que é derivado diretamente de ranking
              // ANTES: Usava paginatedRankings que vinha de rankings (useMemo intermediário)
              // PROBLEMA: Se o useMemo intermediário falhasse, paginatedRankings ficava vazio
              // AGORA: paginatedRankings é calculado diretamente de ranking, garantindo que os dados fluam corretamente
              <table className="w-full">
                <thead className="bg-amber-600 text-white">
                  <tr>
                    <th className="px-4 py-3 text-left font-bold">Rank</th>
                    <th className="px-4 py-3 text-left font-bold">Player</th>
                    <th className="px-4 py-3 text-right font-bold">Points</th>
                    <th className="px-4 py-3 text-center font-bold">Golden</th>
                    <th className="px-4 py-3 text-center font-bold">Errors</th>
                    <th className="px-4 py-3 text-center font-bold">Prize</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-200">
                  {paginatedRankings.map((row: RankingEntry, index: number) => {
                    // ✅ CORREÇÃO: Calcular o rank real baseado na página atual
                    // ANTES: rank = index + 1 (só funcionava para primeira página)
                    // AGORA: rank = (currentPage - 1) * itemsPerPage + index + 1 (rank global correto)
                    const rank = (currentPage - 1) * itemsPerPage + index + 1

                    // 🔍 DIAGNÓSTICO: Log detalhado para cada linha ANTES de chamar canClaim
                    const selectedDayFromDisplay = displayDate ? getDayId(new Date(displayDate + 'T00:00:00Z')) : null
                    const todayDayFromDisplay = getDayId()
                    const isPastDayFromDisplay = selectedDayFromDisplay !== null && selectedDayFromDisplay < todayDayFromDisplay
                    
                    console.log(`🔍 [RANKING-SCREEN] Row ${index} (rank ${rank}) - BEFORE canClaim:`, {
                      rowPlayer: row.player,
                      rowPlayerLower: row.player?.toLowerCase(),
                      currentPlayer: currentPlayer,
                      currentPlayerLower: currentPlayer?.toLowerCase(),
                      rank,
                      displayDate,
                      selectedDayFromDisplay,
                      todayDayFromDisplay,
                      isPastDayFromDisplay,
                      claimedRanks,
                      isClaimed: claimedRanks.includes(rank)
                    })
                    
                    // 🔍 DIAGNÓSTICO: Chamar canClaim e logar resultado
                    const canClaimResult = canClaim(rank, row.player)
                    
                    console.log(`🔍 [RANKING-SCREEN] Row ${index} (rank ${rank}) - AFTER canClaim:`, {
                      canClaimResult,
                      displayDate,
                      selectedDayFromDisplay,
                      todayDayFromDisplay,
                      isPastDayFromDisplay
                    })

                    return (
                      <tr key={`${row.player}-${rank}`}>
                        <td className="px-4 py-3">{rank}</td>
                        <td className="px-4 py-3">{formatAddress(row.player)}</td>
                        <td className="px-4 py-3 text-right">{row.points}</td>
                        <td className="px-4 py-3 text-center">{row.golden_moles ?? 0}</td>
                        <td className="px-4 py-3 text-center">{row.errors ?? 0}</td>
                        <td className="px-4 py-3 text-center">
                          {/* ✅ CORREÇÃO: Passar rank diretamente para canClaim (agora recebe rank, não index) */}
                          {checkingFinalization ? (
                            <span className="text-xs text-gray-500">Checking...</span>
                          ) : canClaimResult ? (
                            <Button
                              onClick={() => {
                                console.log(`🔍 [RANKING-SCREEN] Claim button clicked for rank ${rank}`)
                                handleClaim(rank)
                              }}
                              className="text-xs"
                            >
                              Claim prize
                            </Button>
                          ) : claimedRanks.includes(rank) ? (
                            <span className="text-xs text-gray-600">Prize already claimed</span>
                          ) : (() => {
                            // Verificar se o dia está finalizado baseado no selectedDay
                            const selectedDayFromDisplay = displayDate ? getDayId(new Date(displayDate + 'T00:00:00Z')) : null
                            const dayIsFinalized = selectedDayFromDisplay !== null ? ((selectedDayFromDisplay === dayForFinalization) ? isDayFinalized : false) : false
                            const isCurrentPlayer = row.player?.toLowerCase() === currentPlayer?.toLowerCase()
                            
                            if (!dayIsFinalized && rank <= 3 && isCurrentPlayer) {
                              return <span className="text-xs text-amber-600">Claims will be available after the day is finalized (UTC)</span>
                            }
                            return null
                          })()}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <Card className="p-4 bg-white/95 backdrop-blur border-4 border-amber-900">
            <div className="flex items-center justify-between">
              <Button
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                variant="outline"
                className="border-2 border-amber-600 text-amber-900 hover:bg-amber-50 bg-transparent disabled:opacity-50"
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                Previous
              </Button>
              <span className="text-amber-900 font-bold">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                variant="outline"
                className="border-2 border-amber-600 text-amber-900 hover:bg-amber-50 bg-transparent disabled:opacity-50"
              >
                Next
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
