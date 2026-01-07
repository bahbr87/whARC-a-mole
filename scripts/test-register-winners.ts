/**
 * Script para testar o endpoint de registro de winners
 * Pode ser usado para diagnosticar problemas ou registrar dias manualmente
 */

import * as dotenv from "dotenv"
import { registerDailyWinners } from "@/lib/register-daily-winners"
import { getDayId } from "@/utils/day"

// Carregar variáveis de ambiente do .env.local
dotenv.config({ path: ".env.local" })

async function main() {
  const args = process.argv.slice(2)
  const dayParam = args.find((arg) => arg.startsWith("--day="))?.split("=")[1]
  const testLocal = args.includes("--local")
  const testVercel = args.includes("--vercel")
  const vercelUrl = args.find((arg) => arg.startsWith("--url="))?.split("=")[1]

  console.log("🧪 Testando registro de winners...\n")

  // Verificar variáveis de ambiente locais
  console.log("📋 Verificando variáveis de ambiente locais:")
  const hasOwnerKey = !!process.env.PRIZE_POOL_OWNER_PRIVATE_KEY
  const hasContractAddress = !!(
    process.env.NEXT_PUBLIC_PRIZE_POOL_CONTRACT_ADDRESS ||
    process.env.PRIZE_POOL_CONTRACT_ADDRESS
  )

  console.log(
    `   PRIZE_POOL_OWNER_PRIVATE_KEY: ${hasOwnerKey ? "✅ Configurado" : "❌ Não configurado"}`
  )
  console.log(
    `   PRIZE_POOL_CONTRACT_ADDRESS: ${hasContractAddress ? "✅ Configurado" : "❌ Não configurado"}`
  )

  // Se day foi fornecido, registrar localmente
  if (dayParam) {
    const day = parseInt(dayParam)
    if (isNaN(day)) {
      console.error("❌ Dia inválido. Use --day=20458")
      process.exit(1)
    }

    console.log(`\n🚀 Registrando winners para o dia ${day}...`)

    if (!hasOwnerKey || !hasContractAddress) {
      console.error(
        "\n❌ Variáveis de ambiente não configuradas localmente!"
      )
      console.error("   Configure no .env.local ou use --vercel para testar no Vercel")
      process.exit(1)
    }

    try {
      const result = await registerDailyWinners(day)

      if (result.success) {
        if (result.alreadyRegistered) {
          console.log(`\n✅ Dia ${day} já estava registrado`)
          console.log(`   Total players: ${result.totalPlayers}`)
        } else {
          console.log(`\n✅ Dia ${day} registrado com sucesso!`)
          console.log(`   Winners: ${result.winners?.join(", ")}`)
          console.log(`   Total players: ${result.totalPlayers}`)
        }
      } else {
        console.error(`\n❌ Falha ao registrar dia ${day}:`)
        console.error(`   Erro: ${result.error}`)
        process.exit(1)
      }
    } catch (error: any) {
      console.error(`\n❌ Erro ao registrar:`, error.message)
      process.exit(1)
    }

    return
  }

  // Testar endpoint do Vercel
  if (testVercel && vercelUrl) {
    console.log(`\n🌐 Testando endpoint do Vercel: ${vercelUrl}`)

    try {
      const response = await fetch(vercelUrl)
      const data = await response.json()

      console.log(`\n📊 Resposta do Vercel:`)
      console.log(`   Status: ${response.status}`)
      console.log(`   Success: ${data.success}`)
      console.log(`   Message: ${data.message || data.error}`)

      if (data.results) {
        console.log(`\n📋 Resultados:`)
        data.results.forEach((r: any) => {
          console.log(
            `   Dia ${r.day}: ${r.success ? "✅" : "❌"} ${r.message}`
          )
        })
      }

      if (!response.ok || !data.success) {
        console.error("\n❌ Endpoint retornou erro!")
        process.exit(1)
      }
    } catch (error: any) {
      console.error(`\n❌ Erro ao testar endpoint:`, error.message)
      process.exit(1)
    }

    return
  }

  // Testar localmente (sem parâmetros)
  if (testLocal || (!testVercel && !dayParam)) {
    console.log("\n🔍 Testando registro local...")

    if (!hasOwnerKey || !hasContractAddress) {
      console.error(
        "\n❌ Variáveis de ambiente não configuradas localmente!"
      )
      console.error("\n💡 Opções:")
      console.error("   1. Configure no .env.local")
      console.error("   2. Use --vercel --url=https://seu-dominio.vercel.app/api/cron/register-winners")
      console.error("   3. Use --day=20458 para registrar um dia específico (requer .env.local)")
      process.exit(1)
    }

    // Testar com o dia de ontem
    const yesterday = new Date()
    yesterday.setUTCDate(yesterday.getUTCDate() - 1)
    const yesterdayDay = getDayId(yesterday)

    console.log(`\n📅 Testando registro do dia ${yesterdayDay} (${yesterday.toISOString().split("T")[0]})...`)

    try {
      const result = await registerDailyWinners(yesterdayDay)

      if (result.success) {
        if (result.alreadyRegistered) {
          console.log(`\n✅ Dia ${yesterdayDay} já estava registrado`)
          console.log(`   Total players: ${result.totalPlayers}`)
        } else {
          console.log(`\n✅ Dia ${yesterdayDay} registrado com sucesso!`)
          console.log(`   Winners: ${result.winners?.join(", ")}`)
          console.log(`   Total players: ${result.totalPlayers}`)
        }
      } else {
        console.error(`\n❌ Falha ao registrar dia ${yesterdayDay}:`)
        console.error(`   Erro: ${result.error}`)

        if (result.error?.includes("not configured")) {
          console.error("\n💡 Configure as variáveis de ambiente no Vercel:")
          console.error("   - PRIZE_POOL_OWNER_PRIVATE_KEY")
          console.error("   - NEXT_PUBLIC_PRIZE_POOL_CONTRACT_ADDRESS")
        }
      }
    } catch (error: any) {
      console.error(`\n❌ Erro ao testar:`, error.message)
      process.exit(1)
    }
  }

  // Mostrar ajuda se nenhum comando foi executado
  if (!dayParam && !testVercel && !testLocal) {
    console.log("\n📖 Uso:")
    console.log("   npx tsx scripts/test-register-winners.ts --day=20458")
    console.log("   npx tsx scripts/test-register-winners.ts --local")
    console.log("   npx tsx scripts/test-register-winners.ts --vercel --url=https://seu-dominio.vercel.app/api/cron/register-winners")
    console.log("\n💡 Exemplos:")
    console.log("   # Registrar dia específico localmente")
    console.log("   npx tsx scripts/test-register-winners.ts --day=20458")
    console.log("   # Testar endpoint do Vercel")
    console.log("   npx tsx scripts/test-register-winners.ts --vercel --url=https://seu-app.vercel.app/api/cron/register-winners")
  }
}

main().catch(console.error)

