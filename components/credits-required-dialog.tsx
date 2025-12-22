"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Coins } from "lucide-react"

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

interface CreditsRequiredDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPurchaseCredits: () => void
}

export function CreditsRequiredDialog({ open, onOpenChange, onPurchaseCredits }: CreditsRequiredDialogProps) {
  const handlePurchase = () => {
    playClickSound()
    onOpenChange(false)
    onPurchaseCredits()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="w-6 h-6 text-amber-600" />
            Credits Required
          </DialogTitle>
          <DialogDescription>
            You need credits to play the game. Each click costs 1 credit (0.00001 USDC).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <p className="text-center text-amber-900">
            Purchase credits to start playing!
          </p>
          <div className="flex gap-2">
            <Button
              onClick={handlePurchase}
              className="flex-1 bg-gradient-to-r from-amber-500 to-amber-700 hover:from-amber-600 hover:to-amber-800 text-white font-bold"
            >
              <Coins className="w-5 h-5 mr-2" />
              Purchase Credits
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                playClickSound()
                onOpenChange(false)
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}







