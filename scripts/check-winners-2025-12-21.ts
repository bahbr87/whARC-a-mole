import { JsonRpcProvider, Contract } from "ethers"
import dotenv from "dotenv"
import path from "path"
import { getDayId } from "../utils/day"

dotenv.config({ path: path.join(process.cwd(), ".env.local") })

const RPC_URL = process.env.RPC_URL || "https://rpc.testnet.arc.network"
const PRIZE_POOL_ADDRESS = process.env.NEXT_PUBLIC_PRIZE_POOL_CONTRACT_ADDRESS || "0x61964Cc8Cea0bfC601edC75B1d4Cbb7900a19962"

const PRIZE_POOL_ABI = [
  "function getWinner(uint256 day, uint256 rank) view returns (address)",
  "function totalPlayers(uint256 day) view returns (uint256)",
  "function canClaim(uint256 day, address user) view returns (bool)",
]

async function checkWinners() {
  console.log("=".repeat(70))
  console.log("🔍 VERIFICANDO VENCEDORES DO DIA 21/12/2025")
  console.log("=".repeat(70))
  console.log("")

  try {
    const provider = new JsonRpcProvider(RPC_URL)
    const contract = new Contract(PRIZE_POOL_ADDRESS, PRIZE_POOL_ABI, provider)
    
    const date = new Date("2025-12-21")
    const day = getDayId(date)
    
    console.log(`📅 Data: ${date.toISOString().split('T')[0]}`)
    console.log(`📅 Day ID: ${day}`)
    console.log("")

    const totalPlayers = await contract.totalPlayers(day)
    console.log(`👥 Total Players: ${totalPlayers.toString()}`)
    console.log("")

    if (totalPlayers === BigInt(0)) {
      console.log("❌ Nenhum vencedor registrado para este dia!")
      console.log("   É necessário registrar os vencedores via API antes de poderem fazer claim.")
      return
    }

    console.log("🏆 Vencedores registrados:")
    for (let rank = 1; rank <= 3; rank++) {
      const winner = await contract.getWinner(day, rank)
      if (winner !== "0x0000000000000000000000000000000000000000") {
        console.log(`   Rank ${rank}: ${winner}`)
        
        // Check canClaim
        const canClaim = await contract.canClaim(day, winner)
        console.log(`      canClaim: ${canClaim}`)
      } else {
        console.log(`   Rank ${rank}: Não registrado`)
      }
    }

  } catch (error: any) {
    console.error("❌ Erro:", error.message)
  } finally {
    console.log("")
    console.log("=".repeat(70))
  }
}

checkWinners().catch(console.error)



