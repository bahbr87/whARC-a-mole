import { ethers } from "ethers"
import dotenv from "dotenv"

dotenv.config({ path: ".env.local" })

/**
 * CONFIG
 */
const RPC_URL = process.env.RPC_URL || "https://rpc.testnet.arc.network"
const OWNER_PRIVATE_KEY = process.env.PRIZE_POOL_OWNER_PRIVATE_KEY!
const PRIZE_POOL_ADDRESS = process.env.PRIZE_POOL_CONTRACT_ADDRESS || "0xB98b8A9213072903277B9f592009E7C22acd2dd3"

if (!OWNER_PRIVATE_KEY) {
  throw new Error("PRIZE_POOL_OWNER_PRIVATE_KEY não configurado no .env.local")
}

/**
 * ABI mínima
 */
const PRIZE_POOL_ABI = [
  "function setDailyWinnersArray(uint256 date, address[] calldata winners) external",
  "function isWinnersRegistered(uint256 date) view returns (bool)",
  "function getWinner(uint256 date, uint256 rank) view returns (address)",
  "function owner() view returns (address)",
]

const DAY_MS = 86400000

/**
 * 🎯 REGRA DE OURO: Use EXATAMENTE esta função (mesma do frontend/backend)
 */
function getDaysSinceEpochUTC(date: Date): number {
  const utc = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    0, 0, 0, 0
  ))
  return Math.floor(utc.getTime() / DAY_MS)
}

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL)
  const wallet = new ethers.Wallet(OWNER_PRIVATE_KEY, provider)

  const prizePool = new ethers.Contract(
    PRIZE_POOL_ADDRESS,
    PRIZE_POOL_ABI,
    wallet
  )

  // Verificar se wallet é owner
  const contractOwner = await prizePool.owner()
  if (contractOwner.toLowerCase() !== wallet.address.toLowerCase()) {
    throw new Error(`Wallet ${wallet.address} não é o owner do contrato. Owner: ${contractOwner}`)
  }
  console.log("✅ Wallet confirmada como owner:", wallet.address)

  // 🔒 DIA FIXO: 16/12/2025 UTC
  const targetDateUTC = new Date("2025-12-16T00:00:00Z")
  const day = getDaysSinceEpochUTC(targetDateUTC)

  console.log("📅 Corrigindo dia:", day, "(16/12/2025 UTC)")
  console.log("📅 Data UTC:", targetDateUTC.toISOString().split("T")[0])

  const alreadyRegistered = await prizePool.isWinnersRegistered(day)

  if (alreadyRegistered) {
    console.log("⏭️ Dia já possui winners registrados. Nada a fazer.")
    console.log("\n📋 Vencedores atuais on-chain:")
    const winner1 = await prizePool.getWinner(day, 1)
    const winner2 = await prizePool.getWinner(day, 2)
    const winner3 = await prizePool.getWinner(day, 3)
    
    console.log(`   1º lugar: ${winner1}`)
    if (winner2 !== ethers.ZeroAddress) {
      console.log(`   2º lugar: ${winner2}`)
    }
    if (winner3 !== ethers.ZeroAddress) {
      console.log(`   3º lugar: ${winner3}`)
    }
    return
  }

  // ⚙️ CONFIGURAÇÃO: Ajuste os vencedores aqui
  const winners: string[] = [
    "0xB51158878a08a860443B10b2F24617bab5F1F3eA", // rank 1
    // "0x...", // rank 2 (opcional)
    // "0x...", // rank 3 (opcional)
  ]

  if (winners.length === 0) {
    throw new Error("⚠️ Configure os endereços dos vencedores no array 'winners'")
  }

  // Validar endereços
  for (let i = 0; i < winners.length; i++) {
    if (!ethers.isAddress(winners[i])) {
      throw new Error(`Endereço inválido no índice ${i}: ${winners[i]}`)
    }
    if (winners[i] === ethers.ZeroAddress) {
      throw new Error(`Zero address não permitido no índice ${i}`)
    }
    for (let j = i + 1; j < winners.length; j++) {
      if (winners[i].toLowerCase() === winners[j].toLowerCase()) {
        throw new Error(`Endereço duplicado: ${winners[i]}`)
      }
    }
  }

  if (winners.length > 3) {
    throw new Error("Ranking inválido: mais de 3 vencedores")
  }

  console.log("🏆 Vencedores a registrar:", winners)
  console.log(`   Total: ${winners.length} jogador(es)`)

  /**
   * REGISTRO ON-CHAIN
   * 
   * Fórmula exata:
   * await prizePool.setDailyWinnersArray(day, winners)
   */
  console.log("⛓️ Enviando transação...")
  console.log(`   Chamando: setDailyWinnersArray(${day}, [${winners.map(w => `"${w}"`).join(", ")}])`)

  const tx = await prizePool.setDailyWinnersArray(day, winners)
  console.log("📤 TX enviada:", tx.hash)
  console.log("⏳ Aguardando confirmação...")

  const receipt = await tx.wait()

  if (!receipt || receipt.status !== 1) {
    throw new Error("Transação falhou")
  }

  console.log("✅ Vencedores registrados com sucesso!")
  console.log("🔗 Explorer:", `https://testnet.arcscan.app/tx/${tx.hash}`)

  // Verificar vencedores registrados on-chain
  console.log("\n📋 Verificando vencedores registrados on-chain:")
  const winner1 = await prizePool.getWinner(day, 1)
  const winner2 = await prizePool.getWinner(day, 2)
  const winner3 = await prizePool.getWinner(day, 3)
  
  console.log(`   1º lugar: ${winner1}`)
  if (winner2 !== ethers.ZeroAddress) {
    console.log(`   2º lugar: ${winner2}`)
  }
  if (winner3 !== ethers.ZeroAddress) {
    console.log(`   3º lugar: ${winner3}`)
  }
}

main().catch((err) => {
  console.error("❌ Erro:", err.message || err)
  process.exit(1)
})

