/**
 * Script para testar registro de winners dos dias 05 e 06 de janeiro
 */

import * as dotenv from "dotenv"
import { registerDailyWinners } from "@/lib/register-daily-winners"
import { getDayId } from "@/utils/day"

// Carregar variáveis de ambiente do .env.local
dotenv.config({ path: ".env.local" })

async function main() {
  console.log("🧪 Testando registro de winners para 05 e 06 de janeiro\n")

  // Calcular day IDs
  const date05 = new Date("2026-01-05T00:00:00Z")
  const date06 = new Date("2026-01-06T00:00:00Z")
  
  const day05 = getDayId(date05)
  const day06 = getDayId(date06)

  console.log(`📅 Dia 05/01/2026: day ID = ${day05}`)
  console.log(`📅 Dia 06/01/2026: day ID = ${day06}\n`)

  const daysToTest = [
    { day: day05, date: "05/01/2026" },
    { day: day06, date: "06/01/2026" },
  ]

  const results: Array<{
    day: number
    date: string
    success: boolean
    message: string
    error?: string
  }> = []

  for (const { day, date } of daysToTest) {
    console.log(`\n${"=".repeat(60)}`)
    console.log(`🚀 Testando dia ${day} (${date})...`)
    console.log(`${"=".repeat(60)}\n`)

    try {
      const result = await registerDailyWinners(day)

      if (result.success) {
        if (result.alreadyRegistered) {
          console.log(`✅ Dia ${day} (${date}) já estava registrado`)
          console.log(`   Total players: ${result.totalPlayers}`)
          results.push({
            day,
            date,
            success: true,
            message: `Already registered (${result.totalPlayers} players)`,
          })
        } else {
          console.log(`✅ Dia ${day} (${date}) registrado com sucesso!`)
          console.log(`   Winners: ${result.winners?.join(", ")}`)
          console.log(`   Total players: ${result.totalPlayers}`)
          results.push({
            day,
            date,
            success: true,
            message: `Registered successfully (${result.totalPlayers} players)`,
            error: undefined,
          })
        }
      } else {
        console.error(`❌ Falha ao registrar dia ${day} (${date})`)
        console.error(`   Erro: ${result.error}`)
        results.push({
          day,
          date,
          success: false,
          message: "Failed",
          error: result.error,
        })
      }
    } catch (error: any) {
      console.error(`❌ Erro ao processar dia ${day} (${date}):`, error.message)
      results.push({
        day,
        date,
        success: false,
        message: "Exception",
        error: error.message,
      })
    }

    // Delay entre dias
    if (daysToTest.indexOf({ day, date }) < daysToTest.length - 1) {
      console.log("\n⏳ Aguardando 2 segundos antes do próximo dia...")
      await new Promise((resolve) => setTimeout(resolve, 2000))
    }
  }

  // Resumo final
  console.log(`\n${"=".repeat(60)}`)
  console.log("📊 RESUMO FINAL")
  console.log(`${"=".repeat(60)}\n`)

  const successful = results.filter((r) => r.success).length
  const failed = results.filter((r) => !r.success).length

  results.forEach((result) => {
    const status = result.success ? "✅" : "❌"
    console.log(`${status} Dia ${result.day} (${result.date}): ${result.message}`)
    if (result.error && !result.error.includes("No players found")) {
      console.log(`   Erro: ${result.error}`)
    }
  })

  console.log(`\n📈 Total: ${successful} sucesso(s), ${failed} falha(s)`)

  if (failed > 0) {
    console.log("\n⚠️ Alguns dias falharam. Verifique os erros acima.")
    process.exit(1)
  } else {
    console.log("\n✅ Todos os dias foram processados com sucesso!")
    process.exit(0)
  }
}

main().catch((error) => {
  console.error("❌ Erro fatal:", error)
  process.exit(1)
})

