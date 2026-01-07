import { ethers } from "ethers"

const RPC_URL = "https://rpc.testnet.arc.network"
const CURRENT_CONTRACT = "0x531Ba20fB57fb9Efe6b8f5c7Cbf29248A7B3D5cF"

const GAME_CREDITS_ABI = [
  "function migrationEnabled() external view returns (bool)",
  "function owner() external view returns (address)",
  "function migrateCredits(address player, uint256 amount) external",
]

async function main() {
  console.log("🔍 Checking if migration is enabled in CURRENT contract")
  console.log("=".repeat(60))
  console.log("Contract:", CURRENT_CONTRACT)
  console.log("")
  
  const provider = new ethers.JsonRpcProvider(RPC_URL)
  const contract = new ethers.Contract(CURRENT_CONTRACT, GAME_CREDITS_ABI, provider)
  
  try {
    const migrationEnabled = await contract.migrationEnabled()
    const owner = await contract.owner()
    
    console.log("✅ Migration Enabled:", migrationEnabled)
    console.log("✅ Owner:", owner)
    console.log("")
    
    if (migrationEnabled) {
      console.log("✅ MIGRATION IS ENABLED!")
      console.log("   → We can migrate credits from intermediary to current contract")
      console.log("   → NO REDEPLOY NEEDED")
      console.log("   → Just need to run migration script")
    } else {
      console.log("❌ MIGRATION IS DISABLED")
      console.log("   → Cannot migrate credits")
      console.log("   → Would need to enable migration or redeploy")
    }
  } catch (error) {
    console.error("❌ Error checking contract:", error.message)
    console.log("")
    console.log("⚠️ This might mean:")
    console.log("   1. Contract doesn't have migrationEnabled function")
    console.log("   2. Contract address is wrong")
    console.log("   3. RPC connection issue")
  }
}

main().catch(console.error)


