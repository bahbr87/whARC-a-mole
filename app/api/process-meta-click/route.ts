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
    if (!RELAYER_PRIVATE_KEY || RELAYER_PRIVATE_KEY === "") {
      console.error("[process-meta-click] ❌ RELAYER_PRIVATE_KEY not configured")
      throw new Error("RELAYER_PRIVATE_KEY not configured")
    }
    _relayer = new Wallet(RELAYER_PRIVATE_KEY, getProvider())
    console.log(`[process-meta-click] ✅ Relayer initialized: ${_relayer.address}`)
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
// ✅ CORREÇÃO: Remover rate limit - cada clique deve gerar uma transação imediatamente
// A regra primordial é: CADA CLIQUE = UMA TRANSAÇÃO NA BLOCKCHAIN
// Não podemos limitar a velocidade, pois isso violaria a regra

function rateLimit(player: string) {
  // ✅ CORREÇÃO: Apenas logar, não bloquear
  // Cada clique deve ser processado imediatamente para gerar uma transação
  const now = Date.now()
  const last = lastClickMap.get(player) || 0
  const interval = now - last
  
  if (interval > 0) {
    console.log(`[process-meta-click] Click interval: ${interval}ms`)
  }
  
  lastClickMap.set(player, now)
  // ✅ Não bloquear - processar imediatamente
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
       ✅ IMPORTANTE: Quando authorized=true, o relayer processa SEM solicitar confirmação
       A autorização foi feita automaticamente ao comprar créditos
       NÃO há popup ou confirmação - o relayer já está autorizado no contrato
    ========================= */

    if (authorized) {
      if (!GAME_CREDITS_ADDRESS || GAME_CREDITS_ADDRESS === ethers.ZeroAddress) {
        console.error("[process-meta-click] ❌ GAME_CREDITS_ADDRESS not configured")
        return NextResponse.json(
          { error: "GameCredits not configured" },
          { status: 500 }
        )
      }

      // ✅ CORREÇÃO: Verificar se o relayer está configurado
      if (!RELAYER_PRIVATE_KEY || RELAYER_PRIVATE_KEY === "") {
        console.error("[process-meta-click] ❌ RELAYER_PRIVATE_KEY not configured")
        return NextResponse.json(
          { error: "Relayer not configured" },
          { status: 500 }
        )
      }

      console.log(`[process-meta-click] ✅ Using relayer: ${relayer.address}`)
      console.log(`[process-meta-click] ✅ GameCredits contract: ${GAME_CREDITS_ADDRESS}`)

      const creditsContract = new Contract(
        GAME_CREDITS_ADDRESS,
        GAME_CREDITS_ABI,
        relayer
      )

      // ✅ CORREÇÃO: Verificar se o relayer está autorizado
      try {
        const isAuthorized = await creditsContract.authorizedConsumers(relayer.address)
        console.log(`[process-meta-click] Relayer authorized? ${isAuthorized}`)
        
        if (!isAuthorized) {
          console.error(`[process-meta-click] ❌ Relayer ${relayer.address} is NOT authorized in GameCredits contract`)
          return NextResponse.json(
            { 
              error: "Relayer not authorized",
              details: `Relayer ${relayer.address} needs to be authorized in GameCredits contract`
            },
            { status: 403 }
          )
        }
      } catch (authError: any) {
        console.error(`[process-meta-click] ❌ Error checking authorization:`, authError.message)
        // Continuar mesmo se houver erro na verificação (pode ser que o contrato não tenha essa função)
      }

      // ✅ CORREÇÃO: Verificar saldo apenas uma vez antes de enviar a transação
      // Não vamos verificar depois para evitar chamadas RPC extras
      const balanceBefore = await creditsContract.credits(player)
      console.log(`[process-meta-click] Player ${player} balance before: ${balanceBefore.toString()}`)
      
      if (balanceBefore < BigInt(clickCount)) {
        console.error(`[process-meta-click] Insufficient credits: ${balanceBefore.toString()} < ${clickCount}`)
        return NextResponse.json(
          { error: "Insufficient credits" },
          { status: 400 }
        )
      }

      // ✅ CORREÇÃO: Usar queueTx apenas para segurança de nonce (evitar nonce duplicado)
      // Não vamos esperar confirmação nem verificar saldo depois
      return await queueTx(async () => {
        const nonceTx = await provider.getTransactionCount(relayer.address, "pending")

        console.log(`[process-meta-click] Consuming ${clickCount} credits for player ${player}`)
        
        // ✅ Enviar transação e retornar imediatamente (SEM esperar confirmação)
        const tx = await creditsContract.consumeCredits(player, clickCount, {
          nonce: nonceTx,
        })

        console.log(`[process-meta-click] Transaction sent: ${tx.hash}`)
        
        // ✅ CORREÇÃO: Retornar imediatamente após enviar a transação
        // NÃO esperar confirmação (tx.wait()) para evitar rate-limit
        // NÃO consultar saldo depois para evitar chamadas RPC extras
        // A transação será confirmada na blockchain, mas não precisamos esperar aqui
        
        return NextResponse.json({
          success: true,
          transactionHash: tx.hash,
          clicksProcessed: clickCount,
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

