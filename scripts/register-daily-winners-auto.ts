import { ethers } from "ethers"
import * as dotenv from "dotenv"
import { promises as fs } from "fs"
import path from "path"

dotenv.config({ path: ".env.local" })

/**
 * CONFIGURAÇÃO
 */
const RPC_URL = process.env.RPC_URL || "https://rpc.testnet.arc.network"
const OWNER_PRIVATE_KEY = process.env.PRIZE_POOL_OWNER_PRIVATE_KEY!
const PRIZE_POOL_ADDRESS = process.env.PRIZE_POOL_CONTRACT_ADDRESS || "0xB98b8A9213072903277B9f592009E7C22acd2dd3"

if (!OWNER_PRIVATE_KEY) {
  console.error("❌ PRIZE_POOL_OWNER_PRIVATE_KEY não configurado no .env.local")
  process.exit(1)
}

/**
 * ABI mínima necessária
 */
const PRIZE_POOL_ABI = [
  "function setDailyWinnersArray(uint256 date, address[] calldata winners) external",
  "function isWinnersRegistered(uint256 date) view returns (bool)",
  "function owner() view returns (address)",
  "function getWinner(uint256 date, uint256 rank) view returns (address)",
]

/**
 * Interface do ranking
 */
interface RankingEntry {
  player: string
  score: number
  goldenMoles: number
  errors: number
  timestamp: number
}

/**
 * UTIL – dias desde epoch (UTC)
 * 🎯 REGRA DE OURO: Use EXATAMENTE esta função (mesma do frontend/backend)
 */
function getDaysSinceEpochUTC(date: Date): number {
  const utc = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    0, 0, 0, 0
  )
  return Math.floor(utc / (1000 * 60 * 60 * 24))
}

/**
 * Get UTC day start and end
 */
function getUTCDayStart(date: Date): number {
  const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0))
  return utcDate.getTime()
}

function getUTCDayEnd(date: Date): number {
  const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999))
  return utcDate.getTime()
}

/**
 * Retorna o ranking FINAL do dia UTC especificado
 */
async function getDailyRanking(date: Date): Promise<string[]> {
  const RANKINGS_FILE = path.join(process.cwd(), "data", "rankings.json")
  
  let rankings: RankingEntry[] = []
  try {
    const data = await fs.readFile(RANKINGS_FILE, "utf-8")
    rankings = JSON.parse(data)
    if (!Array.isArray(rankings)) {
      rankings = []
    }
  } catch (error) {
    console.warn("⚠️ Arquivo de rankings não encontrado ou vazio")
    return []
  }

  const dayStart = getUTCDayStart(date)
  const dayEnd = getUTCDayEnd(date)

  const dayRankings = rankings
    .filter((entry) => entry.timestamp >= dayStart && entry.timestamp <= dayEnd)
    .reduce((acc, entry) => {
      const existing = acc.get(entry.player)
      if (existing) {
        existing.score += entry.score
        existing.goldenMoles += entry.goldenMoles
        existing.errors += entry.errors
      } else {
        acc.set(entry.player, {
          player: entry.player,
          score: entry.score,
          goldenMoles: entry.goldenMoles,
          errors: entry.errors,
          timestamp: entry.timestamp,
        })
      }
      return acc
    }, new Map<string, RankingEntry>())

  const sorted = Array.from(dayRankings.values()).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (b.goldenMoles !== a.goldenMoles) return b.goldenMoles - a.goldenMoles
    if (a.errors !== b.errors) return a.errors - b.errors
    return a.timestamp - b.timestamp
  })

  const winners: string[] = []
  
  if (sorted.length >= 1) {
    winners.push(sorted[0].player)
  }
  if (sorted.length >= 2) {
    winners.push(sorted[1].player)
  }
  if (sorted.length >= 3) {
    winners.push(sorted[2].player)
  }

  return winners
}

/**
 * SCRIPT AUTOMÁTICO - Executa registro do dia anterior (UTC)
 * 
 * Este script deve ser executado TODO DIA após virar o dia UTC
 * 
 * Fórmula exata executada:
 * await prizePool.setDailyWinnersArray(day, winners)
 */
async function main() {
  const startTime = Date.now()
  console.log("🚀 Iniciando registro automático diário de vencedores")
  console.log("⏰ Timestamp:", new Date().toISOString())

  try {
    // Sempre fechar o DIA ANTERIOR (UTC)
    const now = new Date()
    const yesterdayUTC = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - 1
    ))

    const day = getDaysSinceEpochUTC(yesterdayUTC)

    console.log("📅 Dia UTC anterior:", yesterdayUTC.toISOString().split("T")[0])
    console.log("🧮 Days since epoch:", day)

    /**
     * PROVIDER + WALLET
     */
    const provider = new ethers.JsonRpcProvider(RPC_URL)
    const wallet = new ethers.Wallet(OWNER_PRIVATE_KEY, provider)

    console.log("🔑 Wallet:", wallet.address)

    /**
     * CONTRATO
     */
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
    console.log("✅ Wallet confirmada como owner do contrato")

    // Verificar se já está registrado (ANTI-BUG)
    const alreadySet = await prizePool.isWinnersRegistered(day)
    if (alreadySet) {
      console.log("ℹ️ Vencedores já registrados para este dia. Nada a fazer.")
      console.log("\n📋 Vencedores registrados on-chain:")
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
      process.exit(0)
    }

    const winners = await getDailyRanking(yesterdayUTC)

    if (winners.length === 0) {
      console.log("⚠️ Nenhum jogador no dia. Nada a registrar.")
      process.exit(0)
    }

    if (winners.length > 3) {
      throw new Error("Ranking inválido: mais de 3 vencedores")
    }

    console.log("🏆 Vencedores calculados:", winners)
    console.log(`   Total: ${winners.length} jogador(es)`)

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

    const duration = ((Date.now() - startTime) / 1000).toFixed(2)
    console.log(`\n⏱️ Tempo total: ${duration}s`)
    console.log("✅ Script concluído com sucesso!")
    
    process.exit(0)
  } catch (error: any) {
    console.error("❌ Erro ao registrar vencedores:", error.message || error)
    if (error.stack) {
      console.error("Stack trace:", error.stack)
    }
    process.exit(1)
  }
}

main()

