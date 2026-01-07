/**
 * Script para verificar se há matches no Supabase para os dias 05 e 06 de janeiro
 */

import * as dotenv from "dotenv"
import { getDayId } from "@/utils/day"
import { supabaseAdmin } from "@/lib/supabase"

dotenv.config({ path: ".env.local" })

async function main() {
  console.log("🔍 Verificando matches no Supabase para 05 e 06 de janeiro\n")

  const date05 = new Date("2026-01-05T00:00:00Z")
  const date06 = new Date("2026-01-06T00:00:00Z")

  const day05 = getDayId(date05)
  const day06 = getDayId(date06)

  console.log(`📅 Dia 05/01/2026: day ID = ${day05}`)
  console.log(`📅 Dia 06/01/2026: day ID = ${day06}\n`)

  const daysToCheck = [
    { day: day05, date: "05/01/2026" },
    { day: day06, date: "06/01/2026" },
  ]

  for (const { day, date } of daysToCheck) {
    console.log(`\n${"=".repeat(60)}`)
    console.log(`📊 Verificando matches para dia ${day} (${date})...`)
    console.log(`${"=".repeat(60)}\n`)

    try {
      // Buscar matches do dia
      const { data: matches, error } = await supabaseAdmin
        .from("matches")
        .select("player, points, golden_moles, errors, timestamp, day")
        .eq("day", day)

      if (error) {
        console.error(`   ❌ Erro ao buscar matches:`, error.message)
        continue
      }

      if (!matches || matches.length === 0) {
        console.log(`   ⚠️ Nenhum match encontrado para o dia ${day}`)
        console.log(`   💡 Não é possível registrar winners sem matches`)
        continue
      }

      console.log(`   ✅ Encontrados ${matches.length} match(es) para o dia ${day}`)

      // Agrupar por jogador
      const playersMap = new Map<string, { points: number; golden_moles: number; errors: number }>()

      matches.forEach((match: any) => {
        const player = match.player?.toLowerCase()
        if (!player) return

        const existing = playersMap.get(player)
        if (existing) {
          existing.points += match.points || 0
          existing.golden_moles += match.golden_moles || 0
          existing.errors += match.errors || 0
        } else {
          playersMap.set(player, {
            points: match.points || 0,
            golden_moles: match.golden_moles || 0,
            errors: match.errors || 0,
          })
        }
      })

      // Ordenar por pontos
      const sorted = Array.from(playersMap.entries())
        .map(([player, stats]) => ({ player, ...stats }))
        .sort((a, b) => {
          if (b.points !== a.points) return b.points - a.points
          if (b.golden_moles !== a.golden_moles) return b.golden_moles - a.golden_moles
          return a.errors - b.errors
        })

      console.log(`\n   📊 Ranking do dia ${day}:`)
      console.log(`   Total de jogadores únicos: ${sorted.length}`)
      sorted.slice(0, 3).forEach((entry, index) => {
        console.log(
          `   ${index + 1}º lugar: ${entry.player} (${entry.points} pts, ${entry.golden_moles} golden, ${entry.errors} errors)`
        )
      })

      if (sorted.length > 0) {
        console.log(`\n   ✅ Há jogadores! Pode registrar winners para este dia`)
      }
    } catch (error: any) {
      console.error(`   ❌ Erro ao verificar dia ${day}:`, error.message)
      if (error.message.includes("SUPABASE_SERVICE_ROLE_KEY")) {
        console.error(`   💡 Adicione SUPABASE_SERVICE_ROLE_KEY no .env.local`)
      }
    }
  }

  console.log(`\n${"=".repeat(60)}`)
  console.log("✅ Verificação concluída!")
  console.log(`${"=".repeat(60)}\n`)
}

main().catch(console.error)

