"use client"

import { useMemo, useState, useEffect } from "react"
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
  
  const [ranking, setRanking] = useState<Array<{ player: string; totalPoints: number }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const itemsPerPage = 50
  const maxPages = 10 // 500 players / 50 per page

  // Function to load ranking for a specific date
  const loadRanking = async (date: string) => {
    try {
      setLoading(true)
      setRanking([])
      setError(null)
      
      const url = `/api/getDailyRanking?date=${date}`
      console.log(`📅 [RANKING-SCREEN] Fetching ranking for date: ${date}, URL: ${url}`)
      const res = await fetch(url)
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${res.status}`)
      }
      
      const data = await res.json()
      console.log(`✅ [RANKING-SCREEN] Response received for ${date}:`, data)
      
      // Handle new format: { date: "YYYY-MM-DD", players: [...] }
      if (data && typeof data === 'object' && 'players' in data && Array.isArray(data.players)) {
        setRanking(data.players)
        // Update display date if provided by API
        if (data.date && data.date !== date) {
          setDisplayDate(data.date)
        } else {
          setDisplayDate(date)
        }
      } 
      // Fallback: handle old format (array directly) for backward compatibility
      else if (Array.isArray(data)) {
        setRanking(data)
        setDisplayDate(date)
      } 
      else {
        throw new Error('Invalid response format from API')
      }
    } catch (err) {
      console.error("Erro ao carregar ranking:", err)
      setError(err instanceof Error ? err.message : 'Erro ao buscar ranking')
      setRanking([])
    } finally {
      setLoading(false)
    }
  }

  // Load ranking on mount and when selectedDate prop changes
  useEffect(() => {
    const dateToLoad = selectedDate || getTodayDateString()
    setCurrentPage(1) // Reset page when date changes
    loadRanking(dateToLoad)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]) // Run on mount and when selectedDate changes

  const rankings = useMemo(() => {
    // Map the API response to the expected format
    return ranking.map((entry, index) => ({
      rank: index + 1,
      player: entry.player,
      score: entry.totalPoints,
      goldenMoles: 0, // Not available from API
      errors: 0, // Not available from API
    }))
  }, [ranking])

  // Pagination logic
  const paginatedRankings = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return rankings.slice(startIndex, endIndex)
  }, [rankings, currentPage])

  const totalPages = Math.min(maxPages, Math.ceil(rankings.length / itemsPerPage))

  const isTodaySelected = displayDate === getTodayDateString()

  // Handle calendar date selection
  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      // Convert to UTC date string (YYYY-MM-DD)
      const year = date.getUTCFullYear()
      const month = String(date.getUTCMonth() + 1).padStart(2, '0')
      const day = String(date.getUTCDate()).padStart(2, '0')
      const dateString = `${year}-${month}-${day}`
      
      setCurrentPage(1) // Reset to first page when changing date
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
                      setCurrentPage(1)
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
            {loading ? (
              <div className="text-center py-8">
                <p className="text-gray-600">Loading ranking...</p>
              </div>
            ) : error ? (
              <div className="text-center py-8">
                <p className="text-red-600">{error}</p>
              </div>
            ) : ranking.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600">No players found for this day.</p>
              </div>
            ) : (
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
