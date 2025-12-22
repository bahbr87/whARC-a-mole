import { NextRequest, NextResponse } from "next/server"
import { Wallet, JsonRpcProvider, Contract, ethers } from "ethers"

// GameClickProcessor ABI
const GAME_CLICK_PROCESSOR_ABI = [
  "function processClicks(address player, bytes32 sessionId, uint256 clickCount) external",
]

const GAME_CLICK_PROCESSOR_ADDRESS = process.env.GAME_CLICK_PROCESSOR_ADDRESS || "0x0000000000000000000000000000000000000000"
const RPC_URL = process.env.RPC_URL || "https://rpc.testnet.arc.network"
const CHAIN_ID = parseInt(process.env.CHAIN_ID || "5042002")
const AUTHORIZED_SIGNER_PRIVATE_KEY = process.env.AUTHORIZED_SIGNER_PRIVATE_KEY || ""

export async function POST(request: NextRequest) {
  try {
    // Validate environment
    if (GAME_CLICK_PROCESSOR_ADDRESS === "0x0000000000000000000000000000000000000000") {
      return NextResponse.json(
        { error: "GameClickProcessor contract not configured" },
        { status: 500 }
      )
    }

    if (!AUTHORIZED_SIGNER_PRIVATE_KEY) {
      return NextResponse.json(
        { error: "Authorized signer private key not configured" },
        { status: 500 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { player, sessionId, clickCount } = body

    if (!player || !sessionId || !clickCount || clickCount <= 0) {
      return NextResponse.json(
        { error: "Invalid request parameters" },
        { status: 400 }
      )
    }

    // Connect to blockchain
    const provider = new JsonRpcProvider(RPC_URL, CHAIN_ID)
    const signer = new Wallet(AUTHORIZED_SIGNER_PRIVATE_KEY, provider)

    // Connect to contract
    const contract = new Contract(
      GAME_CLICK_PROCESSOR_ADDRESS,
      GAME_CLICK_PROCESSOR_ABI,
      signer
    )

    // Convert sessionId to bytes32
    const sessionIdBytes32 = ethers.zeroPadValue(
      ethers.toUtf8Bytes(sessionId),
      32
    )

    // Process clicks (this consumes credits without user signature)
    const tx = await contract.processClicks(player, sessionIdBytes32, clickCount)
    await tx.wait()

    return NextResponse.json({
      success: true,
      transactionHash: tx.hash,
      clicksProcessed: clickCount,
    })
  } catch (error: any) {
    console.error("Error processing clicks:", error)
    return NextResponse.json(
      {
        error: "Failed to process clicks",
        message: error.message || "Unknown error",
      },
      { status: 500 }
    )
  }
}

