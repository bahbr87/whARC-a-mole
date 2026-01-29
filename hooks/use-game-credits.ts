"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { BrowserProvider, Contract, parseUnits, formatUnits } from "ethers"
import { useArcWallet } from "./use-arc-wallet"
import { USDC_CONTRACT_ADDRESS, ERC20_ABI, GAME_CREDITS_ADDRESS as GAME_CREDITS_ADDRESS_FROM_CONFIG } from "@/lib/arc-config"

// GameCredits ABI - includes events
const GAME_CREDITS_ABI = [
  "function purchaseCredits(uint256 creditAmount) external",
  "function purchaseCreditsWithPrizePool(uint256 creditAmount) external",
  "function consumeCreditsSelf(uint256 clickCount) external",
  "function getCredits(address player) external view returns (uint256)",
  "function calculatePurchaseCost(uint256 creditAmount) external pure returns (uint256)",
  "function credits(address) external view returns (uint256)",
  "function CREDIT_PRICE() external pure returns (uint256)",
  "function CLICK_COST() external pure returns (uint256)",
  "function prizePoolAddress() external view returns (address)",
  // Events
  "event CreditsPurchased(address indexed player, uint256 amount, uint256 creditsReceived, uint256 totalCost)",
  "event CreditsPurchasedWithPrizePool(address indexed player, uint256 usdcAmount, uint256 creditsReceived, uint256 totalCredits, address indexed prizePool)",
  "event CreditsConsumed(address indexed player, uint256 clickCount, uint256 creditsUsed, uint256 remainingCredits)",
] as const

// GameCredits contract address (from arc-config.ts, can be overridden by env var)
const GAME_CREDITS_ADDRESS = process.env.NEXT_PUBLIC_GAME_CREDITS_ADDRESS || GAME_CREDITS_ADDRESS_FROM_CONFIG || "0x0000000000000000000000000000000000000000"

// Log contract address on module load (for debugging)
if (typeof window !== "undefined") {
  console.log("🔧 [useGameCredits] Contract address configuration:")
  console.log("   NEXT_PUBLIC_GAME_CREDITS_ADDRESS:", process.env.NEXT_PUBLIC_GAME_CREDITS_ADDRESS || "NOT SET")
  console.log("   GAME_CREDITS_ADDRESS_FROM_CONFIG:", GAME_CREDITS_ADDRESS_FROM_CONFIG)
  console.log("   Final GAME_CREDITS_ADDRESS:", GAME_CREDITS_ADDRESS)
}

interface UseGameCreditsReturn {
  credits: number
  purchaseCredits: (amount: number) => Promise<void>
  consumeCredits: (clickCount: number) => Promise<void>
  recordClick: (sessionId: string) => Promise<void>
  refreshCredits: () => Promise<void>
  getCreditsBalance: () => Promise<number>
  decrementCreditsOptimistic: (clickCount: number) => void
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
    console.log("📖 [readCreditsFromContract] Called for:", playerAddress)
    console.log("📖 [readCreditsFromContract] Using contract:", GAME_CREDITS_ADDRESS)
    
    if (!playerAddress || playerAddress === "0x0000000000000000000000000000000000000000") {
      console.log("❌ [readCreditsFromContract] Invalid address")
      return 0
    }

    if (GAME_CREDITS_ADDRESS === "0x0000000000000000000000000000000000000000") {
      console.log("❌ [readCreditsFromContract] GAME_CREDITS_ADDRESS is zero")
      console.log("❌ [readCreditsFromContract] Check NEXT_PUBLIC_GAME_CREDITS_ADDRESS in .env.local")
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
        const balanceNumber = Number(balance)
        console.log("✅ Got balance from credits():", balance.toString(), "Number:", balanceNumber)
        
        // ✅ CORREÇÃO: Verificar se o valor está correto
        if (balanceNumber < 0 || isNaN(balanceNumber)) {
          console.error("❌ Invalid balance value:", balanceNumber)
          return 0
        }
      } catch (error: any) {
        console.log("⚠️ credits() failed, trying getCredits():", error.message)
        // Fallback to getCredits if credits() fails
        try {
          balance = await contract.getCredits(playerAddress)
          const balanceNumber = Number(balance)
          console.log("✅ Got balance from getCredits():", balance.toString(), "Number:", balanceNumber)
          
          // ✅ CORREÇÃO: Verificar se o valor está correto
          if (balanceNumber < 0 || isNaN(balanceNumber)) {
            console.error("❌ Invalid balance value:", balanceNumber)
            return 0
          }
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
    
    // ✅ CORREÇÃO: Sempre atualizar o estado, mesmo que o valor seja o mesmo
    // Isso força um re-render e garante que a UI está sincronizada
    const creditsNumber = Number(balance)
    console.log("🔄 refreshCredits: Updating state to:", creditsNumber)
    
    // ✅ CORREÇÃO: Usar função de atualização para garantir que o estado seja atualizado
    setCredits(prevCredits => {
      if (prevCredits !== creditsNumber) {
        console.log("🔄 refreshCredits: State changed from", prevCredits, "to", creditsNumber)
      } else {
        console.log("🔄 refreshCredits: State unchanged, but forcing update")
      }
      return creditsNumber
    })
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

      // Listen for CreditsPurchased events for this player (old function)
      const filterPurchased = contract.filters.CreditsPurchased(walletAddress)
      const listenerPurchased = (player: string, amount: bigint, creditsReceived: bigint, totalCost: bigint) => {
        console.log("📢 CreditsPurchased event:", { player, amount: amount.toString(), creditsReceived: creditsReceived.toString() })
        // Refresh balance from contract after event
        refreshCredits()
      }
      contract.on(filterPurchased, listenerPurchased)

      // Listen for CreditsPurchasedWithPrizePool events for this player (new function)
      const filterPurchasedWithPrizePool = contract.filters.CreditsPurchasedWithPrizePool(walletAddress)
      const listenerPurchasedWithPrizePool = (player: string, usdcAmount: bigint, creditsReceived: bigint, totalCredits: bigint, prizePool: string) => {
        console.log("📢 CreditsPurchasedWithPrizePool event:", { 
          player, 
          usdcAmount: usdcAmount.toString(), 
          creditsReceived: creditsReceived.toString(),
          totalCredits: totalCredits.toString(),
          prizePool
        })
        // Refresh balance from contract after event
        refreshCredits()
      }
      contract.on(filterPurchasedWithPrizePool, listenerPurchasedWithPrizePool)

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
        contract.off(filterPurchasedWithPrizePool, listenerPurchasedWithPrizePool)
        contract.off(filterConsumed, listenerConsumed)
      })
    } catch (error: any) {
      console.error("Error setting up event listeners:", error.message || error)
    }
  }, [walletAddress, getProviderAndContract, refreshCredits])

  // Purchase credits - wait for tx.wait() before updating UI
  // Uses purchaseCreditsWithPrizePool to send USDC directly to PrizePool
  const purchaseCredits = useCallback(
    async (amount: number) => {
      console.log("🛒 [purchaseCredits] Starting purchase process...")
      console.log("🛒 [purchaseCredits] Amount:", amount)
      console.log("🛒 [purchaseCredits] GameCredits Address:", GAME_CREDITS_ADDRESS)

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
        console.log("🛒 [purchaseCredits] Player address:", currentAddress)

        const currentProvider = new BrowserProvider(window.ethereum)
        const signer = await currentProvider.getSigner()
        
        // Verify we're on the correct network
        const network = await currentProvider.getNetwork()
        const expectedChainId = 5042002
        
        if (Number(network.chainId) !== expectedChainId) {
          throw new Error(`Wrong network. Please switch to Arc Testnet (Chain ID: ${expectedChainId})`)
        }
        console.log("✅ [purchaseCredits] Network verified:", Number(network.chainId))

        // Initialize contract
        const contract = new Contract(GAME_CREDITS_ADDRESS, GAME_CREDITS_ABI, signer)
        
        // ✅ CRITICAL: Check if PrizePool address is configured
        console.log("🔍 [purchaseCredits] Checking PrizePool address configuration...")
        const prizePoolAddress = await contract.prizePoolAddress()
        console.log("🔍 [purchaseCredits] PrizePool address:", prizePoolAddress)
        
        if (!prizePoolAddress || prizePoolAddress === "0x0000000000000000000000000000000000000000") {
          throw new Error("PrizePool address not configured in contract. Please contact support.")
        }
        console.log("✅ [purchaseCredits] PrizePool address verified:", prizePoolAddress)
        
        // Check USDC balance - read decimals dynamically from contract
        const USDC_ABI = [
          "function balanceOf(address owner) view returns (uint256)",
          "function decimals() view returns (uint8)",
          "function allowance(address owner, address spender) view returns (uint256)",
          "function approve(address spender, uint256 amount) returns (bool)",
        ]
        const usdcContract = new Contract(USDC_CONTRACT_ADDRESS, USDC_ABI, signer)
        
        console.log("🔍 [purchaseCredits] Checking USDC balance...")
        // ✅ All contract values are BigInt
        const balanceRaw: bigint = await usdcContract.balanceOf(currentAddress)
        const decimalsRaw = await usdcContract.decimals()
        
        // ✅ Convert decimals to Number for calculations (decimals is small, safe to convert)
        const decimals = Number(decimalsRaw)
        
        // ✅ Convert to Number ONLY for UI/error messages (after all BigInt comparisons)
        const balanceAmount = Number(balanceRaw) / (10 ** decimals)
        console.log("💰 [purchaseCredits] USDC balance:", balanceAmount, "USDC (raw:", balanceRaw.toString(), ")")
        
        if (balanceAmount === 0) {
          throw new Error(`No USDC found. You need USDC tokens (contract: ${USDC_CONTRACT_ADDRESS}) to purchase credits.`)
        }
        
        // Calculate cost - contract returns BigInt
        // ✅ Convert amount to BigInt explicitly to avoid type mixing issues
        console.log("🔍 [purchaseCredits] Calculating purchase cost...")
        const costRaw: bigint = await contract.calculatePurchaseCost(BigInt(amount))
        
        // ✅ Convert to Number ONLY for UI/error messages (after all BigInt comparisons)
        const costAmount = Number(costRaw) / (10 ** decimals)
        console.log("💰 [purchaseCredits] Purchase cost:", costAmount, "USDC (raw:", costRaw.toString(), ")")
        console.log("💰 [purchaseCredits] Credits to receive:", amount)
        
        // ✅ Check if user has enough USDC - comparison between BigInt only
        if (balanceRaw < costRaw) {
          throw new Error(`Insufficient USDC balance. You have ${balanceAmount.toFixed(decimals)} USDC but need ${costAmount.toFixed(decimals)} USDC.`)
        }
        console.log("✅ [purchaseCredits] USDC balance sufficient")

        // Check and approve USDC spending - contract returns BigInt
        console.log("🔍 [purchaseCredits] Checking USDC allowance...")
        const allowanceRaw: bigint = await usdcContract.allowance(currentAddress, GAME_CREDITS_ADDRESS)
        const allowanceAmount = Number(allowanceRaw) / (10 ** decimals)
        console.log("🔍 [purchaseCredits] Current allowance:", allowanceAmount, "USDC (raw:", allowanceRaw.toString(), ")")

        // ✅ Comparison between BigInt only
        if (allowanceRaw < costRaw) {
          console.log("⚠️ [purchaseCredits] Insufficient allowance, requesting approval...")
          // Approve 1000 USDC (using the decimals from contract)
          // Calculate 10^decimals using multiplication (decimals is already Number)
          let decimalsMultiplier = BigInt(1)
          for (let i = 0; i < decimals; i++) {
            decimalsMultiplier = decimalsMultiplier * BigInt(10)
          }
          const approveAmount = BigInt(1000) * decimalsMultiplier
          console.log("📝 [purchaseCredits] Requesting approval for:", Number(approveAmount) / (10 ** decimals), "USDC")
          const approveTx = await usdcContract.approve(GAME_CREDITS_ADDRESS, approveAmount)
          console.log("⏳ [purchaseCredits] Approval transaction sent, waiting for confirmation...")
          const approveReceipt = await approveTx.wait()
          
          if (!approveReceipt || approveReceipt.status !== 1) {
            throw new Error("USDC approval failed. Please try again.")
          }
          console.log("✅ [purchaseCredits] USDC approval confirmed")
        } else {
          console.log("✅ [purchaseCredits] USDC allowance sufficient")
        }

        // Get current credit balance before purchase
        const previousBalance = await readCreditsFromContract(currentAddress)
        console.log("📊 [purchaseCredits] Current credit balance:", previousBalance)

        // Purchase credits using purchaseCreditsWithPrizePool
        // This sends USDC directly to PrizePool and updates player's credit balance
        console.log("🚀 [purchaseCredits] Calling purchaseCreditsWithPrizePool...")
        console.log("🚀 [purchaseCredits] USDC will be sent to PrizePool:", prizePoolAddress)
        // ✅ Convert amount to BigInt explicitly to avoid type mixing issues
        const tx = await contract.purchaseCreditsWithPrizePool(BigInt(amount))
        console.log("⏳ [purchaseCredits] Transaction sent, hash:", tx.hash)
        
        // CRITICAL: Wait for transaction to be mined before updating UI
        console.log("⏳ [purchaseCredits] Waiting for transaction confirmation...")
        const receipt = await tx.wait()
        
        if (!receipt || receipt.status !== 1) {
          throw new Error("Transaction failed. Please try again.")
        }
        console.log("✅ [purchaseCredits] Transaction confirmed in block:", receipt.blockNumber)

        // ✅ CORREÇÃO: Após a transação ser confirmada, chamar explicitamente refreshCredits()
        // para atualizar o estado imediatamente, sem depender de eventos ou useEffect
        console.log("🔄 [purchaseCredits] Transaction confirmed, refreshing credits from contract...")
        await refreshCredits()
        
        console.log("✅ [purchaseCredits] Credits purchased successfully!")
        console.log("✅ [purchaseCredits] USDC was sent to PrizePool:", prizePoolAddress)
      } catch (error: any) {
        console.error("❌ [purchaseCredits] Error purchasing credits:", error)
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
    [walletAddress, readCreditsFromContract, refreshCredits],
  )

  // Decrement credits optimistically (immediate UI update)
  const decrementCreditsOptimistic = useCallback(
    (clickCount: number) => {
      console.log(`⚡ [decrementCreditsOptimistic] Decrementing ${clickCount} credits optimistically`)
      setCredits(prevCredits => {
        const newCredits = Math.max(0, prevCredits - clickCount)
        console.log(`⚡ [decrementCreditsOptimistic] Credits: ${prevCredits} -> ${newCredits}`)
        return newCredits
      })
    },
    [],
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

      // Decrement optimistically for immediate UI feedback
      decrementCreditsOptimistic(clickCount)

      try {
        if (typeof window === "undefined" || !window.ethereum) {
          throw new Error("Wallet not available")
        }

        const provider = new BrowserProvider(window.ethereum)
        const signer = await provider.getSigner()
        const contract = new Contract(GAME_CREDITS_ADDRESS, GAME_CREDITS_ABI, signer)

        // ✅ Convert clickCount to BigInt explicitly to avoid type mixing issues
        const tx = await contract.consumeCreditsSelf(BigInt(clickCount))
        
        // Wait for transaction before updating
        await tx.wait()
        
        // ✅ CORREÇÃO: Após a transação ser confirmada, chamar explicitamente refreshCredits()
        // para atualizar o estado imediatamente, sem depender de eventos ou useEffect
        console.log("🔄 [consumeCredits] Transaction confirmed, refreshing credits from contract...")
        await refreshCredits()
      } catch (error: any) {
        console.error("Error consuming credits:", error)
        // On error, reconcile with contract to restore correct state
        try {
          const correctBalance = await readCreditsFromContract(walletAddress)
          setCredits(Number(correctBalance))
        } catch (reconcileError) {
          console.error("Error reconciling credits after error:", reconcileError)
        }
        // Check if user rejected the transaction (code 4001)
        if (error?.code === 4001 || error?.message?.includes("rejected") || error?.message?.includes("denied") || error?.message?.includes("User rejected")) {
          const rejectionError = new Error("Transação rejeitada pelo usuário")
          rejectionError.name = "UserRejectedError"
          throw rejectionError
        }
        throw error
      }
    },
    [walletAddress, readCreditsFromContract, decrementCreditsOptimistic, refreshCredits],
  )

  // Record a click (for compatibility - actual consumption happens via backend)
  const recordClick = useCallback(
    async (sessionId: string) => {
      // Decrement credits optimistically for immediate UI feedback
      // Each click consumes 1 credit
      decrementCreditsOptimistic(1)
      
      // This is handled by the backend via meta-transactions
      // Refresh credits after a delay to reconcile with contract (source of truth)
      if (walletAddress && walletAddress.trim() !== "") {
        console.log("🔄 recordClick: Scheduling credits refresh for reconciliation...")
        setTimeout(async () => {
          try {
            await refreshCredits()
            const newBalance = await readCreditsFromContract(walletAddress)
            console.log("✅ recordClick: Credits reconciled with contract. New balance:", Number(newBalance))
          } catch (error) {
            console.error("❌ recordClick: Error refreshing credits:", error)
          }
        }, 3000) // Delay para garantir que a transação foi processada
      }
    },
    [walletAddress, refreshCredits, readCreditsFromContract, decrementCreditsOptimistic],
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

  // Effect: Refresh credits ONLY when walletAddress changes (no polling)
  useEffect(() => {
    // ✅ Use walletAddress directly (source of truth from GameScreen)
    if (walletAddress && walletAddress.trim() !== "") {
      console.log("🔄 useEffect: walletAddress exists, refreshing credits once on mount/change")
      // Read balance from contract immediately (only once, no polling)
      refreshCredits()
    } else {
      // No walletAddress - set to 0
      console.log("🔄 useEffect: No walletAddress available, setting credits to 0")
      setCredits(0)
    }
  }, [walletAddress, refreshCredits])

  return {
    credits,
    purchaseCredits,
    consumeCredits,
    recordClick,
    refreshCredits,
    getCreditsBalance,
    decrementCreditsOptimistic,
    isLoading,
  }
}
