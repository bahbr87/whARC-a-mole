/**
 * Script para verificar winners registrados para o dia 20443
 */

import { ethers } from "ethers"
import * as dotenv from "dotenv"
import path from "path"

dotenv.config({ path: path.join(process.cwd(), ".env.local") })

const RPC_URL = process.env.RPC_URL || "https://rpc.testnet.arc.network"
const PRIZE_POOL_ADDRESS =
  process.env.NEXT_PUBLIC_PRIZE_POOL_CONTRACT_ADDRESS ||
  process.env.PRIZE_POOL_CONTRACT_ADDRESS ||
  "0xeA0df70040E77a821b14770E53aa577A745930ae"

const PRIZE_POOL_ABI = [
  "function getWinner(uint256 day, uint256 rank) view returns (address)",
  "function totalPlayers(uint256 day) view returns (uint256)",
  "function canClaim(uint256 day, address user) view returns (bool)",
  "function claimed(uint256 day, address user) view returns (bool)",
]

async function main() {
  const day = 20443
  console.log(`🔍 Checking day ${day}...\n`)

  const provider = new ethers.JsonRpcProvider(RPC_URL)
  const contract = new ethers.Contract(PRIZE_POOL_ADDRESS, PRIZE_POOL_ABI, provider)

  // Check totalPlayers
  const totalPlayers = await contract.totalPlayers(day)
  console.log(`📊 totalPlayers(${day}): ${totalPlayers.toString()}`)

  // Check winners for ranks 1, 2, 3
  console.log(`\n🏆 Winners:`)
  for (let rank = 1; rank <= 3; rank++) {
    try {
      const winner = await contract.getWinner(day, rank)
      const isZero = winner === ethers.ZeroAddress
      console.log(`   Rank ${rank}: ${winner} ${isZero ? "(zero address - not set)" : "✅"}`)
      
      if (!isZero) {
        // Check if claimed
        const claimed = await contract.claimed(day, winner)
        const canClaim = await contract.canClaim(day, winner)
        console.log(`      - claimed: ${claimed}`)
        console.log(`      - canClaim: ${canClaim}`)
      }
    } catch (error: any) {
      console.log(`   Rank ${rank}: ERROR - ${error.message}`)
    }
  }

  // ⚠️ Note: getWinner(day, 0) is NOT valid
  // Ranks are 1, 2, 3 (not 0)
  console.log(`\n⚠️  Note: getWinner(${day}, 0) is NOT valid.`)
  console.log(`   Valid ranks are: 1, 2, 3`)
  console.log(`   Winners are stored in winners[day][1], winners[day][2], winners[day][3]`)
  console.log(`   winners[day][0] is never used and will always return address(0)`)
}

main().catch((error) => {
  console.error("❌ Error:", error)
  process.exit(1)
})


