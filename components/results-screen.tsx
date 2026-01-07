"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Trophy, AlertCircle, Star } from "lucide-react"
import type { GameSession } from "@/app/page"
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

interface ResultsScreenProps {
  sessionData: GameSession
  onPlayAgain: () => void
  onViewRanking: (day?: number) => void
}

export function ResultsScreen({ sessionData, onPlayAgain, onViewRanking }: ResultsScreenProps) {
  console.log("📊 ResultsScreen rendered")
  console.log("   Session data:", sessionData)
  console.log("   Score:", sessionData.score)

  const handleShareOnX = () => {
    playClickSound()
    const message = `I've just scored ${sessionData.score} points on whARC-a-mole. Do you think you can you score more? https://wharc-a-mole.xyz #Arc #Web3 #Arctestnet #wharcamole`
    const encodedMessage = encodeURIComponent(message)
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodedMessage}`
    window.open(twitterUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="min-h-screen p-4 flex items-center justify-center">
      <Card className="w-full max-w-2xl p-8 bg-white/95 backdrop-blur border-4 border-amber-900 shadow-2xl">
        <div className="text-center space-y-6">
          <div className="inline-block p-4 bg-gradient-to-br from-amber-500 to-amber-700 rounded-full">
            <Trophy className="w-16 h-16 text-white" />
          </div>

          <div>
            <h2 className="text-4xl font-bold text-amber-900 mb-2">Game Finished!</h2>
            <p className="text-lg text-amber-700">Your result</p>
          </div>

          {/* Score Display - Destaque para os pontos */}
          <div className="bg-gradient-to-br from-amber-500 to-amber-700 rounded-2xl p-10 text-white shadow-2xl border-4 border-amber-600">
            <p className="text-2xl font-bold mb-4">You scored</p>
            <p className="text-8xl font-extrabold mb-3 drop-shadow-lg">{sessionData.score.toLocaleString()}</p>
            <p className="text-xl font-semibold">points</p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-amber-50 border-2 border-amber-200 rounded-lg p-4">
              <Star className="w-8 h-8 text-yellow-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-amber-900">{sessionData.goldenMolesHit}</p>
              <p className="text-sm text-amber-700">Golden Moles</p>
            </div>

            <div className="bg-amber-50 border-2 border-amber-200 rounded-lg p-4">
              <AlertCircle className="w-8 h-8 text-red-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-amber-900">{sessionData.errors}</p>
              <p className="text-sm text-amber-700">Errors</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <Button
              onClick={() => {
                playClickSound()
                onPlayAgain()
              }}
              size="lg"
              className="flex-1 bg-gradient-to-r from-green-500 to-green-700 hover:from-green-600 hover:to-green-800 text-white font-bold text-lg py-6"
            >
              Play Again
            </Button>

            <Button
              onClick={() => {
                playClickSound()
                const today = getDayId()
                onViewRanking(today) // envia o dia correto para o ranking
              }}
              size="lg"
              variant="outline"
              className="flex-1 border-2 border-amber-600 text-amber-900 hover:bg-amber-50 font-bold text-lg py-6 bg-transparent"
            >
              <Trophy className="mr-2 h-5 w-5" />
              View Ranking
            </Button>
          </div>

          {/* Share on X Button */}
          <div className="pt-2">
            <Button
              onClick={handleShareOnX}
              size="lg"
              variant="outline"
              className="w-full border-2 border-amber-600 text-amber-900 hover:bg-amber-50 font-bold text-lg py-6 bg-transparent"
            >
              <svg
                className="mr-2 h-5 w-5"
                fill="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              Share your results on X
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
