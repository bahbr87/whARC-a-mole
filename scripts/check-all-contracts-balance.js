import { ethers } from "ethers"

const RPC_URL = "https://rpc.testnet.arc.network"

// Todos os contratos GameCredits que foram deployados
const CONTRACTS = {
  "OLD": "0xB6EF59882778d0A245202F1482f20f02ad82bd87",
  "INTERMEDIARY": "0x41Afb27763416f555207c9B0bB04F08E665b4AFd", // Onde foi feita a migração
  "CURRENT": "0x531Ba20fB57fb9Efe6b8f5c7Cbf29248A7B3D5cF", // Contrato atual
}

// Get player address from command line argument
const PLAYER = process.argv[2]

if (!PLAYER) {
  console.error("❌ Usage: node scripts/check-all-contracts-balance.js <PLAYER_ADDRESS>")
  process.exit(1)
}

const GAME_CREDITS_ABI = [
  "function credits(address) external view returns (uint256)",
  "function getCredits(address) external view returns (uint256)",
]

async function checkBalance(contractAddress, contractName) {
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
        return {
          contract: contractAddress,
          name: contractName,
          balance: "0",
          balanceNumber: 0,
          error: error2.message,
          success: false
        }
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
      balance: "0",
      balanceNumber: 0,
      error: error.message,
      success: false
    }
  }
}

async function main() {
  console.log("🔍 Checking credits for player:", PLAYER)
  console.log("")
  
  const results = await Promise.all([
    checkBalance(CONTRACTS.OLD, "OLD (Original)"),
    checkBalance(CONTRACTS.INTERMEDIARY, "INTERMEDIARY (Migration target)"),
    checkBalance(CONTRACTS.CURRENT, "CURRENT (Active)"),
  ])
  
  console.log("=".repeat(70))
  console.log("RESULTS:")
  console.log("=".repeat(70))
  
  let totalCredits = 0
  results.forEach(result => {
    console.log("")
    console.log(`📋 ${result.name}:`)
    console.log(`   Address: ${result.contract}`)
    if (result.success) {
      console.log(`   ✅ Balance: ${result.balanceNumber} credits`)
      totalCredits += result.balanceNumber
    } else {
      console.log(`   ❌ Error: ${result.error}`)
    }
  })
  
  console.log("")
  console.log("=".repeat(70))
  console.log("SUMMARY:")
  console.log("=".repeat(70))
  console.log(`Total credits across all contracts: ${totalCredits}`)
  console.log("")
  
  const currentResult = results[2] // CURRENT contract
  const intermediaryResult = results[1] // INTERMEDIARY contract
  
  if (currentResult.success && currentResult.balanceNumber > 0) {
    console.log("✅ Player HAS credits in CURRENT contract")
    console.log("   → Frontend should show credits correctly")
    console.log("   → If frontend shows 0, check:")
    console.log("     1. NEXT_PUBLIC_GAME_CREDITS_ADDRESS in .env.local =", CONTRACTS.CURRENT)
    console.log("     2. Browser console for errors")
    console.log("     3. Restart Next.js dev server")
  } else if (intermediaryResult.success && intermediaryResult.balanceNumber > 0) {
    console.log("⚠️ Player HAS credits in INTERMEDIARY contract but NOT in CURRENT")
    console.log("   → Credits need to be migrated from intermediary to current contract")
    console.log("   → Intermediary:", CONTRACTS.INTERMEDIARY)
    console.log("   → Current:", CONTRACTS.CURRENT)
  } else {
    console.log("❌ Player has NO credits in CURRENT contract")
    console.log("   → Player needs to purchase credits or migrate from old contract")
  }
}

main().catch(console.error)


