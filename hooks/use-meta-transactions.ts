"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { BrowserProvider, Contract, ethers } from "ethers"
import { useArcWallet } from "./use-arc-wallet"
import { useGameCredits } from "./use-game-credits"

// EIP-712 Domain and Types
const DOMAIN_NAME = "GameClickProcessor"
const DOMAIN_VERSION = "1"
const CLICK_REQUEST_TYPE = {
  ClickRequest: [
    { name: "player", type: "address" },
    { name: "sessionId", type: "bytes32" },
    { name: "clickCount", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
}

interface UseMetaTransactionsReturn {
  signAuthorization: () => Promise<string>
  recordClick: (sessionId: string) => Promise<void>
  isAuthorized: boolean
  authorize: () => Promise<void>
  pendingClicks: number
}

export function useMetaTransactions(): UseMetaTransactionsReturn {
  const { provider, address, isConnected } = useArcWallet()
  const { credits, refreshCredits } = useGameCredits()
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [pendingClicks, setPendingClicks] = useState(0)
  const clickQueueRef = useRef<Array<{ sessionId: string; timestamp: number }>>([])
  const nonceRef = useRef<number>(0)

  const META_TRANSACTION_ADDRESS = process.env.NEXT_PUBLIC_META_TRANSACTION_ADDRESS || "0x0000000000000000000000000000000000000000"

  // Get domain separator for EIP-712
  const getDomain = useCallback(async () => {
    if (!provider) return null

    const network = await provider.getNetwork()
    return {
      name: DOMAIN_NAME,
      version: DOMAIN_VERSION,
      chainId: Number(network.chainId),
      verifyingContract: META_TRANSACTION_ADDRESS,
    }
  }, [provider])

  // Check if player is authorized
  const checkAuthorization = useCallback(async () => {
    if (!address || !isConnected) {
      setIsAuthorized(false)
      return
    }

    if (META_TRANSACTION_ADDRESS === "0x0000000000000000000000000000000000000000") {
      setIsAuthorized(false)
      return
    }

    try {
      // Create fresh provider from window.ethereum if provider is null
      let contractProvider = provider
      if (!contractProvider && typeof window !== "undefined" && window.ethereum) {
        contractProvider = new BrowserProvider(window.ethereum)
      }
      
      if (!contractProvider) {
        setIsAuthorized(false)
        return
      }

      // First check if contract exists at this address
      const code = await contractProvider.getCode(META_TRANSACTION_ADDRESS)
      if (code === "0x" || code === "0x0") {
        // Contract not deployed, user is not authorized
        setIsAuthorized(false)
        return
      }

      const contract = new Contract(
        META_TRANSACTION_ADDRESS,
        ["function authorized(address) external view returns (bool)"],
        contractProvider
      )
      
      // Try to call the function, but handle errors gracefully
      try {
        const authorized = await contract.authorized(address)
        setIsAuthorized(authorized)
      } catch (callError: any) {
        // If function doesn't exist or contract doesn't support it, assume not authorized
        if (callError.code === "BAD_DATA" || callError.message?.includes("decode")) {
          console.warn("Contract doesn't have authorized() function or returned invalid data")
          setIsAuthorized(false)
        } else {
          throw callError
        }
      }
    } catch (error) {
      console.error("Error checking authorization:", error)
      setIsAuthorized(false)
    }
  }, [provider, address, isConnected])

  // Sign authorization (one-time signature for unlimited clicks)
  // Note: This is optional - users can call authorize() directly on contract
  const signAuthorization = useCallback(async (): Promise<string> => {
    if (!provider || !address) {
      throw new Error("Wallet not connected")
    }

    // For now, just call authorize() directly
    // This function can be used for future implementations
    throw new Error("Use authorize() function instead")
  }, [provider, address])

  // Authorize player (one-time, allows unlimited clicks without signatures)
  const authorize = useCallback(async () => {
    // Try to get address from window.ethereum as fallback if address is null
    let currentAddress = address
    
    if (!currentAddress && typeof window !== "undefined" && window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: "eth_accounts" })
        if (accounts && accounts.length > 0) {
          currentAddress = accounts[0]
          console.log("🔄 authorize: Got address from window.ethereum:", currentAddress)
        }
      } catch (error) {
        // Ignore errors, will check below
      }
    }
    
    // Check if we have an address (from hook or window.ethereum)
    if (!currentAddress) {
      throw new Error("Wallet not connected - no address")
    }
    
    // Verify wallet is actually connected via window.ethereum
    if (typeof window !== "undefined" && window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: "eth_accounts" })
        if (!accounts || accounts.length === 0) {
          throw new Error("Wallet not connected - no accounts")
        }
        // Verify the address matches
        if (accounts[0].toLowerCase() !== currentAddress.toLowerCase()) {
          throw new Error("Wallet address mismatch")
        }
      } catch (error: any) {
        if (error.message && !error.message.includes("not connected")) {
          throw error
        }
        throw new Error("Wallet not connected")
      }
    } else {
      throw new Error("Wallet not available")
    }

    if (META_TRANSACTION_ADDRESS === "0x0000000000000000000000000000000000000000") {
      throw new Error("MetaTransactionProcessor not deployed")
    }

    try {
      // Always create fresh provider from window.ethereum (source of truth)
      if (typeof window === "undefined" || !window.ethereum) {
        throw new Error("Wallet not available")
      }
      
      const contractProvider = new BrowserProvider(window.ethereum)
      const signer = await contractProvider.getSigner()
      const signerAddress = await signer.getAddress()
      
      // Verify signer address matches currentAddress
      if (signerAddress.toLowerCase() !== currentAddress.toLowerCase()) {
        throw new Error("Signer address mismatch")
      }
      
      const contract = new Contract(
        META_TRANSACTION_ADDRESS,
        ["function authorize() external"],
        signer
      )

      // This will show a popup once
      const tx = await contract.authorize()
      await tx.wait()

      setIsAuthorized(true)
    } catch (error: any) {
      console.error("Error authorizing:", error)
      // Check if user rejected the transaction (code 4001)
      if (error?.code === 4001 || error?.message?.includes("rejected") || error?.message?.includes("denied") || error?.message?.includes("User rejected")) {
        const rejectionError = new Error("Transação rejeitada pelo usuário")
        rejectionError.name = "UserRejectedError"
        throw rejectionError
      }
      throw error
    }
  }, [address]) // Only depend on address - we always use window.ethereum for provider

  // Get current nonce
  const getNonce = useCallback(async () => {
    if (!provider || !address) return 0

    if (META_TRANSACTION_ADDRESS === "0x0000000000000000000000000000000000000000") {
      return 0
    }

    try {
      const contract = new Contract(
        META_TRANSACTION_ADDRESS,
        ["function getNonce(address) external view returns (uint256)"],
        provider
      )
      const nonce = await contract.getNonce(address)
      return Number(nonce)
    } catch (error) {
      console.error("Error getting nonce:", error)
      return 0
    }
  }, [provider, address])

  // Process a single click (generates signature and sends to backend)
  // This must be defined before recordClick since recordClick uses it
  const processClick = useCallback(
    async (sessionId: string) => {
      // Try to get provider and address from window.ethereum if not available from hook
      let currentProvider = provider
      let currentAddress = address
      
      if ((!currentProvider || !currentAddress) && typeof window !== "undefined" && window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: "eth_accounts" })
          if (accounts && accounts.length > 0) {
            currentAddress = accounts[0]
            if (!currentProvider) {
              currentProvider = new BrowserProvider(window.ethereum)
            }
            console.log("🔄 processClick: Got provider/address from window.ethereum")
          }
        } catch (error) {
          // Ignore errors, will check below
        }
      }
      
      if (!currentProvider || !currentAddress || clickQueueRef.current.length === 0) {
        console.error("❌ processClick: Missing provider or address")
        return
      }

      // Remove one click from queue
      const click = clickQueueRef.current.shift()
      if (!click || click.sessionId !== sessionId) {
        // Put it back if wrong session
        clickQueueRef.current.unshift(click!)
        return
      }

      setPendingClicks(clickQueueRef.current.length)

      try {
        // Get nonce (use currentProvider)
        let nonce = 0
        if (META_TRANSACTION_ADDRESS !== "0x0000000000000000000000000000000000000000") {
          try {
            const contract = new Contract(
              META_TRANSACTION_ADDRESS,
              ["function getNonce(address) external view returns (uint256)"],
              currentProvider
            )
            nonce = Number(await contract.getNonce(currentAddress))
          } catch (error) {
            console.warn("Could not get nonce:", error)
          }
        }
        nonceRef.current = nonce

        // Create EIP-712 message
        const network = await currentProvider.getNetwork()
        const domain = {
          name: DOMAIN_NAME,
          version: DOMAIN_VERSION,
          chainId: Number(network.chainId),
          verifyingContract: META_TRANSACTION_ADDRESS,
        }

        const deadline = Math.floor(Date.now() / 1000) + 300 // 5 minutes
        // Hash the sessionId to get a 32-byte value (keccak256 returns 32 bytes)
        const sessionIdBytes32 = ethers.keccak256(ethers.toUtf8Bytes(sessionId))

        const message = {
          player: currentAddress,
          sessionId: sessionIdBytes32,
          clickCount: 1,
          nonce: nonce,
          deadline: deadline,
        }

        // Sign message
        const signer = await currentProvider.getSigner()
        const signature = await signer.signTypedData(domain, CLICK_REQUEST_TYPE, message)

        // Send to backend API (backend will submit transaction)
        const response = await fetch("/api/process-meta-click", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            player: currentAddress, // Use currentAddress (from hook or window.ethereum)
            sessionId: sessionId,
            clickCount: 1,
            nonce: nonce,
            deadline: deadline,
            signature: signature,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
          const errorMessage = errorData.error || errorData.message || "Unknown error"
          console.error("❌ CRITICAL: Click processing failed:", errorMessage)
          throw new Error(`Click processing failed: ${errorMessage}. This click was NOT recorded on-chain.`)
        }

        const result = await response.json()
        
        if (result.transactionHash) {
          console.log("✅✅✅ CLIQUE PROCESSADO NA BLOCKCHAIN (SIGNATURE METHOD) ✅✅✅")
          console.log(`   📤 Transaction Hash: ${result.transactionHash}`)
          console.log(`   🔗 Explorer: https://testnet.arcscan.app/tx/${result.transactionHash}`)
          console.log(`   💰 Créditos consumidos: ${result.clicksProcessed || 1}`)
        } else {
          console.warn("⚠️  Click processed but no transaction hash - may not be on-chain")
        }

        // Refresh credits (non-blocking)
        refreshCredits().catch((error) => {
          console.warn("Could not refresh credits:", error)
        })
      } catch (error: any) {
        // Re-throw to ensure visibility
        console.error("❌ CRITICAL ERROR in processClick:", error.message || error)
        throw error
      }
    },
    [provider, address, refreshCredits], // Removed getDomain and getNonce - now created directly
  )

  // Record a click (sends to backend without signature if authorized)
  // 🚀 CRITICAL: This function MUST generate a blockchain transaction for each click
  const recordClick = useCallback(
    async (sessionId: string) => {
      console.log("🔄 recordClick called - sessionId:", sessionId)
      
      // Try to get address from window.ethereum if address is null (fallback)
      let currentAddress = address
      if (!currentAddress && typeof window !== "undefined" && window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: "eth_accounts" })
          if (accounts && accounts.length > 0) {
            currentAddress = accounts[0]
            console.log("🔄 recordClick: Got address from window.ethereum:", currentAddress)
          }
        } catch (error) {
          // Ignore errors, will check below
        }
      }
      
      // Check if we have an address (from hook or window.ethereum)
      if (!currentAddress) {
        console.error("❌ Cannot record click: Wallet not connected - no address")
        throw new Error("Wallet not connected - cannot process click on-chain")
      }
      
      // Verify wallet is actually connected via window.ethereum
      if (typeof window !== "undefined" && window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: "eth_accounts" })
          if (!accounts || accounts.length === 0) {
            console.error("❌ Cannot record click: No accounts in wallet")
            throw new Error("Wallet not connected - no accounts")
          }
          // Verify the address matches
          if (accounts[0].toLowerCase() !== currentAddress.toLowerCase()) {
            console.error("❌ Cannot record click: Address mismatch")
            throw new Error("Wallet address mismatch")
          }
        } catch (error: any) {
          if (error.message && !error.message.includes("not connected")) {
            throw error
          }
          throw new Error("Wallet not connected")
        }
      } else {
        throw new Error("Wallet not available")
      }

      // Don't check credits here - backend will verify
      // Always use the relayer method (no signature needed)
      // The backend will verify credits and process the transaction
      console.log("🚀 Processing click via relayer (no signature needed)")
        try {
          // Send to backend API - backend will consume credits for authorized users
          const response = await fetch("/api/process-meta-click", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              player: currentAddress, // Use currentAddress (from hook or window.ethereum)
              sessionId: sessionId,
              clickCount: 1,
              authorized: true, // Indicate user is authorized - no signature needed
            }),
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
            const errorMessage = errorData.error || errorData.message || "Unknown error"
            
            // If it's a configuration error, throw to make it clear
            if (errorData.error === "Relayer not configured" || 
                errorData.error === "Relayer not authorized" ||
                errorMessage.includes("Relayer not")) {
              console.error("❌ RELAYER NOT CONFIGURED")
              console.error("   This click was NOT processed on-chain!")
              console.error("   Configure RELAYER_PRIVATE_KEY in .env.local")
              // Don't throw - just log and continue (game continues)
              console.warn("⚠️  Click not processed on-chain - relayer not configured")
              return
            }
            
            // If it's an insufficient credits error, throw
            if (errorData.error === "Insufficient credits" || errorMessage.includes("Insufficient credits")) {
              console.error(`❌ CRITICAL: Insufficient credits: ${errorData.playerCredits || 0} credits, need ${errorData.required || 1}`)
              throw new Error(`Insufficient credits: ${errorMessage}. This click was NOT processed on-chain.`)
            }
            
            // For "Failed to consume credits" - provide detailed diagnostics
            if (errorData.error === "Failed to consume credits" || errorMessage.includes("Failed to consume credits")) {
              const errorDetails = errorData.details || {}
              const fullMessage = errorData.message || errorMessage
              
              console.error("❌ CRITICAL: FAILED TO CONSUME CREDITS")
              console.error("   Full error message:", fullMessage)
              console.error("   Error code:", errorDetails.code || "N/A")
              console.error("   Error reason:", errorDetails.reason || fullMessage || "N/A")
              if (errorDetails.relayerAddress) {
                console.error("   Relayer address:", errorDetails.relayerAddress)
              }
              if (errorDetails.contractAddress) {
                console.error("   Contract address:", errorDetails.contractAddress)
              }
              
              // Extract the actual error reason from the message
              const actualReason = errorDetails.reason || fullMessage || errorMessage
              
              console.error("   Possible causes:")
              console.error("   1. Relayer not authorized as consumer in GameCredits")
              console.error("   2. Relayer insufficient funds for gas")
              console.error("   3. Player insufficient credits")
              console.error("   4. Contract error or network issue")
              console.error("   5. RELAYER_PRIVATE_KEY not configured in .env.local")
              
              // Check if it's a relayer authorization issue
              if (actualReason.includes("unauthorized") || actualReason.includes("not authorized") || actualReason.includes("AccessControl")) {
                if (errorDetails.relayerAddress) {
                  console.error(`   💡 Solution: Authorize ${errorDetails.relayerAddress} as consumer in GameCredits contract`)
                  console.error(`      Run: authorizeConsumer(${errorDetails.relayerAddress}) on GameCredits`)
                }
                // Don't throw - just log and continue (game continues)
                console.warn("⚠️  Click not processed on-chain due to relayer authorization issue")
                return
              }
              
              // Check if it's insufficient funds
              if (actualReason.includes("insufficient funds") || actualReason.includes("gas") || actualReason.includes("balance")) {
                if (errorDetails.relayerAddress) {
                  console.error(`   💡 Solution: Fund ${errorDetails.relayerAddress} with USDC for gas`)
                  console.error(`      Use faucet: https://faucet.circle.com`)
                }
                // Don't throw - just log and continue (game continues)
                console.warn("⚠️  Click not processed on-chain due to relayer insufficient funds")
                return
              }
              
              // Check if it's a configuration issue
              if (actualReason.includes("Relayer not configured") || actualReason.includes("RELAYER_PRIVATE_KEY")) {
                console.error("   💡 Solution: Configure RELAYER_PRIVATE_KEY in .env.local")
                // Don't throw - just log and continue (game continues)
                console.warn("⚠️  Click not processed on-chain - relayer not configured")
                return
              }
              
              // For other errors, log but don't break the game
              console.warn("⚠️  Click not processed on-chain:", actualReason)
              return
            }
            
            // For transaction errors, log but don't break the game
            if (errorMessage.includes("transaction") || errorMessage.includes("gas") || errorMessage.includes("revert")) {
              console.error("❌ BLOCKCHAIN TRANSACTION ERROR")
              console.error("   This click was NOT processed on-chain!")
              const errorDetails = errorData.details || {}
              if (errorDetails.reason) {
                console.error("   Reason:", errorDetails.reason)
              }
              // Don't throw - just log and continue (game continues)
              console.warn("⚠️  Click not processed on-chain due to transaction error")
              return
            }
            
            // For other errors, log but don't break the game
            console.error("❌ Click processing failed:", errorMessage)
            const errorDetails = errorData.details || {}
            if (errorDetails.reason) {
              console.error("   Reason:", errorDetails.reason)
            }
            // Don't throw - just log and continue (game continues)
            console.warn("⚠️  Click not processed on-chain:", errorMessage)
            return
          }

          const result = await response.json()
          
          // Check if it's dev mode simulation
          if (result.warning) {
            console.warn("⚠️  Dev mode (no real transaction):", result.warning)
            throw new Error("Relayer not configured - click was NOT processed on-chain")
          } else if (result.transactionHash) {
            console.log("✅✅✅ CLIQUE PROCESSADO NA BLOCKCHAIN ✅✅✅")
            console.log(`   📤 Transaction Hash: ${result.transactionHash}`)
            console.log(`   🔗 Explorer: https://testnet.arcscan.app/tx/${result.transactionHash}`)
            console.log(`   💰 Créditos consumidos: ${result.clicksProcessed || 1}`)
            if (result.blockNumber) {
              console.log(`   📦 Block: ${result.blockNumber}`)
            }
            if (result.gasUsed) {
              console.log(`   ⛽ Gas usado: ${result.gasUsed}`)
            }
          } else {
            console.warn("⚠️  Click processed but no transaction hash - may not be on-chain")
          }
          
          // Don't refresh credits after every click - too many RPC calls
          // Credits will be refreshed when needed (e.g., when showing credits dialog)
        } catch (error: any) {
          // Re-throw to ensure visibility
          console.error("❌ CRITICAL ERROR in recordClick:", error.message || error)
          throw error
        }
        return
    },
    [isConnected, address, provider],
  )

  // Check authorization on mount and when address changes
  useEffect(() => {
    if (isConnected && address) {
      checkAuthorization()
    }
  }, [isConnected, address, checkAuthorization])

  return {
    signAuthorization,
    recordClick,
    isAuthorized,
    authorize,
    pendingClicks,
  }
}

