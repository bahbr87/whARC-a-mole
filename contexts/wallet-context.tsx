"use client"

import React, { createContext, useContext, ReactNode } from "react"
import { useArcWallet } from "@/hooks/use-arc-wallet"

interface WalletContextType {
  address: string | null
  isConnected: boolean
  connect: (customProvider?: any) => Promise<void>
  disconnect: () => Promise<void>
  sendUSDC: (to: string, amount: number) => Promise<string>
}

const WalletContext = createContext<WalletContextType | undefined>(undefined)

export function WalletProvider({ children }: { children: ReactNode }) {
  const wallet = useArcWallet()
  return <WalletContext.Provider value={wallet}>{children}</WalletContext.Provider>
}

export function useWallet() {
  const context = useContext(WalletContext)
  if (context === undefined) {
    throw new Error("useWallet must be used within a WalletProvider")
  }
  return context
}

