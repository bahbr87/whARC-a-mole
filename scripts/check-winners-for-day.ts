import { JsonRpcProvider, Contract } from "ethers"
import dotenv from "dotenv"
import path from "path"

dotenv.config({ path: path.join(process.cwd(), ".env.local") })

const RPC_URL = process.env.RPC_URL || "https://rpc.testnet.arc.network"
const CHAIN_ID = parseInt(process.env.CHAIN_ID || "5042002")
const PRIZE_POOL_ADDRESS = process.env.NEXT_PUBLIC_PRIZE_POOL_CONTRACT_ADDRESS || "0xeA0df70040E77a821b14770E53aa577A745930ae"

// PrizePool ABI - try both getWinner and dailyWinners
const PRIZE_POOL_ABI = [
  "function getWinner(uint256 day, uint8 rank) view returns (address)",
  "function dailyWinners(uint256 day, uint8 rank) view returns (address)",
  "function claimed(uint256 day, uint8 rank) view returns (bool)",
  "function isWinnersRegistered(uint256 day) view returns (bool)",
]

function getDaysSinceEpochUTC(date: Date): number {
  const utc = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    0, 0, 0, 0
  )
  return Math.floor(utc / (1000 * 60 * 60 * 24))
}

async function checkWinnersForDay(dateString: string) {
  console.log("=".repeat(70))
  console.log("🔍 VERIFICANDO VENCEDORES PARA O DIA")
  console.log("=".repeat(70))
  console.log("")

  const date = new Date(dateString + "T00:00:00Z") // UTC midnight
  const day = getDaysSinceEpochUTC(date)

  console.log(`📅 Data: ${dateString}`)
  console.log(`🧮 Days since epoch: ${day}`)
  console.log(`📋 Contrato: ${PRIZE_POOL_ADDRESS}`)
  console.log("")

  try {
    const provider = new JsonRpcProvider(RPC_URL, CHAIN_ID)
    const contract = new Contract(PRIZE_POOL_ADDRESS, PRIZE_POOL_ABI, provider)

    // Check if winners are registered
    let isRegistered = false
    try {
      isRegistered = await contract.isWinnersRegistered(day)
      console.log(`✅ isWinnersRegistered(${day}): ${isRegistered}`)
    } catch (error: any) {
      console.log(`⚠️  isWinnersRegistered não disponível: ${error.message}`)
    }

    console.log("")

    // Check each rank
    const winners: { rank: number; winner: string; claimed: boolean }[] = []

    for (let rank = 1; rank <= 3; rank++) {
      try {
        // Try getWinner first
        let winner: string
        try {
          winner = await contract.getWinner(day, rank)
          console.log(`✅ getWinner(${day}, ${rank}): ${winner}`)
        } catch (error: any) {
          // Fallback to dailyWinners
          console.log(`⚠️  getWinner falhou, tentando dailyWinners: ${error.message}`)
          winner = await contract.dailyWinners(day, rank)
          console.log(`✅ dailyWinners(${day}, ${rank}): ${winner}`)
        }

        // Check if claimed
        let claimed = false
        try {
          claimed = await contract.claimed(day, rank)
        } catch (error: any) {
          console.log(`⚠️  claimed não disponível para rank ${rank}: ${error.message}`)
        }

        winners.push({
          rank,
          winner: winner.toLowerCase(),
          claimed,
        })

        if (winner !== "0x0000000000000000000000000000000000000000") {
          console.log(`   Status: ${claimed ? "✅ JÁ REIVINDICADO" : "⏳ DISPONÍVEL PARA CLAIM"}`)
        } else {
          console.log(`   Status: ❌ Nenhum vencedor registrado`)
        }
      } catch (error: any) {
        console.error(`❌ Erro ao verificar rank ${rank}:`, error.message)
        winners.push({
          rank,
          winner: "0x0000000000000000000000000000000000000000",
          claimed: false,
        })
      }
      console.log("")
    }

    console.log("=".repeat(70))
    console.log("📊 RESUMO")
    console.log("=".repeat(70))
    console.log("")

    const registeredWinners = winners.filter(w => w.winner !== "0x0000000000000000000000000000000000000000")
    
    if (registeredWinners.length === 0) {
      console.log("❌ NENHUM VENCEDOR REGISTRADO PARA ESTE DIA")
      console.log("")
      console.log("💡 SOLUÇÃO:")
      console.log("   1. Verifique se os vencedores foram registrados via API ou script")
      console.log("   2. Execute o script de registro de vencedores para este dia")
      console.log("   3. Verifique se a data está correta (deve ser UTC)")
    } else {
      console.log(`✅ ${registeredWinners.length} vencedor(es) registrado(s):`)
      registeredWinners.forEach(w => {
        console.log(`   Rank ${w.rank}: ${w.winner} ${w.claimed ? "(JÁ REIVINDICADO)" : "(DISPONÍVEL)"}`)
      })
    }

    console.log("")
    console.log("=".repeat(70))

  } catch (error: any) {
    console.error("❌ ERRO:", error.message)
    console.error("")
    console.error("💡 Verifique:")
    console.error("   1. RPC_URL está configurado corretamente")
    console.error("   2. PRIZE_POOL_ADDRESS está correto")
    console.error("   3. Você está conectado à rede Arc Testnet")
  }
}

// Get date from command line argument
const dateArg = process.argv[2]

if (!dateArg) {
  console.error("❌ Uso: npx tsx scripts/check-winners-for-day.ts <data>")
  console.error("   Exemplo: npx tsx scripts/check-winners-for-day.ts 2025-12-21")
  process.exit(1)
}

checkWinnersForDay(dateArg).catch(console.error)



