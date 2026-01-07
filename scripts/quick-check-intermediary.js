import { ethers } from "ethers"

const RPC_URL = "https://rpc.testnet.arc.network"
const INTERMEDIARY_CONTRACT = "0x41Afb27763416f555207c9B0bB04F08E665b4AFd"
const CURRENT_CONTRACT = "0x531Ba20fB57fb9Efe6b8f5c7Cbf29248A7B3D5cF"

const GAME_CREDITS_ABI = [
  "function credits(address) external view returns (uint256)",
  "event CreditsPurchased(address indexed player, uint256 amount, uint256 creditsReceived, uint256 totalCost)",
]

async function main() {
  console.log("🔍 Checking for credits in intermediary contract...")
  console.log("=".repeat(60))
  console.log("Intermediary:", INTERMEDIARY_CONTRACT)
  console.log("")
  
  const provider = new ethers.JsonRpcProvider(RPC_URL)
  const contract = new ethers.Contract(INTERMEDIARY_CONTRACT, GAME_CREDITS_ABI, provider)
  
  // Get current block
  const currentBlock = await provider.getBlockNumber()
  const fromBlock = Math.max(0, currentBlock - 100000)
  
  console.log(`Querying CreditsPurchased events from block ${fromBlock} to ${currentBlock}...`)
  
  const players = new Set()
  
  // Query in chunks
  const chunkSize = 5000
  for (let start = fromBlock; start <= currentBlock; start += chunkSize) {
    const end = Math.min(start + chunkSize - 1, currentBlock)
    try {
      const filter = contract.filters.CreditsPurchased()
      const events = await contract.queryFilter(filter, start, end)
      
      events.forEach(event => {
        players.add(event.args.player.toLowerCase())
      })
      
      if (end - start > 0) {
        process.stdout.write(`   Processed blocks ${start}-${end} (${players.size} players)...\r`)
      }
    } catch (error) {
      // Ignore errors, continue
    }
  }
  
  console.log(`\n   Found ${players.size} unique players with purchase events`)
  console.log("")
  
  // Check balances
  console.log("Checking balances...")
  const playersWithCredits = []
  let checked = 0
  
  for (const playerAddress of players) {
    try {
      const balance = await contract.credits(playerAddress)
      const balanceNum = Number(balance)
      if (balanceNum > 0) {
        playersWithCredits.push({
          address: playerAddress,
          balance: balanceNum
        })
      }
      checked++
      if (checked % 10 === 0) {
        process.stdout.write(`   Checked ${checked}/${players.size} players (${playersWithCredits.length} with credits)...\r`)
      }
    } catch (error) {
      // Ignore errors
    }
  }
  
  console.log(`\n   Found ${playersWithCredits.length} players with credits > 0`)
  console.log("")
  
  if (playersWithCredits.length > 0) {
    console.log("=".repeat(60))
    console.log("PLAYERS WITH CREDITS IN INTERMEDIARY:")
    console.log("=".repeat(60))
    let total = 0
    playersWithCredits.sort((a, b) => b.balance - a.balance).forEach((p, i) => {
      console.log(`${i + 1}. ${p.address}: ${p.balance} credits`)
      total += p.balance
    })
    console.log("=".repeat(60))
    console.log(`Total: ${total} credits across ${playersWithCredits.length} players`)
    console.log("=".repeat(60))
    console.log("")
    console.log("✅ Credits found in intermediary contract!")
    console.log("   → Ready to migrate to current contract")
    return true
  } else {
    console.log("ℹ️ No credits found in intermediary contract")
    return false
  }
}

main()
  .then(hasCredits => {
    if (hasCredits) {
      console.log("")
      console.log("🚀 Ready to run migration script:")
      console.log("   node scripts/migrate-from-intermediary.js")
      process.exit(0)
    } else {
      process.exit(1)
    }
  })
  .catch(error => {
    console.error("Error:", error.message)
    process.exit(1)
  })


