"use client"

import { useState, useCallback, useRef } from "react"
import { BrowserProvider, Contract, parseUnits, formatUnits, ethers } from "ethers"
import { useArcWallet } from "./use-arc-wallet"
import { USDC_CONTRACT_ADDRESS, ERC20_ABI } from "@/lib/arc-config"

// GameClickTracker ABI (minimal for our needs)
const GAME_CLICK_TRACKER_ABI = [
  "function recordClicks(bytes32 sessionId, uint256 clickCount) external",
  "function startGameSession(bytes32 sessionId) external",
  "function completeGameSession(bytes32 sessionId) external",
  "function calculateFee(uint256 clickCount) external pure returns (uint256)",
  "function CLICK_FEE() external pure returns (uint256)",
]

// This will be set after contract deployment
const GAME_CLICK_TRACKER_ADDRESS = process.env.NEXT_PUBLIC_GAME_CLICK_TRACKER_ADDRESS || "0x0000000000000000000000000000000000000000"

interface UseGameClicksReturn {
  recordClick: (sessionId: string) => Promise<void>
  batchRecordClicks: (sessionId: string, clickCount: number) => Promise<void>
  startSession: (sessionId: string) => Promise<void>
  completeSession: (sessionId: string) => Promise<void>
  pendingClicks: number
  clearPendingClicks: () => void
}

export function useGameClicks(): UseGameClicksReturn {
  const { provider, address, isConnected } = useArcWallet()
  const [pendingClicks, setPendingClicks] = useState(0)
  const clickQueueRef = useRef<Array<{ sessionId: string; timestamp: number }>>([])
  const batchTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Record a single click (adds to queue, processes in batch)
  const recordClick = useCallback(
    async (sessionId: string) => {
      if (!isConnected || !address) {
        throw new Error("Wallet not connected")
      }

      // Add to queue
      clickQueueRef.current.push({
        sessionId,
        timestamp: Date.now(),
      })
      setPendingClicks(clickQueueRef.current.length)

      // Process batch if queue is large enough or after delay
      if (clickQueueRef.current.length >= 10) {
        // Process immediately if 10+ clicks
        await processBatch(sessionId)
      } else {
        // Process after 2 seconds of inactivity
        if (batchTimerRef.current) {
          clearTimeout(batchTimerRef.current)
        }
        batchTimerRef.current = setTimeout(() => {
          processBatch(sessionId)
        }, 2000)
      }
    },
    [isConnected, address, provider],
  )

  // Process queued clicks in a single transaction
  const processBatch = useCallback(
    async (sessionId: string) => {
      if (!provider || !address || clickQueueRef.current.length === 0) return

      if (batchTimerRef.current) {
        clearTimeout(batchTimerRef.current)
        batchTimerRef.current = null
      }

      // Count clicks for this session
      const sessionClicks = clickQueueRef.current.filter((c) => c.sessionId === sessionId).length

      if (sessionClicks === 0) {
        clickQueueRef.current = []
        setPendingClicks(0)
        return
      }

      try {
        await batchRecordClicks(sessionId, sessionClicks)
        // Remove processed clicks from queue
        clickQueueRef.current = clickQueueRef.current.filter((c) => c.sessionId !== sessionId)
        setPendingClicks(clickQueueRef.current.length)
      } catch (error) {
        console.error("Error processing click batch:", error)
        // Keep clicks in queue for retry
      }
    },
    [provider, address],
  )

  // Record multiple clicks in a single transaction
  const batchRecordClicks = useCallback(
    async (sessionId: string, clickCount: number) => {
      if (!provider || !address) {
        throw new Error("Wallet not connected")
      }

      if (GAME_CLICK_TRACKER_ADDRESS === "0x0000000000000000000000000000000000000000") {
        // Contract not deployed, skip blockchain transaction
        console.warn("GameClickTracker not deployed, skipping blockchain transaction")
        return
      }

      try {
        const signer = await provider.getSigner()
        const contract = new Contract(GAME_CLICK_TRACKER_ADDRESS, GAME_CLICK_TRACKER_ABI, signer)

        // Calculate fee
        const fee = await contract.calculateFee(clickCount)
        const feeAmount = Number(formatUnits(fee, 6)) // USDC has 6 decimals

        // Approve USDC spending if needed
        const usdcContract = new Contract(USDC_CONTRACT_ADDRESS, ERC20_ABI, signer)
        const allowance = await usdcContract.allowance(address, GAME_CLICK_TRACKER_ADDRESS)

        if (allowance < fee) {
          // Approve more than needed to avoid repeated approvals
          const approveAmount = parseUnits("1", 6) // Approve 1 USDC
          const approveTx = await usdcContract.approve(GAME_CLICK_TRACKER_ADDRESS, approveAmount)
          await approveTx.wait()
        }

        // Convert sessionId to bytes32
        const sessionIdBytes32 = ethers.zeroPadValue(ethers.toUtf8Bytes(sessionId), 32)

        // Record clicks (this will trigger wallet popup for approval)
        const tx = await contract.recordClicks(sessionIdBytes32, clickCount)
        await tx.wait()

        console.log(`Recorded ${clickCount} clicks for session ${sessionId}, fee: ${feeAmount} USDC`)
      } catch (error) {
        console.error("Error recording clicks:", error)
        throw error
      }
    },
    [provider, address],
  )

  const startSession = useCallback(
    async (sessionId: string) => {
      if (!provider || !address) return

      if (GAME_CLICK_TRACKER_ADDRESS === "0x0000000000000000000000000000000000000000") {
        return
      }

      try {
        const signer = await provider.getSigner()
        const contract = new Contract(GAME_CLICK_TRACKER_ADDRESS, GAME_CLICK_TRACKER_ABI, signer)
        const sessionIdBytes32 = ethers.zeroPadValue(ethers.toUtf8Bytes(sessionId), 32)

        const tx = await contract.startGameSession(sessionIdBytes32)
        await tx.wait()
      } catch (error) {
        console.error("Error starting session:", error)
      }
    },
    [provider, address],
  )

  const completeSession = useCallback(
    async (sessionId: string) => {
      if (!provider || !address) return

      // Process any remaining clicks in queue
      if (clickQueueRef.current.length > 0) {
        await processBatch(sessionId)
      }

      if (GAME_CLICK_TRACKER_ADDRESS === "0x0000000000000000000000000000000000000000") {
        return
      }

      try {
        const signer = await provider.getSigner()
        const contract = new Contract(GAME_CLICK_TRACKER_ADDRESS, GAME_CLICK_TRACKER_ABI, signer)
        const sessionIdBytes32 = ethers.zeroPadValue(ethers.toUtf8Bytes(sessionId), 32)

        const tx = await contract.completeGameSession(sessionIdBytes32)
        await tx.wait()
      } catch (error) {
        console.error("Error completing session:", error)
      }
    },
    [provider, address, processBatch],
  )

  const clearPendingClicks = useCallback(() => {
    clickQueueRef.current = []
    setPendingClicks(0)
    if (batchTimerRef.current) {
      clearTimeout(batchTimerRef.current)
      batchTimerRef.current = null
    }
  }, [])

  return {
    recordClick,
    batchRecordClicks,
    startSession,
    completeSession,
    pendingClicks,
    clearPendingClicks,
  }
}

