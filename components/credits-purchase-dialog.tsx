"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useGameCredits } from "@/hooks/use-game-credits"
import { Loader2 } from "lucide-react"

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

interface CreditsPurchaseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  walletAddress: string
}

export function CreditsPurchaseDialog({ open, onOpenChange, walletAddress }: CreditsPurchaseDialogProps) {
  const { purchaseCredits, isLoading, refreshCredits } = useGameCredits(walletAddress)
  const [amount, setAmount] = useState("1000")
  const [error, setError] = useState<string | null>(null)

  const handlePurchase = async () => {
    playClickSound()
    const creditAmount = parseInt(amount)
    if (isNaN(creditAmount) || creditAmount <= 0) {
      setError("Please enter a valid amount")
      return
    }

    if (creditAmount > 5000) {
      setError("Maximum 5,000 credits per purchase")
      return
    }

    setError(null)
    try {
      await purchaseCredits(creditAmount)
      // ✅ CORREÇÃO: O purchaseCredits já atualiza o estado, mas vamos garantir com um refresh adicional
      // Aguardar um pouco mais para garantir que o contrato foi atualizado
      await new Promise(resolve => setTimeout(resolve, 3000))
      // Refresh credits novamente para garantir que está sincronizado
      await refreshCredits()
      // Aguardar mais um pouco e fazer um último refresh
      await new Promise(resolve => setTimeout(resolve, 1000))
      await refreshCredits()
      // Close dialog only after successful purchase and refresh
      onOpenChange(false)
      setAmount("1000")
    } catch (err: any) {
      // Check if user rejected the transaction
      if (err?.code === 4001 || err?.message?.includes("rejeitada") || err?.message?.includes("rejected") || err?.message?.includes("denied") || err?.name === "UserRejectedError") {
        setError("Transação rejeitada pelo usuário")
        // Close dialog when user rejects
        onOpenChange(false)
        return
      }
      setError(err.message || "Failed to purchase credits")
      // Don't close dialog on other errors
    }
  }

  const cost = (parseInt(amount) || 0) * 0.005 // 0.005 USDC per credit (1000 credits = 5 USDC)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Purchase Credits</DialogTitle>
          <DialogDescription>
            Buy credits to play the game. Each click costs 1 credit (0.005 USDC). 1000 credits = 5 USDC.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="amount">Number of Credits</Label>
            <Input
              id="amount"
              type="number"
              min="1"
              max="5000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={isLoading}
            />
            <p className="text-sm text-muted-foreground mt-1">
              Cost: {cost.toFixed(3)} USDC
            </p>
          </div>
          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}
          <div className="flex gap-2">
            <Button
              onClick={handlePurchase}
              disabled={isLoading}
              className="flex-1"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "Purchase Credits"
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                playClickSound()
                onOpenChange(false)
              }}
              disabled={isLoading}
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

