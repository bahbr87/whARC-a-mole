"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Wallet, AlertCircle } from "lucide-react"
import { useWallet } from "@/contexts/wallet-context"
import { WalletSelector } from "@/components/wallet-selector"

interface WalletGateProps {
  onConnect: (username: string, address: string) => void
}

const STORAGE_KEY_PREFIX = "wharcamole_username_"

const getStoredUsername = (address: string | null): string => {
  if (!address || typeof window === "undefined") return ""
  try {
    const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${address.toLowerCase()}`)
    return stored || ""
  } catch {
    return ""
  }
}

const saveUsername = (address: string, username: string) => {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${address.toLowerCase()}`, username)
  } catch (error) {
    console.error("Error saving username:", error)
  }
}

export function WalletGate({ onConnect }: WalletGateProps) {
  const [username, setUsername] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [showWalletSelector, setShowWalletSelector] = useState(false)
  const { address, isConnected, connect, disconnect } = useWallet()

  // Always disconnect on mount to ensure fresh connection
  useEffect(() => {
    if (isConnected) {
      disconnect().catch(() => {
        // Ignore errors during disconnect
      })
    }
  }, []) // Only run once on mount

  // Load saved username when wallet connects
  useEffect(() => {
    if (isConnected && address) {
      const savedUsername = getStoredUsername(address)
      if (savedUsername) {
        setUsername(savedUsername)
      }
    } else {
      setUsername("")
    }
  }, [isConnected, address])

  const handleConnectWallet = () => {
    // If already connected, disconnect first
    if (isConnected) {
      disconnect().then(() => {
        setShowWalletSelector(true)
      })
    } else {
      setShowWalletSelector(true)
    }
  }

  const handleSelectWallet = async (provider: any) => {
    try {
      setError(null)
      await connect(provider)
      // If connection succeeds, the dialog will be handled by the wallet state
      // If user cancels, connect() returns silently and dialog is already closed
    } catch (err: any) {
      // Only show error for actual connection failures (not user cancellations)
      // User cancellations are handled silently by connect() returning early
      const errorMessage = err?.message || err?.toString() || "Failed to connect wallet"
      console.error("Wallet connection error:", err)
      setError(errorMessage)
    }
  }

  const handleDisconnect = async () => {
    await disconnect()
    setUsername("")
  }

  const handleSubmit = () => {
    if (username.trim() && address) {
      const trimmedUsername = username.trim()
      // Save username to localStorage
      saveUsername(address, trimmedUsername)
      onConnect(trimmedUsername, address)
    }
  }


  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-400 to-sky-300 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 bg-white/95 backdrop-blur border-4 border-amber-900 shadow-2xl">
        <div className="text-center space-y-6">
          {/* Logo */}
          <div className="flex items-center justify-center gap-4 mb-4">
            <Image 
              src="/imagem wharcamole2.png" 
              alt="Whac-a-mole logo" 
              width={256} 
              height={256}
              className="object-contain"
            />
          </div>

          <div className="space-y-2">
            <h1 className="text-4xl font-bold text-amber-900">whARC-a-mole</h1>
            <p className="text-lg text-amber-800">A blockchain arcade adventure</p>
          </div>

          {!isConnected ? (
            <>
              <div className="bg-amber-50 border-2 border-amber-200 rounded-lg p-4">
                <p className="text-sm text-amber-900 font-medium">Connect your Arc wallet to play</p>
                <p className="text-xs text-amber-700 mt-1">Make sure you're connected to Arc Testnet</p>
                <p className="text-xs text-amber-600 mt-1">⚠️ Note: Gas is paid in USDC on Arc Network</p>
              </div>

              {error && (
                <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <p className="text-sm text-red-900">{error}</p>
                </div>
              )}

              <Button
                onClick={handleConnectWallet}
                size="lg"
                className="w-full bg-gradient-to-r from-amber-500 to-amber-700 hover:from-amber-600 hover:to-amber-800 text-white font-bold text-lg py-6 shadow-lg"
              >
                <Wallet className="mr-2 h-5 w-5" />
                Connect Wallet
              </Button>
            </>
          ) : (
            <>
              <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-900 font-medium">Wallet Connected!</p>
                <p className="text-xs text-green-700 mt-1 font-mono">{address ? `${address.slice(0, 6)}...${address.slice(-4)}` : ""}</p>
                <div className="flex gap-2 mt-2">
                  <Button
                    onClick={handleDisconnect}
                    variant="outline"
                    size="sm"
                    className="flex-1 border-2 border-green-600 text-green-900 hover:bg-green-50"
                  >
                    Disconnect
                  </Button>
                  <Button
                    onClick={handleConnectWallet}
                    variant="outline"
                    size="sm"
                    className="flex-1 border-2 border-amber-600 text-amber-900 hover:bg-amber-50"
                  >
                    Change Wallet
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <label htmlFor="username" className="block text-sm font-medium text-amber-900 text-left">
                  Choose your username
                </label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full border-2 border-amber-300 focus:border-amber-500 text-center text-lg"
                  maxLength={20}
                />
              </div>

              <Button
                onClick={handleSubmit}
                disabled={!username.trim()}
                size="lg"
                className="w-full bg-gradient-to-r from-green-500 to-green-700 hover:from-green-600 hover:to-green-800 text-white font-bold text-lg py-6 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Start Playing
              </Button>
            </>
          )}
          {/* </CHANGE> */}

          <p className="text-xs text-amber-700">Hit the moles, avoid the cows, catch the golden mole!</p>
        </div>
      </Card>
      <WalletSelector
        open={showWalletSelector}
        onOpenChange={setShowWalletSelector}
        onSelectWallet={handleSelectWallet}
      />
    </div>
  )
}
