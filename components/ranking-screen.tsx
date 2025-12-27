"use client"

import { useMemo, useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { ArrowLeft, Trophy, Star, Calendar, ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import type { RankingEntry } from "@/app/page"

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

// Type for player data from API
type Player = {
  player: string
  totalPoints: number
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
  const [currentPage, setCurrentPage] = useState(1)
  const [showCalendarDialog, setShowCalendarDialog] = useState(false)
  const [calendarSelectedDate, setCalendarSelectedDate] = useState<Date | undefined>(undefined)
  
  // Initialize displayDate with selectedDate prop or default to today
  const [displayDate, setDisplayDate] = useState(() => selectedDate || getTodayDateString())
  
  // ✅ CORREÇÃO: Usar apenas um estado principal para armazenar os resultados
  // ANTES: Havia múltiplos estados (ranking, rankings via useMemo, paginatedRankings)
  // PROBLEMA: O useMemo que criava 'rankings' podia falhar silenciosamente, deixando rankings vazio
  // mesmo quando ranking tinha dados. A renderização verificava rankings.length mas usava paginatedRankings.
  // AGORA: Usamos apenas 'ranking' como fonte única da verdade. Os valores derivados (paginatedRankings)
  // são calculados diretamente de 'ranking' quando necessário.
  const [ranking, setRanking] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const itemsPerPage = 50
  const maxPages = 10 // 500 players / 50 per page

  // Function to load ranking for a specific date
  const loadRanking = useCallback(async (date: string) => {
    console.log(`🚀 [RANKING-SCREEN] loadRanking called with date: ${date}`)
    
    try {
      setLoading(true)
      setError(null)
      // ✅ CORREÇÃO: NÃO limpar ranking aqui - isso causava flash de "No players" antes dos dados chegarem
      // O ranking só será atualizado quando os dados chegarem com sucesso
      
      const url = `/api/getDailyRanking?date=${date}`
      console.log(`📅 [RANKING-SCREEN] Fetching ranking for date: ${date}, URL: ${url}`)
      const res = await fetch(url)
      console.log(`📅 [RANKING-SCREEN] Fetch response status: ${res.status}, ok: ${res.ok}`)
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${res.status}`)
      }
      
      const data = await res.json()
      console.log(`✅ [RANKING-SCREEN] Response received for ${date}:`, data)
      console.log(`✅ [RANKING-SCREEN] players is array:`, Array.isArray(data?.players))
      console.log(`✅ [RANKING-SCREEN] players length:`, data?.players?.length)
      
      // ✅ CORREÇÃO: Sempre usar setRanking(data.players) diretamente após o fetch
      // ANTES: Havia lógica complexa com criação de novo array, verificações extras, etc.
      // PROBLEMA: Isso podia causar problemas de referência ou timing que faziam o estado não atualizar
      // AGORA: Atualizamos diretamente com os dados da API, garantindo que o estado seja atualizado
      if (data && typeof data === 'object' && 'players' in data && Array.isArray(data.players)) {
        console.log(`✅ [RANKING-SCREEN] Setting ranking with ${data.players.length} players`)
        console.log(`✅ [RANKING-SCREEN] Players data:`, JSON.stringify(data.players, null, 2))
        
        // ✅ CORREÇÃO: setRanking(data.players) diretamente - sem criar novo array ou verificações extras
        // O React detecta a mudança automaticamente se o array for diferente
        setRanking(data.players)
        console.log(`✅ [RANKING-SCREEN] setRanking called with ${data.players.length} players`)
        
        // Update display date if provided by API
        if (data.date && data.date !== date) {
          setDisplayDate(data.date)
        } else {
          setDisplayDate(date)
        }
        console.log(`✅ [RANKING-SCREEN] Ranking state updated, displayDate: ${data.date || date}`)
      } 
      // Fallback: handle old format (array directly) for backward compatibility
      else if (Array.isArray(data)) {
        console.log(`✅ [RANKING-SCREEN] Using fallback format, setting ranking with ${data.length} items`)
        setRanking(data)
        setDisplayDate(date)
      } 
      else {
        console.error(`❌ [RANKING-SCREEN] Invalid response format:`, data)
        throw new Error('Invalid response format from API')
      }
    } catch (err) {
      console.error("❌ [RANKING-SCREEN] Erro ao carregar ranking:", err)
      setError(err instanceof Error ? err.message : 'Erro ao buscar ranking')
      // ✅ CORREÇÃO: Só limpar ranking em caso de erro - não limpar durante o loading
      setRanking([])
    } finally {
      console.log(`🏁 [RANKING-SCREEN] loadRanking finished - setting loading to false`)
      setLoading(false)
    }
  }, [])

  // ✅ CORREÇÃO: Removido useEffect que monitorava ranking - não é necessário e pode causar re-renders desnecessários

  // Load ranking on mount and when selectedDate prop changes
  useEffect(() => {
    const today = getTodayDateString()
    const dateToLoad =
      selectedDate && selectedDate.trim() !== "" ? selectedDate : today

    console.log(
      "[RANKING-SCREEN] useEffect loading ranking for date:",
      dateToLoad
    )

    setCurrentPage(1)

    // Não atualize displayDate aqui — o loadRanking já faz isso
    loadRanking(dateToLoad).catch((err) => {
      console.error(
        "[RANKING-SCREEN] loadRanking promise rejected inside useEffect:",
        err
      )
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate])

  // ✅ CORREÇÃO: Removido useMemo para 'rankings' - não é mais necessário
  // ANTES: rankings era um useMemo que mapeava ranking para um formato diferente
  // PROBLEMA: Se o mapeamento falhasse, rankings ficava vazio mesmo com ranking cheio
  // AGORA: Fazemos o mapeamento diretamente na renderização, usando ranking como fonte única

  // ✅ CORREÇÃO: Paginação calculada diretamente de 'ranking'
  // Mantemos paginatedRankings como useMemo para performance, mas derivado diretamente de 'ranking'
  const paginatedRankings = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    
    // ✅ CORREÇÃO: Mapear ranking diretamente aqui, sem criar estado intermediário
    // Isso garante que os dados sempre fluam corretamente de ranking para a renderização
    const mapped = ranking.map((entry, index) => ({
      rank: index + 1,
      player: entry.player,
      score: entry.totalPoints || 0,
      goldenMoles: 0, // Not available from API
      errors: 0, // Not available from API
    }))
    
    return mapped.slice(startIndex, endIndex)
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
      
      console.log(`📅 [RANKING-SCREEN] Calendar date selected: ${dateString}`)
      
      setCurrentPage(1) // Reset to first page when changing date
      setDisplayDate(dateString) // Update display date immediately
      setShowCalendarDialog(false)
      setCalendarSelectedDate(undefined)
      
      // Load ranking immediately for the selected date
      loadRanking(dateString)
      
      // If onViewDailyResults is provided, call it with the UTC date
      if (onViewDailyResults) {
        const utcDate = new Date(Date.UTC(year, date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0))
        onViewDailyResults(utcDate)
      }
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
                <p className="text-xs text-gray-400 mt-2">
                  Debug: ranking.length = {ranking.length}, loading = {String(loading)}, error = {error || 'null'}
                </p>
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
                    <th className="px-4 py-3 text-right font-bold">Score</th>
                    <th className="px-4 py-3 text-center font-bold">Golden</th>
                    <th className="px-4 py-3 text-center font-bold">Errors</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-200">
                  {paginatedRankings.map((player, index) => {
                    const globalIndex = (currentPage - 1) * itemsPerPage + index
                    const isCurrentPlayer = player.player.toLowerCase() === currentPlayer?.toLowerCase()
                    const isTop3 = globalIndex < 3

                    return (
                      <tr
                        key={player.player}
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
                                {globalIndex === 0 && "🥇"}
                                {globalIndex === 1 && "🥈"}
                                {globalIndex === 2 && "🥉"}
                              </span>
                            )}
                            <span className={cn(isTop3 && "font-bold text-amber-900")}>#{player.rank}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-amber-900">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm">{formatAddress(player.player)}</span>
                            {isCurrentPlayer && (
                              <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full">YOU</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-amber-900 font-bold">{player.score.toLocaleString()}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center gap-1">
                            <Star className="w-4 h-4 text-yellow-600" />
                            {player.goldenMoles}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-red-600">{player.errors}</td>
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
