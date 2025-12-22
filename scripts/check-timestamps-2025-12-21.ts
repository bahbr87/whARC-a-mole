import { readFileSync } from "fs"
import path from "path"
import { getDayId } from "../utils/day"
import { getUTCDayStart, getUTCDayEnd } from "../lib/date-utils"

const rankingsFile = path.join(process.cwd(), "data", "rankings.json")
const rankings = JSON.parse(readFileSync(rankingsFile, "utf-8"))

const date = new Date("2025-12-21")
const dayStart = getUTCDayStart(date)
const dayEnd = getUTCDayEnd(date)
const dayId = getDayId(date)

console.log("=".repeat(70))
console.log("🔍 VERIFICANDO TIMESTAMPS DO DIA 21/12/2025")
console.log("=".repeat(70))
console.log("")
console.log(`📅 Data: ${date.toISOString().split('T')[0]}`)
console.log(`📅 Day ID: ${dayId}`)
console.log(`📅 Day Start (UTC): ${dayStart} = ${new Date(dayStart).toISOString()}`)
console.log(`📅 Day End (UTC): ${dayEnd} = ${new Date(dayEnd).toISOString()}`)
console.log("")

const filtered = rankings.filter((entry: any) => entry.timestamp >= dayStart && entry.timestamp <= dayEnd)

console.log(`📊 Total rankings no arquivo: ${rankings.length}`)
console.log(`📊 Rankings filtrados para 21/12/2025: ${filtered.length}`)
console.log("")

if (filtered.length > 0) {
  console.log("📋 Primeiros 10 rankings filtrados:")
  filtered.slice(0, 10).forEach((entry: any, index: number) => {
    const entryDate = new Date(entry.timestamp)
    console.log(`  ${index + 1}. ${entryDate.toISOString()} - Score: ${entry.score} - Player: ${entry.player.substring(0, 10)}...`)
  })
  console.log("")
  
  // Verificar se todos são do mesmo jogador
  const uniquePlayers = new Set(filtered.map((e: any) => e.player.toLowerCase()))
  console.log(`👥 Jogadores únicos: ${uniquePlayers.size}`)
  uniquePlayers.forEach(player => {
    const playerRankings = filtered.filter((e: any) => e.player.toLowerCase() === player)
    console.log(`   ${player.substring(0, 10)}...: ${playerRankings.length} rankings`)
  })
} else {
  console.log("❌ Nenhum ranking encontrado para esta data")
  console.log("")
  console.log("📋 Verificando timestamps próximos:")
  const nearby = rankings
    .map((e: any) => ({ ...e, date: new Date(e.timestamp).toISOString().split('T')[0] }))
    .filter((e: any) => {
      const eDate = new Date(e.timestamp)
      const diff = Math.abs(eDate.getTime() - dayStart)
      return diff < 7 * 24 * 60 * 60 * 1000 // 7 dias
    })
    .slice(0, 10)
  
  nearby.forEach((entry: any) => {
    console.log(`  ${entry.date} - ${new Date(entry.timestamp).toISOString()} - Score: ${entry.score}`)
  })
}

console.log("")
console.log("=".repeat(70))



