"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Calendar, Wallet, Star } from "lucide-react"
import { cn } from "@/lib/utils"
import { BrowserProvider, Contract } from "ethers"
import { getDayId } from "@/utils/day"

// Initialize audio context on first user interaction
let clickAudioContext: AudioContext | null = null

const getClickAudioContext = () => {
  if (!clickAudioContext) {
    try {
      clickAudioContext = new AudioContext()
    } catch (error) {
      console.error("Failed to create AudioContext:", error)
      return null
    }
  }
  return clickAudioContext
}

const playClickSound = () => {
  const ctx = getClickAudioContext()
  if (!ctx) return

  try {
    // Resume context if suspended (required by some browsers)
    if (ctx.state === "suspended") {
      ctx.resume()
    }

    const now = ctx.currentTime
    const oscillator = ctx.createOscillator()
    const gainNode = ctx.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(ctx.destination)

    oscillator.frequency.setValueAtTime(800, now)
    oscillator.frequency.exponentialRampToValueAtTime(400, now + 0.1)

    gainNode.gain.setValueAtTime(0.3, now)
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1)

    oscillator.start(now)
    oscillator.stop(now + 0.1)
  } catch (error) {
    console.error("Error playing click sound:", error)
  }
}

interface RankingEntry {
  player: string
  score: number
  goldenMoles: number
  errors: number
  timestamp: number
}

interface DailyResultsScreenProps {
  date: Date
  rankings: RankingEntry[]
  currentPlayer: string // Wallet address
  onBack: () => void
  onClaimPrize: (date: Date, rank?: number, providedDay?: number) => void
}

const formatAddress = (address: string) => {
  if (!address) return ""
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

interface DailyRankingEntry {
  address: string
  score: number
  goldenMoles?: number
  errors?: number
}

interface PrizeConfig {
  first: string
  second: string
  third: string
}

export function DailyResultsScreen({ date, rankings, currentPlayer, onBack, onClaimPrize }: DailyResultsScreenProps) {
  // ✅ ÚNICA FONTE DE VERDADE: selectedDay calculado UMA VEZ quando date muda
  const [selectedDay, setSelectedDay] = useState<number>(() => getDayId(date))
  
  const [dailyRanking, setDailyRanking] = useState<DailyRankingEntry[]>([]) // Ranking from backend
  const [prizeConfig, setPrizeConfig] = useState<PrizeConfig | null>(null) // Prize amounts from contract
  const [winners, setWinners] = useState<Array<{ rank: number; address: string }>>([]) // Winners from contract (for display only)
  const [claimedStatus, setClaimedStatus] = useState<Map<string, boolean>>(new Map()) // Track claimed status for each player
  const [canClaimMap, setCanClaimMap] = useState<Map<string, boolean>>(new Map()) // Track canClaim status for each player (ONLY source of truth for claim button)
  const [loadingRanking, setLoadingRanking] = useState(true)
  const [loadingPrizeConfig, setLoadingPrizeConfig] = useState(true)
  const [loadingWinners, setLoadingWinners] = useState(true)
  const [checkingClaims, setCheckingClaims] = useState(true) // Checking claims for all players
  const [claimingPrize, setClaimingPrize] = useState(false)
  
  // ✅ Atualizar selectedDay quando date prop mudar (mas NUNCA recalcular depois)
  useEffect(() => {
    const newDay = getDayId(date)
    if (newDay !== selectedDay) {
      console.log("🔍 [DAILY-RESULTS] Date prop changed, updating selectedDay:")
      console.log("   - date prop:", date.toISOString())
      console.log("   - old selectedDay:", selectedDay)
      console.log("   - new selectedDay:", newDay)
      setSelectedDay(newDay)
    }
  }, [date, selectedDay])
  
  // ✅ Usar selectedDay em TODAS as operações (NUNCA recalcular)
  const day = selectedDay
  
  // LOG: Day usage
  console.log("🔍 [DAILY-RESULTS] Using selectedDay (single source of truth):")
  console.log("   - date prop:", date.toISOString())
  console.log("   - selectedDay:", day)
  console.log("   - selectedDay type:", typeof day)
  console.log("   - currentPlayer:", currentPlayer)
  
  // 1. Fetch ranking from backend (ALWAYS)
  useEffect(() => {
    const fetchDailyRanking = async () => {
      try {
        setLoadingRanking(true)
        const response = await fetch(`/api/daily-results?day=${day}`)
        if (!response.ok) {
          console.error("Failed to fetch daily ranking")
          setDailyRanking([])
          return
        }
        
        const data = await response.json()
        console.log("🔍 [DAILY-RESULTS] Ranking from backend:")
        console.log("   - day from backend:", data.day)
        console.log("   - ranking count:", data.ranking?.length || 0)
        console.log("   - ranking:", data.ranking)
        setDailyRanking(data.ranking || [])
      } catch (error) {
        console.error("Error fetching daily ranking:", error)
        setDailyRanking([])
      } finally {
        setLoadingRanking(false)
      }
    }
    
    fetchDailyRanking()
  }, [day])
  
  // 2. Fetch prize config from contract (ALWAYS)
  useEffect(() => {
    const fetchPrizeConfig = async () => {
      try {
        if (typeof window === "undefined" || !window.ethereum) {
          setLoadingPrizeConfig(false)
          return
        }
        
        setLoadingPrizeConfig(true)
        const provider = new BrowserProvider(window.ethereum)
        const PRIZE_POOL_ABI = [
          "function prizes(uint256) view returns (uint256)",
        ]
        const PRIZE_POOL_ADDRESS = process.env.NEXT_PUBLIC_PRIZE_POOL_CONTRACT_ADDRESS || "0xeA0df70040E77a821b14770E53aa577A745930ae"
        
        if (PRIZE_POOL_ADDRESS === "0x0000000000000000000000000000000000000000") {
          setLoadingPrizeConfig(false)
          return
        }
        
        const contract = new Contract(PRIZE_POOL_ADDRESS, PRIZE_POOL_ABI, provider)
        
        // prizes[0] = 1º, prizes[1] = 2º, prizes[2] = 3º
        const [firstRaw, secondRaw, thirdRaw] = await Promise.all([
          contract.prizes(0),
          contract.prizes(1),
          contract.prizes(2),
        ])
        
        // Convert from 6 decimals to USDC amount
        const first = (Number(firstRaw) / 1000000).toFixed(0)
        const second = (Number(secondRaw) / 1000000).toFixed(0)
        const third = (Number(thirdRaw) / 1000000).toFixed(0)
        
        setPrizeConfig({ first, second, third })
      } catch (error) {
        console.error("Error fetching prize config:", error)
      } finally {
        setLoadingPrizeConfig(false)
      }
    }
    
    fetchPrizeConfig()
  }, [])
  
  // 3. Fetch winners from contract (for display only)
  useEffect(() => {
    const fetchWinners = async () => {
      try {
        if (typeof window === "undefined" || !window.ethereum) {
          setLoadingWinners(false)
          return
        }
        
        setLoadingWinners(true)
        const provider = new BrowserProvider(window.ethereum)
        const PRIZE_POOL_ABI = [
          "function getWinner(uint256 day, uint256 rank) view returns (address)",
          "function claimed(uint256 day, address user) view returns (bool)",
        ]
        const PRIZE_POOL_ADDRESS = process.env.NEXT_PUBLIC_PRIZE_POOL_CONTRACT_ADDRESS || "0xeA0df70040E77a821b14770E53aa577A745930ae"
        
        if (PRIZE_POOL_ADDRESS === "0x0000000000000000000000000000000000000000") {
          setLoadingWinners(false)
          return
        }
        
        const contract = new Contract(PRIZE_POOL_ADDRESS, PRIZE_POOL_ABI, provider)
        const winnersList: Array<{ rank: number; address: string }> = []
        const claimedMap = new Map<string, boolean>()
        
        console.log("🔍 [DAILY-RESULTS] Fetching winners from contract:")
        console.log("   - PRIZE_POOL_ADDRESS:", PRIZE_POOL_ADDRESS)
        console.log("   - selectedDay sent to contract:", day)
        console.log("   - selectedDay type:", typeof day)
        
        // Fetch winners for ranks 1, 2, 3 (for display only)
        for (let rank = 1; rank <= 3; rank++) {
          try {
            const winnerAddress = await contract.getWinner(day, rank)
            console.log(`   - getWinner(day=${day}, rank=${rank}):`, winnerAddress)
            
            if (winnerAddress && winnerAddress !== "0x0000000000000000000000000000000000000000") {
              const winnerAddressLower = winnerAddress.toLowerCase()
              winnersList.push({ rank, address: winnerAddressLower })
              
              // Check if this winner has claimed (for display only)
              try {
                const claimed = await contract.claimed(day, winnerAddress)
                console.log(`   - claimed(day=${day}, user=${winnerAddressLower}):`, claimed)
                claimedMap.set(winnerAddressLower, claimed)
              } catch (error: any) {
                console.log(`   - claimed() failed for ${winnerAddressLower}:`, error.message)
                claimedMap.set(winnerAddressLower, false)
              }
            } else {
              console.log(`   - getWinner(day=${day}, rank=${rank}): NO WINNER (zero address)`)
            }
          } catch (error: any) {
            console.log(`   - getWinner(day=${day}, rank=${rank}) ERROR:`, error.message)
            // If getWinner fails, continue to next rank
            continue
          }
        }
        
        console.log("🔍 [DAILY-RESULTS] Winners summary:")
        console.log("   - winnersList:", winnersList)
        console.log("   - claimedMap:", Array.from(claimedMap.entries()))
        
        setWinners(winnersList)
        setClaimedStatus(claimedMap)
      } catch (error) {
        console.error("Error fetching winners:", error)
      } finally {
        setLoadingWinners(false)
      }
    }
    
    fetchWinners()
  }, [day])
  
  // 4. Fetch canClaim and claimed status for ALL players in ranking (top 3 only)
  useEffect(() => {
    const fetchClaimsForAllPlayers = async () => {
      try {
        if (typeof window === "undefined" || !window.ethereum) {
          setCheckingClaims(false)
          return
        }
        
        // Only check top 3 players (only they can claim)
        const top3Players = dailyRanking.slice(0, 3)
        if (top3Players.length === 0) {
          setCheckingClaims(false)
          return
        }
        
        setCheckingClaims(true)
        const provider = new BrowserProvider(window.ethereum)
        const PRIZE_POOL_ABI = [
          "function canClaim(uint256 day, address user) view returns (bool)",
          "function claimed(uint256 day, address user) view returns (bool)",
        ]
        const PRIZE_POOL_ADDRESS = process.env.NEXT_PUBLIC_PRIZE_POOL_CONTRACT_ADDRESS || "0xeA0df70040E77a821b14770E53aa577A745930ae"
        
        if (PRIZE_POOL_ADDRESS === "0x0000000000000000000000000000000000000000") {
          setCheckingClaims(false)
          return
        }
        
        const contract = new Contract(PRIZE_POOL_ADDRESS, PRIZE_POOL_ABI, provider)
        const canClaimMapLocal = new Map<string, boolean>()
        const claimedMapLocal = new Map<string, boolean>()
        
        // Check canClaim and claimed for each top 3 player
        for (const player of top3Players) {
          try {
            // ✅ CORREÇÃO: Usar optional chaining para evitar erro quando player.address é undefined
            const playerAddress = player?.address?.toLowerCase?.() || ""
            if (!playerAddress) {
              console.warn(`⚠️ [DAILY-RESULTS] Player without address, skipping:`, player)
              continue
            }
            const canClaimResult = await contract.canClaim(day, playerAddress)
            const claimedResult = await contract.claimed(day, playerAddress)
            
            canClaimMapLocal.set(playerAddress, canClaimResult)
            claimedMapLocal.set(playerAddress, claimedResult)
            
            console.log(`🔍 [DAILY-RESULTS] Player ${playerAddress}: canClaim=${canClaimResult}, claimed=${claimedResult}`)
          } catch (error: any) {
            // ✅ CORREÇÃO: Usar optional chaining também no catch
            const playerAddress = player?.address?.toLowerCase?.() || ""
            if (playerAddress) {
              console.error(`Error checking claims for ${playerAddress}:`, error.message)
              canClaimMapLocal.set(playerAddress, false)
              claimedMapLocal.set(playerAddress, false)
            }
          }
        }
        
        setCanClaimMap(canClaimMapLocal)
        setClaimedStatus(claimedMapLocal)
      } catch (error) {
        console.error("Error fetching claims for all players:", error)
      } finally {
        setCheckingClaims(false)
      }
    }
    
    if (dailyRanking.length > 0) {
      fetchClaimsForAllPlayers()
    } else {
      setCheckingClaims(false)
    }
  }, [day, dailyRanking])

  const dateDisplay = date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }) + " (UTC)"

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
              Back
            </Button>
            <h1 className="text-2xl md:text-3xl font-bold text-amber-900">Daily Results</h1>
            <div className="w-32" />
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-r from-amber-100 to-amber-50 border-4 border-amber-900">
          <div className="flex items-center justify-center gap-2 text-amber-900">
            <Calendar className="w-5 h-5" />
            <span className="font-bold text-lg">{dateDisplay}</span>
          </div>
        </Card>

        {/* 1. Prizes - ALWAYS render */}
        <Card className="p-6 bg-gradient-to-r from-yellow-50 to-amber-50 border-4 border-yellow-400">
          <h2 className="text-2xl font-bold text-amber-900 mb-4">Prizes</h2>
          {loadingPrizeConfig || loadingWinners ? (
            <div className="text-center py-4">
              <p className="text-gray-600">Loading prizes...</p>
            </div>
          ) : prizeConfig ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map((rank) => {
                const winner = winners.find((w) => w.rank === rank)
                const winnerAddress = winner?.address || null
                const isClaimed = winnerAddress ? claimedStatus.get(winnerAddress) || false : false
                
                const prizeAmount = rank === 1 ? prizeConfig.first : rank === 2 ? prizeConfig.second : prizeConfig.third
                const medals = ["🥇", "🥈", "🥉"]
                const colors = [
                  "from-yellow-400 to-yellow-600",
                  "from-gray-300 to-gray-500",
                  "from-amber-600 to-amber-800",
                ]
                const borders = [
                  "border-yellow-300",
                  "border-gray-400",
                  "border-amber-500",
                ]
                
                return (
                  <div
                    key={rank}
                    className={cn(
                      "text-center p-4 bg-gradient-to-br rounded-lg border-4 text-white",
                      colors[rank - 1],
                      borders[rank - 1]
                    )}
                  >
                    <div className="text-5xl mb-2">{medals[rank - 1]}</div>
                    <p className="font-bold text-lg">
                      {rank === 1 ? "1st Place" : rank === 2 ? "2nd Place" : "3rd Place"}
                    </p>
                    <p className="text-2xl font-bold mb-3">{prizeAmount} USDC</p>
                    
                    {/* Winner address (for display only) */}
                    {winnerAddress ? (
                      <div className="mt-3 mb-3">
                        <p className="text-xs opacity-90 mb-1">Winner:</p>
                        <p className="font-mono text-sm break-all">{formatAddress(winnerAddress)}</p>
                        {/* Show "Already Claimed" if this winner has claimed (informative only) */}
                        {isClaimed && (
                          <div className="mt-2 px-2 py-1 bg-gray-700 rounded text-xs">
                            Already Claimed
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-gray-600">Failed to load prizes.</p>
            </div>
          )}
        </Card>

        {/* 2. Ranking - ALWAYS render (independent of winners/claim/prizepool) */}
        <Card className="bg-white/95 backdrop-blur border-4 border-amber-900 overflow-hidden">
          <div className="p-6">
            <h2 className="text-2xl font-bold text-amber-900 mb-4">Ranking</h2>
            {loadingRanking ? (
              <div className="text-center py-8">
                <p className="text-gray-600">Loading ranking...</p>
              </div>
            ) : dailyRanking.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-amber-600 text-white">
                    <tr>
                      <th className="px-4 py-3 text-left font-bold">Rank</th>
                      <th className="px-4 py-3 text-left font-bold">Player</th>
                      <th className="px-4 py-3 text-right font-bold">Score</th>
                      <th className="px-4 py-3 text-center font-bold">Golden</th>
                      <th className="px-4 py-3 text-center font-bold">Errors</th>
                      <th className="px-4 py-3 text-center font-bold">Prize</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-200">
                    {dailyRanking.map((player, index) => {
                      // ✅ CORREÇÃO: Usar optional chaining para evitar erro quando player.address ou currentPlayer são undefined
                      // ANTES: player.address.toLowerCase() quebrava se player.address fosse undefined
                      // PROBLEMA: Backend pode enviar jogador sem address, ou currentPlayer pode ainda não ter carregado
                      // AGORA: Usamos optional chaining e verificamos se ambos existem antes de comparar
                      const playerAddressLower = player?.address?.toLowerCase?.() || ""
                      const isCurrentPlayer =
                        playerAddressLower !== "" &&
                        currentPlayer?.toLowerCase?.() === playerAddressLower
                      const isTop3 = index < 3
                      const playerCanClaim = canClaimMap.get(playerAddressLower) || false
                      // ✅ CORREÇÃO: Verificar se playerAddressLower existe antes de usar no Map
                      const playerClaimed =
                        playerAddressLower ? claimedStatus.get(playerAddressLower) || false : false

                      return (
                        <tr
                          key={player.address}
                          className={cn(
                            "transition-colors",
                            isCurrentPlayer && "bg-amber-100 font-bold",
                            !isCurrentPlayer && "hover:bg-amber-50",
                            isTop3 && !isCurrentPlayer && "bg-amber-50/50",
                          )}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {isTop3 && (
                                <span className="text-xl">
                                  {index === 0 && "🥇"}
                                  {index === 1 && "🥈"}
                                  {index === 2 && "🥉"}
                                </span>
                              )}
                              <span className={cn(isTop3 && "font-bold text-amber-900")}>#{index + 1}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-amber-900">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm">{formatAddress(player.address)}</span>
                              {isCurrentPlayer && (
                                <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full">YOU</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right text-amber-900 font-bold">
                            {player.score.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {player.goldenMoles !== undefined ? (
                              <span className="inline-flex items-center gap-1">
                                <Star className="w-4 h-4 text-yellow-600" />
                                {player.goldenMoles}
                              </span>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td className="px-4 py-3 text-center text-red-600">
                            {player.errors !== undefined ? player.errors : "-"}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {isTop3 && (
                              <>
                                {checkingClaims ? (
                                  <span className="text-xs text-gray-500">Checking...</span>
                                ) : playerCanClaim ? (
                                  <Button
                                    onClick={async () => {
                                      if (isCurrentPlayer) {
                                        // ✅ LOG OBRIGATÓRIO antes do claim
                                        console.log("🔍 [DAILY-RESULTS] DAY USED FOR CLAIM:", day)
                                        console.log("   - selectedDay:", day)
                                        console.log("   - selectedDay type:", typeof day)
                                        console.log("   - date prop:", date.toISOString())
                                        console.log("   - currentPlayer:", currentPlayer)
                                        
                                        setClaimingPrize(true)
                                        try {
                                          // ✅ Passar selectedDay explicitamente (não recalcular no handleClaimPrize)
                                          await onClaimPrize(date, undefined, day)
                                          // Refresh claims after successful claim
                                          if (typeof window !== "undefined" && window.ethereum) {
                                            const provider = new BrowserProvider(window.ethereum)
                                            const PRIZE_POOL_ABI = [
                                              "function canClaim(uint256 day, address user) view returns (bool)",
                                              "function claimed(uint256 day, address user) view returns (bool)",
                                            ]
                                            const PRIZE_POOL_ADDRESS = process.env.NEXT_PUBLIC_PRIZE_POOL_CONTRACT_ADDRESS || "0xeA0df70040E77a821b14770E53aa577A745930ae"
                                            const contract = new Contract(PRIZE_POOL_ADDRESS, PRIZE_POOL_ABI, provider)
                                            
                                            const newCanClaim = await contract.canClaim(day, currentPlayer)
                                            const newClaimed = await contract.claimed(day, currentPlayer)
                                            
                                            setCanClaimMap((prev) => {
                                              const updated = new Map(prev)
                                              // ✅ CORREÇÃO: Usar optional chaining para evitar erro quando currentPlayer é undefined
                                              if (currentPlayer?.toLowerCase) {
                                                updated.set(currentPlayer.toLowerCase(), newCanClaim)
                                              }
                                              return updated
                                            })
                                            setClaimedStatus((prev) => {
                                              const updated = new Map(prev)
                                              // ✅ CORREÇÃO: Usar optional chaining para evitar erro quando currentPlayer é undefined
                                              if (currentPlayer?.toLowerCase) {
                                                updated.set(currentPlayer.toLowerCase(), newClaimed)
                                              }
                                              return updated
                                            })
                                          }
                                        } catch (error) {
                                          // Error is already handled in handleClaimPrize
                                        } finally {
                                          setClaimingPrize(false)
                                        }
                                      }
                                    }}
                                    disabled={claimingPrize || !isCurrentPlayer}
                                    className={cn(
                                      "text-xs px-3 py-1 bg-green-600 hover:bg-green-700 text-white",
                                      (!isCurrentPlayer || claimingPrize) && "opacity-50 cursor-not-allowed"
                                    )}
                                  >
                                    {claimingPrize ? "Processing..." : "Claim Prize"}
                                  </Button>
                                ) : playerClaimed ? (
                                  <span className="text-xs text-gray-600 bg-gray-100 px-3 py-1 rounded">Already claimed</span>
                                ) : null}
                              </>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-600">No players found for this day.</p>
              </div>
            )}
          </div>
        </Card>

      </div>
    </div>
  )
}
