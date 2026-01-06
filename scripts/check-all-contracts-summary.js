import { ethers } from "ethers"

const RPC_URL = "https://rpc.testnet.arc.network"

const CONTRACTS = {
  "OLD": "0xB6EF59882778d0A245202F1482f20f02ad82bd87",
  "INTERMEDIARY": "0x41Afb27763416f555207c9B0bB04F08E665b4AFd",
  "CURRENT": "0x531Ba20fB57fb9Efe6b8f5c7Cbf29248A7B3D5cF",
}

const GAME_CREDITS_ABI = [
  "function credits(address) external view returns (uint256)",
  "event CreditsPurchased(address indexed player, uint256 amount, uint256 creditsReceived, uint256 totalCost)",
  "event CreditsMigrated(address indexed player, uint256 amount)",
]

async function checkContract(contractAddress, contractName) {
  const provider = new ethers.JsonRpcProvider(RPC_URL)
  const contract = new ethers.Contract(contractAddress, GAME_CREDITS_ABI, provider)
  
  console.log(`\n📋 Checking ${contractName}:`)
  console.log(`   Address: ${contractAddress}`)
  
  try {
    // Get current block
    const currentBlock = await provider.getBlockNumber()
    const fromBlock = Math.max(0, currentBlock - 200000) // Last 200k blocks
    
    console.log(`   Querying events from block ${fromBlock} to ${currentBlock}...`)
    
    // Check CreditsPurchased events
    const purchaseFilter = contract.filters.CreditsPurchased()
    const purchaseEvents = await contract.queryFilter(purchaseFilter, fromBlock, currentBlock)
    
    // Check CreditsMigrated events
    let migrateEvents = []
    try {
      const migrateFilter = contract.filters.CreditsMigrated()
      migrateEvents = await contract.queryFilter(migrateFilter, fromBlock, currentBlock)
    } catch (error) {
      // Contract might not have this event
    }
    
    console.log(`   Found ${purchaseEvents.length} CreditsPurchased events`)
    console.log(`   Found ${migrateEvents.length} CreditsMigrated events`)
    
    // Get unique players
    const players = new Set()
    purchaseEvents.forEach(event => {
      players.add(event.args.player.toLowerCase())
    })
    migrateEvents.forEach(event => {
      players.add(event.args.player.toLowerCase())
    })
    
    console.log(`   Unique players: ${players.size}`)
    
    // Check balances for players with events
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
        if (checked % 20 === 0) {
          process.stdout.write(`   Checking balances: ${checked}/${players.size}...\r`)
        }
      } catch (error) {
        // Ignore
      }
    }
    
    console.log(`\n   Players with credits > 0: ${playersWithCredits.length}`)
    
    if (playersWithCredits.length > 0) {
      let total = 0
      playersWithCredits.forEach(p => total += p.balance)
      console.log(`   Total credits: ${total}`)
      console.log(`   Top 5 players:`)
      playersWithCredits.sort((a, b) => b.balance - a.balance).slice(0, 5).forEach((p, i) => {
        console.log(`      ${i + 1}. ${p.address}: ${p.balance} credits`)
      })
    }
    
    return {
      name: contractName,
      address: contractAddress,
      playersWithCredits: playersWithCredits.length,
      totalCredits: playersWithCredits.reduce((sum, p) => sum + p.balance, 0),
      players: playersWithCredits
    }
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`)
    return {
      name: contractName,
      address: contractAddress,
      playersWithCredits: 0,
      totalCredits: 0,
      players: [],
      error: error.message
    }
  }
}

async function main() {
  console.log("=".repeat(70))
  console.log("COMPLETE CONTRACT ANALYSIS")
  console.log("=".repeat(70))
  
  const results = await Promise.all([
    checkContract(CONTRACTS.OLD, "OLD"),
    checkContract(CONTRACTS.INTERMEDIARY, "INTERMEDIARY"),
    checkContract(CONTRACTS.CURRENT, "CURRENT"),
  ])
  
  console.log("\n")
  console.log("=".repeat(70))
  console.log("SUMMARY")
  console.log("=".repeat(70))
  
  results.forEach(result => {
    console.log(`\n${result.name}:`)
    console.log(`   Players with credits: ${result.playersWithCredits}`)
    console.log(`   Total credits: ${result.totalCredits}`)
    if (result.error) {
      console.log(`   Error: ${result.error}`)
    }
  })
  
  console.log("\n")
  console.log("=".repeat(70))
  console.log("RECOMMENDATION")
  console.log("=".repeat(70))
  
  const oldResult = results[0]
  const intermediaryResult = results[1]
  const currentResult = results[2]
  
  if (currentResult.playersWithCredits > 0) {
    console.log("✅ Players already have credits in CURRENT contract")
    console.log("   → No migration needed")
    console.log("   → Check .env.local configuration")
  } else if (intermediaryResult.playersWithCredits > 0) {
    console.log("⚠️ Credits found in INTERMEDIARY contract")
    console.log("   → Run: node scripts/migrate-from-intermediary.js")
  } else if (oldResult.playersWithCredits > 0) {
    console.log("⚠️ Credits found in OLD contract")
    console.log("   → Need to migrate from OLD to CURRENT")
    console.log("   → Update migration script to use OLD as source")
  } else {
    console.log("ℹ️ No credits found in any contract")
    console.log("   → Players need to purchase new credits")
  }
}

main().catch(console.error)


