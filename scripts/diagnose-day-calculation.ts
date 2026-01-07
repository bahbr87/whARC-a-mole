/**
 * Script para diagnosticar o problema de cálculo de day para os dias 20458 e 20459
 */

import * as dotenv from "dotenv"
import { getDayId } from "@/utils/day"
import { supabaseAdmin } from "@/lib/supabase"

dotenv.config({ path: ".env.local" })

async function main() {
  console.log("🔍 Diagnosticando cálculo de day para 20458 e 20459\n")

  const day05 = 20458
  const day06 = 20459

  // Calcular o range de timestamp esperado
  const day05StartTimestamp = day05 * 86400000
  const day05EndTimestamp = day05StartTimestamp + 86400000 - 1
  const day06StartTimestamp = day06 * 86400000
  const day06EndTimestamp = day06StartTimestamp + 86400000 - 1

  console.log("📊 Range de timestamps esperado:")
  console.log(`   Dia 20458: ${day05StartTimestamp} até ${day05EndTimestamp}`)
  console.log(`   Dia 20458: ${new Date(day05StartTimestamp).toISOString()} até ${new Date(day05EndTimestamp).toISOString()}`)
  console.log(`   Dia 20459: ${day06StartTimestamp} até ${day06EndTimestamp}`)
  console.log(`   Dia 20459: ${new Date(day06StartTimestamp).toISOString()} até ${new Date(day06EndTimestamp).toISOString()}\n`)

  try {
    // Buscar TODOS os matches do Supabase
    console.log("📥 Buscando matches do Supabase...")
    const { data: matches, error } = await supabaseAdmin
      .from("matches")
      .select("id, player, points, golden_moles, errors, timestamp, day")
      .order("timestamp", { ascending: true })

    if (error) {
      console.error("❌ Erro ao buscar matches:", error)
      return
    }

    if (!matches || matches.length === 0) {
      console.log("⚠️ Nenhum match encontrado no Supabase")
      return
    }

    console.log(`✅ Encontrados ${matches.length} matches no total\n`)

    // Analisar matches próximos aos dias 20458 e 20459
    console.log("🔍 Analisando matches próximos aos dias 20458 e 20459...\n")

    const relevantMatches: any[] = []

    matches.forEach((match: any) => {
      let matchTimestamp: number
      let matchDay: number | null = null
      let timestampStr = match.timestamp

      // Tentar converter timestamp
      try {
        if (typeof match.timestamp === "string") {
          // Tentar diferentes formatos
          let dateStr = match.timestamp
          
          // Se tem espaço, substituir por T e +00 por Z
          if (dateStr.includes(" ")) {
            dateStr = dateStr.replace(" ", "T").replace("+00", "Z")
          }
          
          const date = new Date(dateStr)
          if (isNaN(date.getTime())) {
            console.warn(`⚠️ Timestamp inválido para match ${match.id}: ${match.timestamp}`)
            return
          }
          matchTimestamp = date.getTime()
        } else {
          matchTimestamp = new Date(match.timestamp).getTime()
        }

        // Calcular day do timestamp
        matchDay = getDayId(new Date(matchTimestamp))

        // Verificar se está próximo aos dias que queremos
        if (matchDay === day05 || matchDay === day06 || matchDay === day05 - 1 || matchDay === day05 + 1 || matchDay === day06 - 1 || matchDay === day06 + 1) {
          relevantMatches.push({
            id: match.id,
            player: match.player,
            points: match.points,
            timestamp: timestampStr,
            timestampMs: matchTimestamp,
            dayFromTimestamp: matchDay,
            dayFromDB: match.day,
            inRange05: matchTimestamp >= day05StartTimestamp && matchTimestamp <= day05EndTimestamp,
            inRange06: matchTimestamp >= day06StartTimestamp && matchTimestamp <= day06EndTimestamp,
          })
        }
      } catch (err: any) {
        console.warn(`⚠️ Erro ao processar match ${match.id}:`, err.message)
      }
    })

    console.log(`📋 Encontrados ${relevantMatches.length} matches relevantes:\n`)

    if (relevantMatches.length === 0) {
      console.log("❌ NENHUM match encontrado próximo aos dias 20458 e 20459!")
      console.log("\n💡 Possíveis causas:")
      console.log("   1. Não há matches salvos para esses dias")
      console.log("   2. Os timestamps estão em formato diferente do esperado")
      console.log("   3. Os matches estão em dias diferentes")
      
      // Mostrar alguns matches de exemplo
      console.log("\n📊 Primeiros 5 matches do banco (para referência):")
      matches.slice(0, 5).forEach((match: any, idx) => {
        try {
          let ts = match.timestamp
          if (typeof ts === "string" && ts.includes(" ")) {
            ts = ts.replace(" ", "T").replace("+00", "Z")
          }
          const date = new Date(ts)
          const day = getDayId(date)
          console.log(`   ${idx + 1}. Match ${match.id}: timestamp="${match.timestamp}", day=${day}, dayFromDB=${match.day}`)
        } catch (err) {
          console.log(`   ${idx + 1}. Match ${match.id}: timestamp="${match.timestamp}" (erro ao processar)`)
        }
      })
      return
    }

    // Agrupar por dia
    const matchesByDay = new Map<number, any[]>()
    relevantMatches.forEach((m) => {
      const day = m.dayFromTimestamp
      if (!matchesByDay.has(day)) {
        matchesByDay.set(day, [])
      }
      matchesByDay.get(day)!.push(m)
    })

    // Mostrar resultados
    for (const [day, dayMatches] of matchesByDay.entries()) {
      console.log(`\n${"=".repeat(60)}`)
      console.log(`📅 Dia ${day} (${day === day05 ? "05/01/2026" : day === day06 ? "06/01/2026" : "outro"})`)
      console.log(`${"=".repeat(60)}`)
      console.log(`   Total de matches: ${dayMatches.length}`)
      
      dayMatches.slice(0, 5).forEach((m, idx) => {
        console.log(`\n   Match ${idx + 1}:`)
        console.log(`     ID: ${m.id}`)
        console.log(`     Player: ${m.player}`)
        console.log(`     Points: ${m.points}`)
        console.log(`     Timestamp (string): ${m.timestamp}`)
        console.log(`     Timestamp (ms): ${m.timestampMs}`)
        console.log(`     Day calculado do timestamp: ${m.dayFromTimestamp}`)
        console.log(`     Day do banco: ${m.dayFromDB || "NULL"}`)
        console.log(`     No range do dia 20458: ${m.inRange05 ? "✅" : "❌"}`)
        console.log(`     No range do dia 20459: ${m.inRange06 ? "✅" : "❌"}`)
      })
    }

    // Verificar matches que estão no range mas não no day correto
    console.log(`\n${"=".repeat(60)}`)
    console.log("🔍 Análise de correspondência:")
    console.log(`${"=".repeat(60)}\n`)

    const matchesInRange05 = relevantMatches.filter((m) => m.inRange05)
    const matchesInRange06 = relevantMatches.filter((m) => m.inRange06)
    const matchesWithDay05 = relevantMatches.filter((m) => m.dayFromTimestamp === day05)
    const matchesWithDay06 = relevantMatches.filter((m) => m.dayFromTimestamp === day06)

    console.log(`   Matches no range do dia 20458: ${matchesInRange05.length}`)
    console.log(`   Matches calculados como dia 20458: ${matchesWithDay05.length}`)
    console.log(`   Matches no range do dia 20459: ${matchesInRange06.length}`)
    console.log(`   Matches calculados como dia 20459: ${matchesWithDay06.length}`)

    if (matchesInRange05.length > 0 && matchesWithDay05.length === 0) {
      console.log(`\n   ⚠️ PROBLEMA DETECTADO: Há ${matchesInRange05.length} matches no range do dia 20458, mas nenhum foi calculado como dia 20458!`)
      console.log(`   💡 Isso indica um problema na conversão de timestamp ou no cálculo de day.`)
    }

    if (matchesInRange06.length > 0 && matchesWithDay06.length === 0) {
      console.log(`\n   ⚠️ PROBLEMA DETECTADO: Há ${matchesInRange06.length} matches no range do dia 20459, mas nenhum foi calculado como dia 20459!`)
      console.log(`   💡 Isso indica um problema na conversão de timestamp ou no cálculo de day.`)
    }

  } catch (error: any) {
    console.error("❌ Erro fatal:", error.message)
    if (error.message.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      console.error("💡 Adicione SUPABASE_SERVICE_ROLE_KEY no .env.local")
    }
  }
}

main().catch(console.error)

