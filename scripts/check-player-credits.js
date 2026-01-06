import { ethers } from "ethers"
import { readFileSync } from "fs"
import { fileURLToPath } from "url"
import { dirname, join } from "path"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Read deployment.json to get contract addresses
let deployment = {}
try {
  const deploymentPath = join(__dirname, "..", "deployment.json")
  deployment = JSON.parse(readFileSync(deploymentPath, "utf-8"))
} catch (error) {
  console.log("⚠️ deployment.json not found, using defaults")
}

const RPC_URL = "https://rpc.testnet.arc.network"
const NEW_CONTRACT = deployment.GameCredits || "0x531Ba20fB57fb9Efe6b8f5c7Cbf29248A7B3D5cF"
const OLD_CONTRACT = "0xB6EF59882778d0A245202F1482f20f02ad82bd87"

// Get player address from command line argument
const PLAYER = process.argv[2]

if (!PLAYER) {
  console.error("❌ Usage: node scripts/check-player-credits.js <PLAYER_ADDRESS>")
  process.exit(1)
}

const GAME_CREDITS_ABI = [
  "function credits(address) external view returns (uint256)",
  "function getCredits(address) external view returns (uint256)",
]

async function checkCredits(contractAddress, contractName) {
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL)
    const contract = new ethers.Contract(contractAddress, GAME_CREDITS_ABI, provider)
    
    let balance
    try {
      balance = await contract.credits(PLAYER)
    } catch (error) {
      try {
        balance = await contract.getCredits(PLAYER)
      } catch (error2) {
        throw new Error(`Both methods failed: ${error.message}`)
      }
    }
    
    return {
      contract: contractAddress,
      name: contractName,
      balance: balance.toString(),
      balanceNumber: Number(balance),
      success: true
    }
  } catch (error) {
    return {
      contract: contractAddress,
      name: contractName,
      error: error.message,
      success: false
    }
  }
}

async function main() {
  console.log("🔍 Checking credits for player:", PLAYER)
  console.log("")
  
  const results = await Promise.all([
    checkCredits(NEW_CONTRACT, "NEW GameCredits"),
    checkCredits(OLD_CONTRACT, "OLD GameCredits"),
  ])
  
  console.log("=".repeat(60))
  console.log("RESULTS:")
  console.log("=".repeat(60))
  
  results.forEach(result => {
    console.log("")
    console.log(`📋 ${result.name}:`)
    console.log(`   Address: ${result.contract}`)
    if (result.success) {
      console.log(`   ✅ Balance: ${result.balanceNumber} credits (${result.balance})`)
    } else {
      console.log(`   ❌ Error: ${result.error}`)
    }
  })
  
  console.log("")
  console.log("=".repeat(60))
  console.log("DIAGNOSIS:")
  console.log("=".repeat(60))
  
  const newContractResult = results[0]
  const oldContractResult = results[1]
  
  if (newContractResult.success && newContractResult.balanceNumber > 0) {
    console.log("✅ Player HAS credits in NEW contract")
    console.log("   → Frontend should show credits correctly")
    console.log("   → If frontend shows 0, check:")
    console.log("     1. NEXT_PUBLIC_GAME_CREDITS_ADDRESS in .env.local")
    console.log("     2. Browser console for errors")
    console.log("     3. Network tab for failed requests")
  } else if (oldContractResult.success && oldContractResult.balanceNumber > 0) {
    console.log("⚠️ Player HAS credits in OLD contract but NOT in NEW contract")
    console.log("   → Credits need to be migrated from old to new contract")
    console.log("   → Use scripts/migrate-credits.js to migrate")
  } else {
    console.log("❌ Player has NO credits in either contract")
    console.log("   → Player needs to purchase credits")
  }
  
  console.log("")
  console.log("🔧 Frontend Configuration Check:")
  console.log("   Expected NEXT_PUBLIC_GAME_CREDITS_ADDRESS:", NEW_CONTRACT)
  console.log("   Check .env.local to ensure it matches")
}

main().catch(console.error)


