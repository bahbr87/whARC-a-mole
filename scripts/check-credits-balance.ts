/**
 * Script para verificar o saldo de créditos de uma carteira
 * 
 * Uso:
 *   npx tsx scripts/check-credits-balance.ts [address]
 */

import { ethers } from "ethers"

import "dotenv/config"
import { GAME_CREDITS_ADDRESS as GAME_CREDITS_ADDRESS_FROM_CONFIG } from "../lib/arc-config"

const RPC_URL = process.env.RPC_URL || "https://rpc.testnet.arc.network"
const GAME_CREDITS_ADDRESS = process.env.NEXT_PUBLIC_GAME_CREDITS_ADDRESS || 
                              process.env.GAME_CREDITS_ADDRESS ||
                              GAME_CREDITS_ADDRESS_FROM_CONFIG ||
                              "0x0000000000000000000000000000000000000000"

const GAME_CREDITS_ABI = [
  "function credits(address) external view returns (uint256)",
  "function getCredits(address player) external view returns (uint256)",
]

async function checkCreditsBalance(address: string) {
  if (!address || address === "0x0000000000000000000000000000000000000000") {
    console.error("❌ Invalid address")
    process.exit(1)
  }

  if (GAME_CREDITS_ADDRESS === "0x0000000000000000000000000000000000000000") {
    console.error("❌ GAME_CREDITS_ADDRESS not configured")
    process.exit(1)
  }

  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL)
    const contract = new ethers.Contract(GAME_CREDITS_ADDRESS, GAME_CREDITS_ABI, provider)

    console.log("🔍 Checking credits balance...")
    console.log("📍 Address:", address)
    console.log("📋 Contract:", GAME_CREDITS_ADDRESS)
    console.log("🌐 RPC:", RPC_URL)
    console.log()

    // Try credits() first
    let balance: bigint
    try {
      balance = await contract.credits(address)
      console.log("✅ Got balance from credits():", balance.toString())
    } catch (error: any) {
      console.log("⚠️ credits() failed, trying getCredits():", error.message)
      try {
        balance = await contract.getCredits(address)
        console.log("✅ Got balance from getCredits():", balance.toString())
      } catch (error2: any) {
        console.error("❌ Both methods failed:", error2.message)
        process.exit(1)
      }
    }

    const balanceNumber = Number(balance)
    console.log()
    console.log("📊 Result:")
    console.log("   Balance (BigInt):", balance.toString())
    console.log("   Balance (Number):", balanceNumber.toLocaleString())
    console.log("   Balance (Formatted):", balanceNumber.toLocaleString(), "credits")

    return balanceNumber
  } catch (error: any) {
    console.error("❌ Error checking balance:", error.message)
    process.exit(1)
  }
}

// Get address from command line or use default
const address = process.argv[2] || "0x650cCD684cAb88E05d1b4b5fF3627FA57EfE75E5"

checkCreditsBalance(address)
  .then((balance) => {
    console.log()
    console.log("✅ Done!")
    process.exit(0)
  })
  .catch((error) => {
    console.error("❌ Error:", error)
    process.exit(1)
  })

