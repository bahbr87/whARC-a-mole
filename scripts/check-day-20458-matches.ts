/**
 * Script para verificar os timestamps reais dos matches do dia 20458
 */

import * as dotenv from "dotenv"
import { supabaseAdmin } from "@/lib/supabase"
import { getDayId } from "@/utils/day"

dotenv.config({ path: ".env.local" })

async function main() {
  console.log("🔍 Verificando matches do dia 20458 no banco...\n")

  // Buscar matches com day=20458
  const { data: matches, error } = await supabaseAdmin
    .from("matches")
    .select("id, player, points, timestamp, day")
    .eq("day", 20458)
    .limit(20)

  if (error) {
    console.error("❌ Erro:", error)
    return
  }

  if (!matches || matches.length === 0) {
    console.log("⚠️ Nenhum match encontrado com day=20458")
    return
  }

  console.log(`✅ Encontrados ${matches.length} matches com day=20458\n`)

  matches.forEach((match: any, idx: number) => {
    console.log(`\nMatch ${idx + 1}:`)
    console.log(`   ID: ${match.id}`)
    console.log(`   Player: ${match.player}`)
    console.log(`   Points: ${match.points}`)
    console.log(`   Day (banco): ${match.day}`)
    console.log(`   Timestamp (banco): ${match.timestamp}`)
    
    // Converter timestamp
    let ts: Date
    if (typeof match.timestamp === "string") {
      let fixed = match.timestamp
      if (fixed.includes(" ")) {
        fixed = fixed.replace(" ", "T")
      }
      fixed = fixed.replace(/\+00:00$/, "Z").replace(/\+00$/, "Z")
      ts = new Date(fixed)
    } else {
      ts = new Date(match.timestamp)
    }
    
    const timestampMs = ts.getTime()
    const calculatedDay = getDayId(ts)
    
    console.log(`   Timestamp (ms): ${timestampMs}`)
    console.log(`   Timestamp (ISO): ${ts.toISOString()}`)
    console.log(`   Day calculado: ${calculatedDay}`)
    console.log(`   ✅ Match? ${calculatedDay === 20458 ? "SIM" : "NÃO"}`)
    
    // Verificar range esperado
    const dayStart = 20458 * 86400000
    const dayEnd = dayStart + 86400000 - 1
    const inRange = timestampMs >= dayStart && timestampMs <= dayEnd
    console.log(`   No range esperado? ${inRange ? "SIM" : "NÃO"}`)
    console.log(`   Range: ${new Date(dayStart).toISOString()} até ${new Date(dayEnd).toISOString()}`)
  })
}

main().catch(console.error)

