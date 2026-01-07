/**
 * Script para verificar status dos dias 05 e 06 de janeiro no contrato
 * (sem depender do Supabase)
 */

import * as dotenv from "dotenv"
import { getDayId } from "@/utils/day"
import { JsonRpcProvider, Contract } from "ethers"

dotenv.config({ path: ".env.local" })

async function main() {
  console.log("🔍 Verificando status dos dias 05 e 06 de janeiro no contrato\n")

  const RPC_URL = process.env.RPC_URL || "https://rpc.testnet.arc.network"
  const PRIZE_POOL_ADDRESS =
    process.env.NEXT_PUBLIC_PRIZE_POOL_CONTRACT_ADDRESS ||
    process.env.PRIZE_POOL_CONTRACT_ADDRESS

  if (!PRIZE_POOL_ADDRESS) {
    console.error("❌ PRIZE_POOL_CONTRACT_ADDRESS não configurado")
    process.exit(1)
  }

  // Calcular day IDs
  const date05 = new Date("2026-01-05T00:00:00Z")
  const date06 = new Date("2026-01-06T00:00:00Z")

  const day05 = getDayId(date05)
  const day06 = getDayId(date06)

  console.log(`📅 Dia 05/01/2026: day ID = ${day05}`)
  console.log(`📅 Dia 06/01/2026: day ID = ${day06}\n`)

  const provider = new JsonRpcProvider(RPC_URL)
  const PRIZE_POOL_ABI = [
    "function totalPlayers(uint256 day) view returns (uint256)",
    "function getWinner(uint256 day, uint256 rank) view returns (address)",
  ]
  const contract = new Contract(PRIZE_POOL_ADDRESS, PRIZE_POOL_ABI, provider)

  const daysToCheck = [
    { day: day05, date: "05/01/2026" },
    { day: day06, date: "06/01/2026" },
  ]

  for (const { day, date } of daysToCheck) {
    console.log(`\n${"=".repeat(60)}`)
    console.log(`📊 Verificando dia ${day} (${date})...`)
    console.log(`${"=".repeat(60)}\n`)

    try {
      const totalPlayers = await contract.totalPlayers(day)
      const winner1 = await contract.getWinner(day, 1)
      const winner2 = await contract.getWinner(day, 2)
      const winner3 = await contract.getWinner(day, 3)

      console.log(`   Total Players: ${totalPlayers.toString()}`)
      console.log(`   1º lugar: ${winner1}`)
      if (winner2 !== "0x0000000000000000000000000000000000000000") {
        console.log(`   2º lugar: ${winner2}`)
      }
      if (winner3 !== "0x0000000000000000000000000000000000000000") {
        console.log(`   3º lugar: ${winner3}`)
      }

      if (totalPlayers > BigInt(0)) {
        console.log(`\n   ✅ Dia ${day} está FINALIZADO (totalPlayers > 0)`)
      } else {
        console.log(`\n   ⚠️ Dia ${day} NÃO está finalizado (totalPlayers = 0)`)
        console.log(`   💡 Execute o registro de winners para este dia`)
      }
    } catch (error: any) {
      console.error(`   ❌ Erro ao verificar dia ${day}:`, error.message)
    }
  }

  console.log(`\n${"=".repeat(60)}`)
  console.log("✅ Verificação concluída!")
  console.log(`${"=".repeat(60)}\n`)
}

main().catch(console.error)

