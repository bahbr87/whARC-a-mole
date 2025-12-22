"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { BrowserProvider } from "ethers"
import { useArcWallet } from "./use-arc-wallet"

const CLICK_INTERVAL_MS = 120 // ~8 cliques / segundo (seguro p/ QuickNode)

export function useMetaTransactions() {
  const { address, isConnected } = useArcWallet()

  const queueRef = useRef<string[]>([])
  const processingRef = useRef(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const [pendingClicks, setPendingClicks] = useState(0)

  const processQueue = useCallback(async () => {
    if (processingRef.current) return
    if (queueRef.current.length === 0) return

    processingRef.current = true

    const sessionId = queueRef.current.shift()
    setPendingClicks(queueRef.current.length)

    try {
      if (!address || !window.ethereum) return

      const accounts = await window.ethereum.request({ method: "eth_accounts" })
      if (!accounts || accounts.length === 0) return

      await fetch("/api/process-meta-click", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          player: accounts[0],
          sessionId,
          clickCount: 1,
          authorized: true,
        }),
      })
    } catch (err) {
      console.error("❌ Click failed:", err)
    } finally {
      processingRef.current = false
    }
  }, [address])

  const startLoop = useCallback(() => {
    if (timerRef.current) return

    timerRef.current = setInterval(() => {
      processQueue()
    }, CLICK_INTERVAL_MS)
  }, [processQueue])

  const stopLoop = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const recordClick = useCallback(
    async (sessionId: string) => {
      if (!isConnected || !address) return

      queueRef.current.push(sessionId)
      setPendingClicks(queueRef.current.length)

      startLoop()
    },
    [isConnected, address, startLoop],
  )

  useEffect(() => {
    return () => stopLoop()
  }, [stopLoop])

  return {
    recordClick,
    pendingClicks,
    isAuthorized: true, // autorização já é tratada no backend
    authorize: async () => {},
    signAuthorization: async () => "",
  }
}
