import { promises as fs } from "fs"
import path from "path"
import * as dotenv from "dotenv"

dotenv.config({ path: path.join(process.cwd(), ".env.local") })

interface RankingEntry {
  player: string
  score: number
  goldenMoles: number
  errors: number
  timestamp: number
}

function getDaysSinceEpochUTC(date: Date): number {
  const utc = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    0, 0, 0, 0
  )
  return Math.floor(utc / (1000 * 60 * 60 * 24))
}

function getUTCDayStart(date: Date): number {
  const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0))
  return utcDate.getTime()
}

function getUTCDayEnd(date: Date): number {
  const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999))
  return utcDate.getTime()
}

async function checkRankingsForDate(dateString: string) {
  console.log("=".repeat(70))
  console.log("🔍 VERIFICANDO RANKINGS PARA A DATA")
  console.log("=".repeat(70))
  console.log("")

  const date = new Date(dateString + "T00:00:00Z")
  const dayStart = getUTCDayStart(date)
  const dayEnd = getUTCDayEnd(date)
  const day = getDaysSinceEpochUTC(date)

  console.log(`📅 Data: ${dateString}`)
  console.log(`🧮 Days since epoch: ${day}`)
  console.log(`⏰ Range UTC: ${new Date(dayStart).toISOString()} - ${new Date(dayEnd).toISOString()}`)
  console.log("")

  try {
    // Load rankings file
    const rankingsPath = path.join(process.cwd(), "data", "rankings.json")
    const rankingsData = await fs.readFile(rankingsPath, "utf-8")
    const allRankings: RankingEntry[] = JSON.parse(rankingsData)

    console.log(`📊 Total de rankings no arquivo: ${allRankings.length}`)
    console.log("")

    // Filter rankings for this day
    const dayRankings = allRankings.filter(
      (entry) => entry.timestamp >= dayStart && entry.timestamp <= dayEnd
    )

    console.log(`📈 Rankings para ${dateString}: ${dayRankings.length}`)
    console.log("")

    if (dayRankings.length === 0) {
      console.log("❌ Nenhum ranking encontrado para este dia")
      console.log("")
      console.log("💡 Possíveis causas:")
      console.log("   1. Nenhum jogador jogou neste dia")
      console.log("   2. Os rankings não foram salvos corretamente")
      console.log("   3. A data está incorreta")
      console.log("")
      return
    }

    // Aggregate by player
    const playerMap = new Map<string, RankingEntry>()
    for (const entry of dayRankings) {
      const existing = playerMap.get(entry.player)
      if (existing) {
        existing.score += entry.score
        existing.goldenMoles += entry.goldenMoles
        existing.errors += entry.errors
      } else {
        playerMap.set(entry.player, {
          ...entry,
        })
      }
    }

    const aggregatedRankings = Array.from(playerMap.values())
    aggregatedRankings.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      if (b.goldenMoles !== a.goldenMoles) return b.goldenMoles - a.goldenMoles
      if (a.errors !== b.errors) return a.errors - b.errors
      return a.timestamp - b.timestamp
    })

    console.log(`👥 Jogadores únicos: ${aggregatedRankings.length}`)
    console.log("")
    console.log("🏆 Ranking do dia:")
    console.log("")

    aggregatedRankings.forEach((player, index) => {
      const rank = index + 1
      const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : "  "
      console.log(`${medal} ${rank}º lugar: ${player.player}`)
      console.log(`   Score: ${player.score}`)
      console.log(`   Golden Moles: ${player.goldenMoles}`)
      console.log(`   Errors: ${player.errors}`)
      console.log("")
    })

    // Show top 3
    const top3 = aggregatedRankings.slice(0, 3)
    console.log("=".repeat(70))
    console.log("📋 TOP 3 VENCEDORES (para registro no contrato):")
    console.log("=".repeat(70))
    console.log("")
    
    if (top3.length >= 1) {
      console.log(`1º: ${top3[0].player}`)
    }
    if (top3.length >= 2) {
      console.log(`2º: ${top3[1].player}`)
    }
    if (top3.length >= 3) {
      console.log(`3º: ${top3[2].player}`)
    }
    console.log("")

  } catch (error: any) {
    console.error("❌ Erro ao verificar rankings:", error.message)
    if (error.code === "ENOENT") {
      console.error("   Arquivo data/rankings.json não encontrado")
    }
  }
}

// Get date from command line argument
const dateArg = process.argv[2]

if (!dateArg) {
  console.error("❌ Uso: npx tsx scripts/check-rankings-for-date.ts <data>")
  console.error("   Exemplo: npx tsx scripts/check-rankings-for-date.ts 2025-12-21")
  process.exit(1)
}

checkRankingsForDate(dateArg).catch(console.error)



