import { NextRequest, NextResponse } from "next/server"
import { Wallet, JsonRpcProvider, Contract, ethers } from "ethers"

// MetaTransactionProcessor ABI
const META_TRANSACTION_PROCESSOR_ABI = [
  "function processClick(address player, bytes32 sessionId, uint256 clickCount, uint256 deadline, bytes memory signature) external",
]

// Environment variables - MUST be configured for production
const META_TRANSACTION_ADDRESS = process.env.META_TRANSACTION_ADDRESS || "0x0000000000000000000000000000000000000000"
const GAME_CREDITS_ADDRESS = process.env.GAME_CREDITS_ADDRESS || process.env.NEXT_PUBLIC_GAME_CREDITS_ADDRESS || "0xB6EF59882778d0A245202F1482f20f02ad82bd87"
const RPC_URL = process.env.RPC_URL || "https://rpc.testnet.arc.network"
const CHAIN_ID = parseInt(process.env.CHAIN_ID || "5042002")
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY || ""

// Transaction queue to prevent nonce conflicts
// This ensures transactions are processed sequentially
let transactionQueue: Promise<any> = Promise.resolve()

// Helper function to queue transactions sequentially
function queueTransaction<T>(fn: () => Promise<T>): Promise<T> {
  const current = transactionQueue
  transactionQueue = current.then(() => fn(), () => fn())
  return transactionQueue
}

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json()
    const { player, sessionId, clickCount, nonce, deadline, signature, authorized } = body

    // If user is authorized, consume credits directly via GameCredits
    if (authorized) {
      // Validate relayer configuration
      if (!RELAYER_PRIVATE_KEY) {
        console.error("❌ RELAYER ERROR: RELAYER_PRIVATE_KEY not configured in environment variables")
        return NextResponse.json(
          {
            error: "Relayer not configured",
            message: "RELAYER_PRIVATE_KEY environment variable is not set. Please configure it in .env.local",
            hint: "The relayer wallet needs to be authorized to consume credits on behalf of players.",
          },
          { status: 500 }
        )
      }

      // Validate GameCredits contract address
      if (!GAME_CREDITS_ADDRESS || GAME_CREDITS_ADDRESS === "0x0000000000000000000000000000000000000000") {
        console.error("❌ CONFIG ERROR: GAME_CREDITS_ADDRESS not configured")
        return NextResponse.json(
          { 
            error: "GameCredits contract not configured",
            message: "GAME_CREDITS_ADDRESS environment variable is not set",
            hint: "Configure GAME_CREDITS_ADDRESS in .env.local"
          },
          { status: 500 }
        )
      }

      console.log(`📋 Processing click - GameCredits: ${GAME_CREDITS_ADDRESS}, RPC: ${RPC_URL}, Chain: ${CHAIN_ID}`)
      
      const provider = new JsonRpcProvider(RPC_URL, CHAIN_ID)
      const relayer = new Wallet(RELAYER_PRIVATE_KEY, provider)
      
      console.log(`🔐 Relayer address: ${relayer.address}`)
      console.log(`🎮 Processing click - Player: ${player}, Clicks: ${clickCount}`)
      
      // Check relayer balance (needs USDC for gas on Arc)
      try {
        const balance = await provider.getBalance(relayer.address)
        console.log(`💰 Relayer balance: ${balance.toString()} wei`)
        if (balance === 0n) {
          console.warn(`⚠️  WARNING: Relayer has no balance!`)
          console.warn(`   Relayer needs USDC for gas on Arc Testnet`)
          console.warn(`   Fund relayer at: https://faucet.circle.com`)
        }
      } catch (balanceError) {
        console.warn(`⚠️  Could not check relayer balance:`, balanceError)
      }
      
      try {
        
        const GAME_CREDITS_ABI = [
          "function owner() external view returns (address)",
          "function authorizedConsumers(address) external view returns (bool)",
          "function authorizeConsumer(address consumer) external",
          "function consumeCredits(address player, uint256 clickCount) external",
          "function credits(address) external view returns (uint256)",
        ]
        const gameCreditsContract = new Contract(
          GAME_CREDITS_ADDRESS,
          GAME_CREDITS_ABI,
          relayer
        )
        
        // Check authorization status
        const owner = await gameCreditsContract.owner()
        const isOwner = owner.toLowerCase() === relayer.address.toLowerCase()
        const relayerAuthorized = await gameCreditsContract.authorizedConsumers(relayer.address)
        const processorAuthorized = META_TRANSACTION_ADDRESS !== "0x0000000000000000000000000000000000000000" 
          ? await gameCreditsContract.authorizedConsumers(META_TRANSACTION_ADDRESS)
          : false
        
        console.log(`🔍 Authorization check:`)
        console.log(`   Contract Owner: ${owner}`)
        console.log(`   Relayer is Owner: ${isOwner}`)
        console.log(`   Relayer is Authorized Consumer: ${relayerAuthorized}`)
        console.log(`   MetaTransactionProcessor Authorized: ${processorAuthorized}`)
        
        if (isOwner || relayerAuthorized) {
          // Relayer can consume directly - CHECK BALANCE FIRST
          console.log(`✅ Relayer authorized - proceeding with credit consumption`)
          
          // Check player's credit balance first
          const playerCredits = await gameCreditsContract.credits(player)
          const creditsBigInt = BigInt(playerCredits.toString())
          const clickCountBigInt = BigInt(clickCount)
          
          console.log(`💰 Balance check - Player: ${player}`)
          console.log(`   Current credits: ${creditsBigInt.toString()}`)
          console.log(`   Required: ${clickCountBigInt.toString()}`)
          
          if (creditsBigInt < clickCountBigInt) {
            const errorMsg = `Insufficient credits: player has ${creditsBigInt.toString()}, needs ${clickCountBigInt.toString()}`
            console.error(`❌ INSUFFICIENT CREDITS: ${errorMsg}`)
            return NextResponse.json(
              {
                error: "Insufficient credits",
                message: errorMsg,
                playerCredits: creditsBigInt.toString(),
                required: clickCountBigInt.toString(),
              },
              { status: 400 }
            )
          }
          
          // Send REAL blockchain transaction - QUEUED to prevent nonce conflicts
          console.log(`📤 Queueing transaction to blockchain...`)
          return await queueTransaction(async () => {
            try {
              // Estimate gas first to catch errors early
              const gasEstimate = await gameCreditsContract.consumeCredits.estimateGas(player, clickCount)
              console.log(`   Gas estimate: ${gasEstimate.toString()}`)
              
              // Get current nonce to prevent conflicts (always get fresh nonce from network)
              const currentNonce = await provider.getTransactionCount(relayer.address, "pending")
              console.log(`   Using nonce: ${currentNonce}`)
              
              const tx = await gameCreditsContract.consumeCredits(player, clickCount, {
                nonce: currentNonce, // Explicit nonce to prevent conflicts
              })
              console.log(`⏳ Transaction sent: ${tx.hash}`)
              console.log(`   Waiting for confirmation...`)
              
              const receipt = await tx.wait()
              
              if (!receipt || receipt.status !== 1) {
                throw new Error(`Transaction failed with status: ${receipt?.status || "unknown"}`)
              }
              
              console.log(`✅ TRANSACTION CONFIRMED`)
              console.log(`   Hash: ${tx.hash}`)
              console.log(`   Block: ${receipt.blockNumber}`)
              console.log(`   Gas used: ${receipt.gasUsed?.toString() || "N/A"}`)
              
              return NextResponse.json({
                success: true,
                transactionHash: tx.hash,
                clicksProcessed: clickCount,
                blockNumber: receipt.blockNumber,
                gasUsed: receipt.gasUsed?.toString(),
                method: "direct_consumption",
              })
            } catch (txError: any) {
              // Check for nonce errors and retry
              if (txError.code === "NONCE_EXPIRED" || txError.message?.includes("nonce") || txError.reason?.includes("nonce")) {
                console.error(`❌ NONCE ERROR detected, retrying with fresh nonce...`)
                console.error(`   Error: ${txError.reason || txError.message}`)
                
                // Retry once with fresh nonce
                try {
                  const retryNonce = await provider.getTransactionCount(relayer.address, "pending")
                  console.log(`   Retry with nonce: ${retryNonce}`)
                  
                  const retryTx = await gameCreditsContract.consumeCredits(player, clickCount, {
                    nonce: retryNonce,
                  })
                  console.log(`⏳ Retry transaction sent: ${retryTx.hash}`)
                  
                  const retryReceipt = await retryTx.wait()
                  
                  if (!retryReceipt || retryReceipt.status !== 1) {
                    throw new Error(`Retry transaction failed with status: ${retryReceipt?.status || "unknown"}`)
                  }
                  
                  console.log(`✅ RETRY TRANSACTION CONFIRMED: ${retryTx.hash}`)
                  
                  return NextResponse.json({
                    success: true,
                    transactionHash: retryTx.hash,
                    clicksProcessed: clickCount,
                    blockNumber: retryReceipt.blockNumber,
                    gasUsed: retryReceipt.gasUsed?.toString(),
                    method: "direct_consumption_retry",
                  })
                } catch (retryError: any) {
                  console.error(`❌ RETRY FAILED: ${retryError.message || retryError.reason}`)
                  throw retryError
                }
              }
              
              // If gas estimation fails, it means the transaction would revert
              if (txError.code === "CALL_EXCEPTION" || txError.reason) {
                const revertReason = txError.reason || txError.message || "Transaction would revert"
                console.error(`❌ TRANSACTION WOULD REVERT: ${revertReason}`)
                throw new Error(`Transaction would revert: ${revertReason}`)
              }
              
              throw txError
            }
          })
        } else if (isOwner) {
          // If relayer is owner but not authorized, authorize relayer as consumer
          console.log(`⚠️  Relayer is owner but not authorized as consumer`)
          console.log(`   Attempting to authorize relayer...`)
          try {
            const authRelayerTx = await gameCreditsContract.authorizeConsumer(relayer.address)
            console.log(`   Authorization tx sent: ${authRelayerTx.hash}`)
            await authRelayerTx.wait()
            console.log(`✅ Relayer authorized as consumer`)
            
            // Now consume directly (same flow as above)
            const playerCredits = await gameCreditsContract.credits(player)
            const creditsBigInt = BigInt(playerCredits.toString())
            const clickCountBigInt = BigInt(clickCount)
            
            if (creditsBigInt < clickCountBigInt) {
              console.error(`❌ INSUFFICIENT CREDITS after authorization`)
              return NextResponse.json(
                {
                  error: "Insufficient credits",
                  message: `Player has ${creditsBigInt.toString()} credits, needs ${clickCountBigInt.toString()}`,
                  playerCredits: creditsBigInt.toString(),
                  required: clickCountBigInt.toString(),
                },
                { status: 400 }
              )
            }
            
            // Send transaction - QUEUED to prevent nonce conflicts
            return await queueTransaction(async () => {
              console.log(`📤 Sending transaction to blockchain...`)
              // Get current nonce to prevent conflicts
              const currentNonce = await provider.getTransactionCount(relayer.address, "pending")
              console.log(`   Using nonce: ${currentNonce}`)
              
              const tx = await gameCreditsContract.consumeCredits(player, clickCount, {
                nonce: currentNonce, // Explicit nonce to prevent conflicts
              })
              console.log(`⏳ Transaction sent: ${tx.hash}`)
              const receipt = await tx.wait()
              
              console.log(`✅ TRANSACTION CONFIRMED: ${tx.hash}, Block: ${receipt.blockNumber}`)
              
              return NextResponse.json({
                success: true,
                transactionHash: tx.hash,
                clicksProcessed: clickCount,
                blockNumber: receipt.blockNumber,
                gasUsed: receipt.gasUsed?.toString(),
                method: "direct_after_authorization",
              })
            })
          } catch (authError: any) {
            console.error(`❌ AUTHORIZATION ERROR: Failed to authorize relayer`)
            console.error(`   Error: ${authError.message || authError.reason || "Unknown"}`)
            throw new Error(`Failed to authorize relayer: ${authError.message || authError.reason || "Unknown error"}`)
          }
        } else {
          // Relayer is not authorized and not owner
          const errorMsg = `Relayer (${relayer.address}) is not authorized to consume credits. Owner: ${owner}.`
          console.error(`❌ RELAYER AUTHORIZATION ERROR:`)
          console.error(`   ${errorMsg}`)
          console.error(`   Action required: Authorize ${relayer.address} as a consumer in GameCredits contract`)
          return NextResponse.json(
            {
              error: "Relayer not authorized",
              message: errorMsg,
              relayerAddress: relayer.address,
              ownerAddress: owner,
              hint: "The relayer wallet needs to be authorized as a consumer in the GameCredits contract, or the relayer needs to be the owner.",
            },
            { status: 403 }
          )
        }
      } catch (error: any) {
        console.error(`❌ TRANSACTION ERROR: Failed to consume credits`)
        console.error(`   Error type: ${error.constructor?.name || "Unknown"}`)
        console.error(`   Message: ${error.message || "N/A"}`)
        console.error(`   Reason: ${error.reason || "N/A"}`)
        console.error(`   Code: ${error.code || "N/A"}`)
        console.error(`   Data: ${error.data ? JSON.stringify(error.data) : "N/A"}`)
        if (error.transaction) {
          console.error(`   Failed transaction: ${error.transaction.hash || "N/A"}`)
        }
        
        // Try to get more details from the error
        let errorMessage = "Unknown error"
        if (error.reason) {
          errorMessage = error.reason
        } else if (error.message) {
          errorMessage = error.message
        } else if (error.data?.message) {
          errorMessage = error.data.message
        } else if (error.data) {
          errorMessage = `Contract error: ${JSON.stringify(error.data)}`
        } else if (typeof error === 'string') {
          errorMessage = error
        }
        
        // Check for common error patterns and provide helpful messages
        if (errorMessage.includes("insufficient funds") || errorMessage.includes("gas") || errorMessage.includes("balance")) {
          errorMessage = `Relayer wallet (${relayer.address}) has insufficient funds for gas. Please fund the relayer wallet with USDC on Arc Testnet.`
          console.error(`   💡 Solution: Fund ${relayer.address} with USDC from https://faucet.circle.com`)
        } else if (errorMessage.includes("unauthorized") || errorMessage.includes("not authorized") || errorMessage.includes("AccessControl")) {
          errorMessage = `Relayer (${relayer.address}) is not authorized. Please authorize as a consumer in the GameCredits contract.`
          console.error(`   💡 Solution: Call authorizeConsumer(${relayer.address}) on GameCredits contract`)
        } else if (errorMessage.includes("revert") || errorMessage.includes("execution reverted")) {
          errorMessage = `Transaction reverted: ${errorMessage}. Check contract state and relayer authorization.`
        }
        
        return NextResponse.json(
          {
            error: "Failed to consume credits",
            message: errorMessage,
            details: {
              code: error.code,
              reason: error.reason,
              relayerAddress: relayer.address,
              contractAddress: GAME_CREDITS_ADDRESS,
            },
          },
          { status: 500 }
        )
      }
    }

    // Original flow with signature
    if (!player || !sessionId || !clickCount || !nonce || !deadline || !signature) {
      return NextResponse.json(
        { error: "Invalid request parameters" },
        { status: 400 }
      )
    }

    // Validate deadline
    if (Math.floor(Date.now() / 1000) > deadline) {
      return NextResponse.json(
        { error: "Signature expired" },
        { status: 400 }
      )
    }

    // Validate relayer configuration (REQUIRED for signature flow too)
    if (!RELAYER_PRIVATE_KEY) {
      console.error("❌ RELAYER ERROR: RELAYER_PRIVATE_KEY not configured")
      return NextResponse.json(
        {
          error: "Relayer not configured",
          message: "RELAYER_PRIVATE_KEY environment variable is not set. Each click requires a relayer to process the transaction on-chain.",
          hint: "Configure RELAYER_PRIVATE_KEY in .env.local for production.",
        },
        { status: 500 }
      )
    }

    // Connect to blockchain
    const provider = new JsonRpcProvider(RPC_URL, CHAIN_ID)
    const relayer = new Wallet(RELAYER_PRIVATE_KEY, provider)
    
    console.log(`📤 Processing click with signature - Player: ${player}, Relayer: ${relayer.address}`)

    // Connect to contract
    const contract = new Contract(
      META_TRANSACTION_ADDRESS,
      META_TRANSACTION_PROCESSOR_ABI,
      relayer
    )

    // Convert sessionId to bytes32
    const sessionIdBytes32 = ethers.zeroPadValue(
      ethers.toUtf8Bytes(sessionId),
      32
    )

    // Process click with meta-transaction (relayer pays gas, user's signature validates)
    console.log(`⏳ Sending transaction to blockchain...`)
    const tx = await contract.processClick(
      player,
      sessionIdBytes32,
      clickCount,
      deadline,
      signature
    )
    console.log(`⏳ Transaction sent: ${tx.hash}, waiting for confirmation...`)
    
    const receipt = await tx.wait()
    console.log(`✅ TRANSACTION CONFIRMED - Hash: ${tx.hash}, Block: ${receipt.blockNumber}, Gas: ${receipt.gasUsed?.toString() || "N/A"}`)

    return NextResponse.json({
      success: true,
      transactionHash: tx.hash,
      clicksProcessed: clickCount,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed?.toString(),
    })
  } catch (error: any) {
    console.error("Error processing meta-click:", error)
    return NextResponse.json(
      {
        error: "Failed to process click",
        message: error.message || "Unknown error",
      },
      { status: 500 }
    )
  }
}

