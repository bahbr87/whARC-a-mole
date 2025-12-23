"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { BrowserProvider, Contract, parseUnits, formatUnits } from "ethers"
import { useArcWallet } from "./use-arc-wallet"
import { USDC_CONTRACT_ADDRESS, ERC20_ABI, GAME_CREDITS_ADDRESS as GAME_CREDITS_ADDRESS_FROM_CONFIG } from "@/lib/arc-config"

// GameCredits ABI - includes events
const GAME_CREDITS_ABI = [
  "function purchaseCredits(uint256 creditAmount) external",
  "function consumeCreditsSelf(uint256 clickCount) external",
  "function getCredits(address player) external view returns (uint256)",
  "function calculatePurchaseCost(uint256 creditAmount) external pure returns (uint256)",
  "function credits(address) external view returns (uint256)",
  "function CREDIT_PRICE() external pure returns (uint256)",
  "function CLICK_COST() external pure returns (uint256)",
  // Events
  "event CreditsPurchased(address indexed player, uint256 amount, uint256 creditsReceived, uint256 totalCost)",
  "event CreditsConsumed(address indexed player, uint256 clickCount, uint256 creditsUsed, uint256 remainingCredits)",
] as const

// GameCredits contract address (from arc-config.ts, can be overridden by env var)
const GAME_CREDITS_ADDRESS = process.env.NEXT_PUBLIC_GAME_CREDITS_ADDRESS || GAME_CREDITS_ADDRESS_FROM_CONFIG || "0x0000000000000000000000000000000000000000"

interface UseGameCreditsReturn {
  credits: number
  purchaseCredits: (amount: number) => Promise<void>
  consumeCredits: (clickCount: number) => Promise<void>
  recordClick: (sessionId: string) => Promise<void>
  refreshCredits: () => Promise<void>
  getCreditsBalance: () => Promise<number>
  isLoading: boolean
}

export function useGameCredits(walletAddress?: string): UseGameCreditsReturn {
  const { provider, address: hookAddress, isConnected } = useArcWallet()
  // Use walletAddress if provided, otherwise fallback to hook address
  const address = walletAddress || hookAddress
  const [credits, setCredits] = useState<number>(0)
  const [isLoading, setIsLoading] = useState(false)
  const contractRef = useRef<Contract | null>(null)
  const providerRef = useRef<BrowserProvider | null>(null)
  const eventListenersRef = useRef<Array<() => void>>([])

  // Get fresh provider and contract - ALWAYS from window.ethereum (source of truth)
  const getProviderAndContract = useCallback(() => {
    if (typeof window === "undefined" || !window.ethereum) {
      return { provider: null, contract: null }
    }

    const freshProvider = new BrowserProvider(window.ethereum)
    const contract = new Contract(GAME_CREDITS_ADDRESS, GAME_CREDITS_ABI, freshProvider)
    
    providerRef.current = freshProvider
    contractRef.current = contract
    
    return { provider: freshProvider, contract }
  }, [])

  // Read balance DIRECTLY from contract - this is the source of truth
  const readCreditsFromContract = useCallback(async (playerAddress: string): Promise<number> => {
    console.log("📖 readCreditsFromContract called for:", playerAddress)
    
    if (!playerAddress || playerAddress === "0x0000000000000000000000000000000000000000") {
      console.log("❌ Invalid address")
      return 0
    }

    if (GAME_CREDITS_ADDRESS === "0x0000000000000000000000000000000000000000") {
      console.log("❌ GAME_CREDITS_ADDRESS is zero")
      return 0
    }

    try {
      if (typeof window === "undefined" || !window.ethereum) {
        console.log("❌ window.ethereum not available")
        return 0
      }

      // Always create fresh provider from window.ethereum (source of truth)
      const freshProvider = new BrowserProvider(window.ethereum)
      const contract = new Contract(GAME_CREDITS_ADDRESS, GAME_CREDITS_ABI, freshProvider)

      console.log("📞 Calling contract.credits(", playerAddress, ")")

      // Always read from contract - credits(address) is the source of truth
      let balance: bigint
      try {
        balance = await contract.credits(playerAddress)
        console.log("✅ Got balance from credits():", balance.toString(), "Number:", Number(balance))
      } catch (error: any) {
        console.log("⚠️ credits() failed, trying getCredits():", error.message)
        // Fallback to getCredits if credits() fails
        try {
          balance = await contract.getCredits(playerAddress)
          console.log("✅ Got balance from getCredits():", balance.toString(), "Number:", Number(balance))
        } catch (error2: any) {
          console.error("❌ Both methods failed:", error2.message)
          return 0
        }
      }

      // Convert bigint to number (credits are uint256, no decimals)
      const creditBalance = Number(balance)
      
      if (isNaN(creditBalance) || creditBalance < 0) {
        console.error("❌ Invalid credit balance:", creditBalance)
        return 0
      }

      console.log("✅ Final credit balance:", creditBalance)
      return creditBalance
    } catch (error: any) {
      console.error("❌ Error reading credits from contract:", error.message || error)
      return 0
    }
  }, [])

  // Refresh credits - ALWAYS reads from contract (source of truth)
  const refreshCredits = useCallback(async () => {
    // ✅ Use walletAddress directly (source of truth from GameScreen)
    if (!walletAddress || walletAddress.trim() === "") {
      console.log("🔄 refreshCredits: No walletAddress available, setting credits to 0")
      setCredits(0)
      return
    }

    console.log("🔄 refreshCredits: Reading from contract for address:", walletAddress)

    // Read directly from contract (source of truth)
    const balance = await readCreditsFromContract(walletAddress)
    
    console.log("🔄 refreshCredits: Balance from contract:", balance, "type:", typeof balance)
    
    // ALWAYS update state, even if value is the same (forces re-render)
    // ✅ Convert to number explicitly (guarantee type safety)
    const creditsNumber = Number(balance)
    console.log("🔄 refreshCredits: Updating state to:", creditsNumber)
    setCredits(creditsNumber)
    console.log("🔄 refreshCredits: State updated")
  }, [walletAddress, readCreditsFromContract])

  // Setup event listeners for CreditsPurchased and CreditsConsumed
  const setupEventListeners = useCallback(() => {
    // Clean up existing listeners
    eventListenersRef.current.forEach(remove => remove())
    eventListenersRef.current = []

    // ✅ Use walletAddress directly (source of truth from GameScreen)
    if (!walletAddress || walletAddress.trim() === "" || GAME_CREDITS_ADDRESS === "0x0000000000000000000000000000000000000000") {
      return
    }

    try {
      const { provider, contract } = getProviderAndContract()
      if (!provider || !contract) {
        return
      }

      // Listen for CreditsPurchased events for this player
      const filterPurchased = contract.filters.CreditsPurchased(walletAddress)
      const listenerPurchased = (player: string, amount: bigint, creditsReceived: bigint, totalCost: bigint) => {
        console.log("📢 CreditsPurchased event:", { player, amount: amount.toString(), creditsReceived: creditsReceived.toString() })
        // Refresh balance from contract after event
        refreshCredits()
      }
      contract.on(filterPurchased, listenerPurchased)

      // Listen for CreditsConsumed events for this player
      const filterConsumed = contract.filters.CreditsConsumed(walletAddress)
      const listenerConsumed = (player: string, clickCount: bigint, creditsUsed: bigint, remainingCredits: bigint) => {
        console.log("📢 CreditsConsumed event:", { player, clickCount: clickCount.toString(), remainingCredits: remainingCredits.toString() })
        // Refresh balance from contract after event
        refreshCredits()
      }
      contract.on(filterConsumed, listenerConsumed)

      // Store cleanup functions
      eventListenersRef.current.push(() => {
        contract.off(filterPurchased, listenerPurchased)
        contract.off(filterConsumed, listenerConsumed)
      })
    } catch (error: any) {
      console.error("Error setting up event listeners:", error.message || error)
    }
  }, [walletAddress, getProviderAndContract, refreshCredits])

  // Purchase credits - wait for tx.wait() before updating UI
  const purchaseCredits = useCallback(
    async (amount: number) => {
      if (GAME_CREDITS_ADDRESS === "0x0000000000000000000000000000000000000000") {
        throw new Error("GameCredits contract not deployed")
      }

      // ✅ ÚNICA validação permitida: apenas walletAddress
      if (!walletAddress || walletAddress.trim() === "") {
        throw new Error("Wallet not connected. Please connect your wallet first.")
      }

      setIsLoading(true)
      try {
        // Always get fresh provider from window.ethereum
        if (typeof window === "undefined" || !window.ethereum) {
          throw new Error("Wallet not connected. Please install and connect a Web3 wallet.")
        }

        // Use walletAddress directly (source of truth from GameScreen)
        const currentAddress = walletAddress

        const currentProvider = new BrowserProvider(window.ethereum)
        const signer = await currentProvider.getSigner()
        
        // Verify we're on the correct network
        const network = await currentProvider.getNetwork()
        const expectedChainId = 5042002
        
        if (Number(network.chainId) !== expectedChainId) {
          throw new Error(`Wrong network. Please switch to Arc Testnet (Chain ID: ${expectedChainId})`)
        }
        
        // Check USDC balance - read decimals dynamically from contract
        const USDC_ABI = [
          "function balanceOf(address) view returns (uint256)",
          "function decimals() view returns (uint8)",
        ]
        const usdcContract = new Contract(USDC_CONTRACT_ADDRESS, USDC_ABI, signer)
        
        // ✅ All contract values are BigInt
        const balanceRaw: bigint = await usdcContract.balanceOf(currentAddress)
        const decimals = await usdcContract.decimals()
        
        // ✅ Convert to Number ONLY for UI/error messages (after all BigInt comparisons)
        const balanceAmount = Number(balanceRaw) / 10 ** decimals
        
        if (balanceAmount === 0) {
          throw new Error(`No USDC found. You need USDC tokens (contract: ${USDC_CONTRACT_ADDRESS}) to purchase credits.`)
        }
        
        // Calculate cost - contract returns BigInt
        const contract = new Contract(GAME_CREDITS_ADDRESS, GAME_CREDITS_ABI, signer)
        const costRaw: bigint = await contract.calculatePurchaseCost(amount)
        
        // ✅ Convert to Number ONLY for UI/error messages (after all BigInt comparisons)
        const costAmount = Number(costRaw) / 10 ** decimals
        
        // ✅ Check if user has enough USDC - comparison between BigInt only
        if (balanceRaw < costRaw) {
          throw new Error(`Insufficient USDC balance. You have ${balanceAmount.toFixed(decimals)} USDC but need ${costAmount.toFixed(decimals)} USDC.`)
        }

        // Check and approve USDC spending - contract returns BigInt
        const allowanceRaw: bigint = await usdcContract.allowance(currentAddress, GAME_CREDITS_ADDRESS)

        // ✅ Comparison between BigInt only
        if (allowanceRaw < costRaw) {
          // Approve 1000 USDC (using the decimals from contract)
          // Calculate 10^decimals using multiplication
          let decimalsMultiplier = BigInt(1)
          for (let i = 0; i < Number(decimals); i++) {
            decimalsMultiplier = decimalsMultiplier * BigInt(10)
          }
          const approveAmount = BigInt(1000) * decimalsMultiplier
          const approveTx = await usdcContract.approve(GAME_CREDITS_ADDRESS, approveAmount)
          const approveReceipt = await approveTx.wait()
          
          if (!approveReceipt || approveReceipt.status !== 1) {
            throw new Error("USDC approval failed. Please try again.")
          }
        }

        // Purchase credits
        const tx = await contract.purchaseCredits(amount)
        
        // CRITICAL: Wait for transaction to be mined before updating UI
        const receipt = await tx.wait()
        
        if (!receipt || receipt.status !== 1) {
          throw new Error("Transaction failed. Please try again.")
        }

        // After tx.wait(), read balance DIRECTLY from contract (source of truth)
        // Don't rely on events or state - always read from contract
        await new Promise(resolve => setTimeout(resolve, 1000)) // Small delay for indexing
        const newBalance = await readCreditsFromContract(currentAddress)
        
        // ✅ Update UI with value from contract (convert to number explicitly)
        setCredits(Number(newBalance))
        
        console.log("✅ Credits purchased. New balance from contract:", newBalance)
      } catch (error: any) {
        console.error("Error purchasing credits:", error)
        // Check if user rejected the transaction (code 4001)
        if (error?.code === 4001 || error?.message?.includes("rejected") || error?.message?.includes("denied") || error?.message?.includes("User rejected")) {
          const rejectionError = new Error("Transação rejeitada pelo usuário")
          rejectionError.name = "UserRejectedError"
          throw rejectionError
        }
        throw error
      } finally {
        setIsLoading(false)
      }
    },
    [walletAddress, readCreditsFromContract],
  )

  // Consume credits (for manual consumption if needed)
  const consumeCredits = useCallback(
    async (clickCount: number) => {
      // ✅ ÚNICA validação permitida: apenas walletAddress
      if (!walletAddress || walletAddress.trim() === "") {
        throw new Error("Wallet not connected")
      }

      if (GAME_CREDITS_ADDRESS === "0x0000000000000000000000000000000000000000") {
        return
      }

      try {
        if (typeof window === "undefined" || !window.ethereum) {
          throw new Error("Wallet not available")
        }

        const provider = new BrowserProvider(window.ethereum)
        const signer = await provider.getSigner()
        const contract = new Contract(GAME_CREDITS_ADDRESS, GAME_CREDITS_ABI, signer)

        const tx = await contract.consumeCreditsSelf(clickCount)
        
        // Wait for transaction before updating
        await tx.wait()
        
        // Read balance from contract after consumption
        const newBalance = await readCreditsFromContract(walletAddress)
        // ✅ Convert to number explicitly (guarantee type safety)
        setCredits(Number(newBalance))
      } catch (error: any) {
        console.error("Error consuming credits:", error)
        // Check if user rejected the transaction (code 4001)
        if (error?.code === 4001 || error?.message?.includes("rejected") || error?.message?.includes("denied") || error?.message?.includes("User rejected")) {
          const rejectionError = new Error("Transação rejeitada pelo usuário")
          rejectionError.name = "UserRejectedError"
          throw rejectionError
        }
        throw error
      }
    },
    [walletAddress, readCreditsFromContract],
  )

  // Record a click (for compatibility - actual consumption happens via backend)
  const recordClick = useCallback(
    async (sessionId: string) => {
      // This is handled by the backend via meta-transactions
      // Just refresh credits after a delay
      if (walletAddress && walletAddress.trim() !== "") {
        setTimeout(() => {
          refreshCredits()
        }, 2000)
      }
    },
    [walletAddress, refreshCredits],
  )

  // Get credits balance directly from contract (source of truth)
  const getCreditsBalance = useCallback(async (): Promise<number> => {
    if (!walletAddress || walletAddress.trim() === "") {
      return 0
    }

    // Always read from contract (don't check isConnected)
    const balance = await readCreditsFromContract(walletAddress)
    // ✅ Convert to number explicitly (guarantee type safety)
    return Number(balance)
  }, [walletAddress, readCreditsFromContract])

  // Effect: Setup event listeners when walletAddress is available
  useEffect(() => {
    if (walletAddress && walletAddress.trim() !== "") {
      setupEventListeners()
    }

    return () => {
      // Cleanup event listeners
      eventListenersRef.current.forEach(remove => remove())
      eventListenersRef.current = []
    }
  }, [walletAddress, setupEventListeners])

  // Effect: Refresh credits when walletAddress changes OR on mount
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null
    
    // ✅ Use walletAddress directly (source of truth from GameScreen)
    if (walletAddress && walletAddress.trim() !== "") {
      console.log("🔄 useEffect: walletAddress exists, refreshing credits immediately")
      // Read balance from contract immediately
      refreshCredits()
      
      // Poll every 3 seconds to keep in sync (backup to events)
      interval = setInterval(() => {
        console.log("🔄 Polling credits from contract...")
        refreshCredits()
      }, 3000)
    } else {
      // No walletAddress - set to 0
      console.log("🔄 useEffect: No walletAddress available, setting credits to 0")
      setCredits(0)
    }
    
    // Cleanup function
    return () => {
      if (interval) {
        console.log("🧹 Cleaning up polling interval")
        clearInterval(interval)
      }
    }
  }, [walletAddress, refreshCredits])

  return {
    credits,
    purchaseCredits,
    consumeCredits,
    recordClick,
    refreshCredits,
    getCreditsBalance,
    isLoading,
  }
}
