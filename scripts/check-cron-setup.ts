/**
 * Script para verificar se o cron de registro de winners está configurado corretamente
 */

import { registerDailyWinners } from "@/lib/register-daily-winners"
import { getDayId } from "@/utils/day"

async function main() {
  console.log("🔍 Verificando configuração do cron de registro de winners...\n")

  // 1. Verificar variáveis de ambiente
  console.log("1️⃣ Verificando variáveis de ambiente:")
  const RPC_URL = process.env.RPC_URL || "https://rpc.testnet.arc.network"
  const PRIZE_POOL_ADDRESS =
    process.env.NEXT_PUBLIC_PRIZE_POOL_CONTRACT_ADDRESS ||
    process.env.PRIZE_POOL_CONTRACT_ADDRESS
  const OWNER_PRIVATE_KEY = process.env.PRIZE_POOL_OWNER_PRIVATE_KEY
  const CRON_SECRET_TOKEN = process.env.CRON_SECRET_TOKEN

  console.log(`   RPC_URL: ${RPC_URL ? "✅ Configurado" : "❌ Não configurado"}`)
  console.log(
    `   PRIZE_POOL_ADDRESS: ${PRIZE_POOL_ADDRESS ? `✅ ${PRIZE_POOL_ADDRESS}` : "❌ Não configurado"}`
  )
  console.log(
    `   PRIZE_POOL_OWNER_PRIVATE_KEY: ${OWNER_PRIVATE_KEY ? "✅ Configurado" : "❌ NÃO CONFIGURADO (CRÍTICO)"}`
  )
  console.log(
    `   CRON_SECRET_TOKEN: ${CRON_SECRET_TOKEN ? "✅ Configurado" : "⚠️ Não configurado (opcional)"}`
  )

  if (!OWNER_PRIVATE_KEY) {
    console.error("\n❌ ERRO CRÍTICO: PRIZE_POOL_OWNER_PRIVATE_KEY não configurado!")
    console.error("   Configure esta variável no Vercel ou .env.local")
    process.exit(1)
  }

  if (!PRIZE_POOL_ADDRESS) {
    console.error("\n❌ ERRO CRÍTICO: PRIZE_POOL_CONTRACT_ADDRESS não configurado!")
    process.exit(1)
  }

  // 2. Testar registro de um dia passado
  console.log("\n2️⃣ Testando registro de winners...")
  const yesterday = new Date()
  yesterday.setUTCDate(yesterday.getUTCDate() - 1)
  const yesterdayDay = getDayId(yesterday)

  console.log(`   Testando dia: ${yesterdayDay} (${yesterday.toISOString().split("T")[0]})`)

  try {
    const result = await registerDailyWinners(yesterdayDay)

    if (result.success) {
      if (result.alreadyRegistered) {
        console.log(`   ✅ Dia ${yesterdayDay} já está registrado (totalPlayers: ${result.totalPlayers})`)
      } else {
        console.log(`   ✅ Dia ${yesterdayDay} registrado com sucesso!`)
        console.log(`   Winners: ${result.winners?.join(", ")}`)
        console.log(`   Total players: ${result.totalPlayers}`)
      }
    } else {
      console.error(`   ❌ Falha ao registrar dia ${yesterdayDay}: ${result.error}`)
    }
  } catch (error: any) {
    console.error(`   ❌ Erro ao testar registro:`, error.message)
  }

  // 3. Verificar dias pendentes
  console.log("\n3️⃣ Verificando dias pendentes...")
  console.log("   (Execute o endpoint /api/cron/register-winners para ver todos os dias pendentes)")

  console.log("\n✅ Verificação concluída!")
  console.log("\n📋 Próximos passos:")
  console.log("   1. Se PRIZE_POOL_OWNER_PRIVATE_KEY não estava configurado, configure no Vercel")
  console.log("   2. Verifique os logs do Vercel para ver se o cron está executando")
  console.log("   3. Teste manualmente: GET /api/cron/register-winners")
  console.log("   4. Para registrar um dia específico: GET /api/cron/register-winners?day=20458")
}

main().catch(console.error)

