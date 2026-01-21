import { ethers } from "ethers"
import * as dotenv from "dotenv"
import { supabaseAdmin } from "@/lib/supabase"

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
 * ABI EXATA do PrizePool.sol atual
 */
const PRIZE_POOL_ABI = [
  "function setDailyWinners(uint256 day, address[] winners, uint256 totalPlayers) external",
  "function totalPlayers(uint256 day) view returns (uint256)",
  "function winners(uint256 day, uint256 rank) view returns (address)",
  "function owner() view returns (address)",
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
 * Retorna o ranking FINAL do dia UTC especificado do Supabase
 * Retorna os vencedores (top 1-3) e o total de jogadores
 * ABORTA se não houver jogadores ou se houver erro
 */
async function getDailyRanking(date: Date): Promise<{ winners: string[], totalPlayers: number }> {
  console.log("📊 Carregando rankings do Supabase para o dia:", date.toISOString().split("T")[0])
  
  // Calcular day ID para filtrar
  const dayId = getDaysSinceEpochUTC(date)
  
  // Buscar matches do dia no Supabase
  const { data: matches, error } = await supabaseAdmin
    .from("matches")
    .select("player, points, golden_moles, errors, timestamp, day")
    .eq("day", dayId)
    .order("points", { ascending: false })
    .order("golden_moles", { ascending: false })
    .order("errors", { ascending: true })

  if (error) {
    throw new Error(`Erro ao buscar matches do Supabase: ${error.message}`)
  }

  if (!matches || matches.length === 0) {
    throw new Error("Nenhum jogador encontrado no Supabase para este dia. Nada a registrar.")
  }

  console.log(`📊 Encontrados ${matches.length} matches no Supabase`)

  // Converter matches para RankingEntry e agregar por player
  const dayRankings = matches.reduce((acc, match) => {
    // Converter timestamp de forma segura
    let timestamp: number
    if (typeof match.timestamp === "string") {
      let fixedTimestamp = match.timestamp
      if (fixedTimestamp.includes(" ")) {
        fixedTimestamp = fixedTimestamp.replace(" ", "T")
      }
      fixedTimestamp = fixedTimestamp.replace(/\+00:00$/, "Z").replace(/\+00$/, "Z")
      const date = new Date(fixedTimestamp)
      if (isNaN(date.getTime())) {
        return acc
      }
      timestamp = date.getTime()
    } else {
      timestamp = new Date(match.timestamp).getTime()
      if (isNaN(timestamp)) {
        return acc
      }
    }

    const existing = acc.get(match.player?.toLowerCase() || "")
    if (existing) {
      existing.score += match.points || 0
      existing.goldenMoles += match.golden_moles || 0
      existing.errors += match.errors || 0
    } else {
      acc.set(match.player?.toLowerCase() || "", {
        player: match.player || "",
        score: match.points || 0,
        goldenMoles: match.golden_moles || 0,
        errors: match.errors || 0,
        timestamp: timestamp,
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

  console.log(`📊 Total de jogadores únicos: ${sorted.length}`)

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

  return { winners, totalPlayers: sorted.length }
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

  // Sempre fechar o DIA ANTERIOR (UTC)
  const now = new Date()
  const yesterdayUTC = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() - 1
  ))

  const day = getDaysSinceEpochUTC(yesterdayUTC)

  // ✅ AJUSTE 1: Proteção absoluta contra registrar dia atual ou futuro
  const todayDay = getDaysSinceEpochUTC(new Date())
  if (day >= todayDay) {
    throw new Error("Tentativa de registrar um dia que ainda não foi finalizado (UTC)")
  }

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

  /**
   * REGRA 2: Verificar totalPlayers ANTES de registrar
   * SE a leitura falhar → ABORTAR
   * SE totalPlayers(day) > 0 → ABORTAR (dia já finalizado)
   */
  console.log("🔍 Verificando se o dia já está finalizado...")
  const totalPlayersOnChain = await prizePool.totalPlayers(day)
  if (totalPlayersOnChain > BigInt(0)) {
    console.log(`ℹ️ Dia já finalizado. totalPlayers(${day}) = ${totalPlayersOnChain}`)
    console.log("📋 Vencedores já registrados:")
    for (let rank = 1; rank <= 3; rank++) {
      const winner = await prizePool.winners(day, rank)
      if (winner && winner !== ethers.ZeroAddress) {
        console.log(`   ${rank}º lugar: ${winner}`)
      }
    }
    process.exit(0)
  }
  console.log("✅ Dia ainda não finalizado. Prosseguindo...")

  /**
   * REGRA 3: Buscar ranking EXCLUSIVAMENTE do Supabase
   * Se não houver jogadores no dia → ABORTAR
   */
  const { winners, totalPlayers } = await getDailyRanking(yesterdayUTC)

  if (winners.length > 3) {
    throw new Error("Ranking inválido: mais de 3 vencedores")
  }

  console.log("🏆 Vencedores calculados:", winners)
  console.log(`   Vencedores: ${winners.length} jogador(es)`)
  console.log(`   Total de jogadores: ${totalPlayers}`)

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

  // ✅ AJUSTE 2: Normalizar endereços dos vencedores (lowercase)
  const normalizedWinners = winners.map(w => w.toLowerCase())

  /**
   * REGISTRO ON-CHAIN
   * 
   * ABI CORRETA: setDailyWinners(uint256 day, address[] winners, uint256 totalPlayers)
   */
  // ✅ AJUSTE 3: Log explícito do dia humano para debug futuro
  console.log(
    `📌 Registrando vencedores para DAY=${day} (${yesterdayUTC.toISOString().split("T")[0]})`
  )
  console.log("⛓️ Enviando transação...")
  console.log(`   Chamando: setDailyWinners(${day}, [${normalizedWinners.map(w => `"${w}"`).join(", ")}], ${totalPlayers})`)

  const tx = await prizePool.setDailyWinners(day, normalizedWinners, totalPlayers)
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
  for (let rank = 1; rank <= 3; rank++) {
    const winner = await prizePool.winners(day, rank)
    if (winner && winner !== ethers.ZeroAddress) {
      console.log(`   ${rank}º lugar: ${winner}`)
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2)
  console.log(`\n⏱️ Tempo total: ${duration}s`)
  console.log("✅ Script concluído com sucesso!")
  
  process.exit(0)
}

main().catch((error: any) => {
  console.error("❌ Erro fatal:", error.message || error)
  if (error.stack) {
    console.error("Stack trace:", error.stack)
  }
  process.exit(1)
})

