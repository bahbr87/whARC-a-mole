/**
 * Script para testar a conversão de timestamp e cálculo de day
 */

import { getDayId } from "@/utils/day"

// Testar diferentes formatos de timestamp do Supabase
const testTimestamps = [
  "2026-01-05T00:00:00.000Z",
  "2026-01-05 00:00:00.000+00",
  "2026-01-05T12:30:45.123Z",
  "2026-01-05 12:30:45.123+00",
  "2026-01-06T00:00:00.000Z",
  "2026-01-06 00:00:00.000+00",
]

console.log("🧪 Testando conversão de timestamps e cálculo de day\n")

testTimestamps.forEach((tsStr) => {
  console.log(`\n📅 Timestamp original: ${tsStr}`)
  
  // Método 1: Conversão direta (como está no código atual)
  try {
    const date1 = new Date(tsStr)
    const timestamp1 = date1.getTime()
    const day1 = getDayId(date1)
    console.log(`   Método 1 (direto): timestamp=${timestamp1}, day=${day1}`)
  } catch (err) {
    console.log(`   Método 1 (direto): ERRO - ${err}`)
  }

  // Método 2: Conversão com replace (como no findPendingDays)
  try {
    const fixedStr = tsStr.replace(" ", "T").replace("+00", "Z")
    const date2 = new Date(fixedStr)
    const timestamp2 = date2.getTime()
    const day2 = getDayId(date2)
    console.log(`   Método 2 (replace): timestamp=${timestamp2}, day=${day2}`)
  } catch (err) {
    console.log(`   Método 2 (replace): ERRO - ${err}`)
  }
})

// Testar o range de timestamp usado em calculateDailyWinners
console.log(`\n${"=".repeat(60)}`)
console.log("🔍 Testando range de timestamp usado em calculateDailyWinners")
console.log(`${"=".repeat(60)}\n`)

const day05 = 20458
const day06 = 20459

const day05Start = day05 * 86400000
const day05End = day05Start + 86400000 - 1
const day06Start = day06 * 86400000
const day06End = day06Start + 86400000 - 1

console.log(`Dia 20458:`)
console.log(`   Start: ${day05Start} (${new Date(day05Start).toISOString()})`)
console.log(`   End: ${day05End} (${new Date(day05End).toISOString()})`)
console.log(`   Day calculado do start: ${getDayId(new Date(day05Start))}`)
console.log(`   Day calculado do end: ${getDayId(new Date(day05End))}`)

console.log(`\nDia 20459:`)
console.log(`   Start: ${day06Start} (${new Date(day06Start).toISOString()})`)
console.log(`   End: ${day06End} (${new Date(day06End).toISOString()})`)
console.log(`   Day calculado do start: ${getDayId(new Date(day06Start))}`)
console.log(`   Day calculado do end: ${getDayId(new Date(day06End))}`)

// Testar se um timestamp dentro do range seria filtrado corretamente
console.log(`\n${"=".repeat(60)}`)
console.log("🧪 Testando se timestamps dentro do range seriam filtrados")
console.log(`${"=".repeat(60)}\n`)

const testCases = [
  { ts: "2026-01-05T00:00:00.000Z", expectedDay: 20458 },
  { ts: "2026-01-05T12:00:00.000Z", expectedDay: 20458 },
  { ts: "2026-01-05T23:59:59.999Z", expectedDay: 20458 },
  { ts: "2026-01-06T00:00:00.000Z", expectedDay: 20459 },
  { ts: "2026-01-06T12:00:00.000Z", expectedDay: 20459 },
]

testCases.forEach(({ ts, expectedDay }) => {
  const date = new Date(ts)
  const timestamp = date.getTime()
  const day = getDayId(date)
  
  const rangeStart = expectedDay * 86400000
  const rangeEnd = rangeStart + 86400000 - 1
  
  const inRange = timestamp >= rangeStart && timestamp <= rangeEnd
  
  console.log(`Timestamp: ${ts}`)
  console.log(`   Timestamp (ms): ${timestamp}`)
  console.log(`   Day calculado: ${day} (esperado: ${expectedDay})`)
  console.log(`   Range: ${rangeStart} até ${rangeEnd}`)
  console.log(`   Está no range: ${inRange ? "✅" : "❌"}`)
  console.log(`   Seria filtrado: ${inRange && day === expectedDay ? "✅ SIM" : "❌ NÃO"}\n`)
})

