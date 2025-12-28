import { NextRequest, NextResponse } from "next/server"
import { Wallet, JsonRpcProvider, Contract, ethers } from "ethers"

/* =========================
   ENV / CONSTANTS
========================= */

const META_TRANSACTION_ADDRESS =
  process.env.META_TRANSACTION_ADDRESS || "0x0000000000000000000000000000000000000000"

const GAME_CREDITS_ADDRESS =
  process.env.GAME_CREDITS_ADDRESS ||
  process.env.NEXT_PUBLIC_GAME_CREDITS_ADDRESS ||
  "0x0000000000000000000000000000000000000000"

const RPC_URL = process.env.RPC_URL || "https://rpc.testnet.arc.network"
const CHAIN_ID = Number(process.env.CHAIN_ID || "5042002")
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY || ""

/* =========================
   SINGLETON PROVIDER & WALLET
========================= */

let _provider: JsonRpcProvider | null = null
let _relayer: Wallet | null = null

function getProvider() {
  if (!_provider) {
    _provider = new JsonRpcProvider(RPC_URL, CHAIN_ID)
  }
  return _provider
}

function getRelayer() {
  if (!_relayer) {
    if (!RELAYER_PRIVATE_KEY) {
      throw new Error("RELAYER_PRIVATE_KEY not configured")
    }
    _relayer = new Wallet(RELAYER_PRIVATE_KEY, getProvider())
  }
  return _relayer
}

/* =========================
   TX QUEUE (NONCE SAFETY)
========================= */

let txQueue: Promise<any> = Promise.resolve()

function queueTx<T>(fn: () => Promise<T>): Promise<T> {
  const current = txQueue
  txQueue = current.then(fn, fn)
  return txQueue
}

/* =========================
   VERY SIMPLE RATE LIMIT
   (per player, per second)
========================= */

const lastClickMap = new Map<string, number>()
const MIN_INTERVAL_MS = 120 // ~8 clicks/sec max

function rateLimit(player: string) {
  const now = Date.now()
  const last = lastClickMap.get(player) || 0

  if (now - last < MIN_INTERVAL_MS) {
    throw new Error("Rate limit exceeded")
  }

  lastClickMap.set(player, now)
}

/* =========================
   ABIs
========================= */

const GAME_CREDITS_ABI = [
  "function owner() view returns (address)",
  "function authorizedConsumers(address) view returns (bool)",
  "function consumeCredits(address player, uint256 amount)",
  "function credits(address) view returns (uint256)",
]

const META_TX_ABI = [
  "function processClick(address,bytes32,uint256,uint256,bytes)",
]

/* =========================
   ROUTE
========================= */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { player, sessionId, clickCount, authorized, nonce, deadline, signature } = body

    if (!player || !sessionId || !clickCount) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
    }

    rateLimit(player)

    const provider = getProvider()
    const relayer = getRelayer()

    /* =========================
       AUTHORIZED FLOW (NO SIGN)
    ========================= */

    if (authorized) {
      if (!GAME_CREDITS_ADDRESS || GAME_CREDITS_ADDRESS === ethers.ZeroAddress) {
        return NextResponse.json(
          { error: "GameCredits not configured" },
          { status: 500 }
        )
      }

      const creditsContract = new Contract(
        GAME_CREDITS_ADDRESS,
        GAME_CREDITS_ABI,
        relayer
      )

      const balance = await creditsContract.credits(player)
      if (balance < BigInt(clickCount)) {
        return NextResponse.json(
          { error: "Insufficient credits" },
          { status: 400 }
        )
      }

      return await queueTx(async () => {
        const nonceTx = await provider.getTransactionCount(relayer.address, "pending")

        console.log(`[process-meta-click] Consuming ${clickCount} credits for player ${player}`)
        console.log(`[process-meta-click] Balance before: ${await creditsContract.credits(player)}`)
        
        const tx = await creditsContract.consumeCredits(player, clickCount, {
          nonce: nonceTx,
        })

        console.log(`[process-meta-click] Transaction sent: ${tx.hash}`)
        const receipt = await tx.wait()
        
        console.log(`[process-meta-click] Transaction confirmed in block ${receipt.blockNumber}`)
        console.log(`[process-meta-click] Balance after: ${await creditsContract.credits(player)}`)
        console.log(`[process-meta-click] Gas used: ${receipt.gasUsed?.toString()}`)

        return NextResponse.json({
          success: true,
          transactionHash: tx.hash,
          clicksProcessed: clickCount,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed?.toString(),
          method: "direct",
        })
      })
    }

    /* =========================
       SIGNATURE FLOW
    ========================= */

    if (!nonce || !deadline || !signature) {
      return NextResponse.json({ error: "Missing signature data" }, { status: 400 })
    }

    if (Date.now() / 1000 > deadline) {
      return NextResponse.json({ error: "Signature expired" }, { status: 400 })
    }

    const metaTx = new Contract(
      META_TRANSACTION_ADDRESS,
      META_TX_ABI,
      relayer
    )

    const sessionBytes32 = ethers.zeroPadValue(
      ethers.toUtf8Bytes(sessionId),
      32
    )

    return await queueTx(async () => {
      const tx = await metaTx.processClick(
        player,
        sessionBytes32,
        clickCount,
        deadline,
        signature
      )

      const receipt = await tx.wait()

      return NextResponse.json({
        success: true,
        transactionHash: tx.hash,
        clicksProcessed: clickCount,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed?.toString(),
        method: "signature",
      })
    })
  } catch (err: any) {
    console.error("❌ process-meta-click error:", err)

    return NextResponse.json(
      {
        error: "Failed to process click",
        message: err.message || "Unknown error",
      },
      { status: 500 }
    )
  }
}

