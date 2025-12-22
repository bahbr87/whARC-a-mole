import { ethers } from "ethers"
import dotenv from "dotenv"
import { readFileSync } from "fs"

// Load environment variables
const envFile = readFileSync(".env.local", "utf-8")
const envVars = {}
envFile.split("\n").forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/)
  if (match) {
    envVars[match[1].trim()] = match[2].trim()
  }
})

// Use the same address as frontend (lib/arc-config.ts)
// FORCE use of the correct contract address (the one with credits)
const GAME_CREDITS_ADDRESS = "0xB6EF59882778d0A245202F1482f20f02ad82bd87"
const META_TRANSACTION_ADDRESS = envVars.META_TRANSACTION_ADDRESS || "0x0000000000000000000000000000000000000000"
const RPC_URL = envVars.RPC_URL || "https://rpc.testnet.arc.network"
const CHAIN_ID = parseInt(envVars.CHAIN_ID || "5042002")
const RELAYER_PRIVATE_KEY = envVars.RELAYER_PRIVATE_KEY || ""

if (!RELAYER_PRIVATE_KEY) {
  console.error("❌ RELAYER_PRIVATE_KEY not found in .env.local")
  process.exit(1)
}

const provider = new ethers.JsonRpcProvider(RPC_URL, CHAIN_ID)
const relayer = new ethers.Wallet(RELAYER_PRIVATE_KEY, provider)

const GAME_CREDITS_ABI = [
  "function owner() external view returns (address)",
  "function authorizedConsumers(address) external view returns (bool)",
  "function authorizeConsumer(address consumer) external",
  "function consumeCredits(address player, uint256 clickCount) external",
  "function credits(address) external view returns (uint256)",
]

async function testCreditConsumption() {
  try {
    console.log("🔍 Testing Credit Consumption Setup\n")
    console.log(`Relayer Address: ${relayer.address}`)
    console.log(`GameCredits Address: ${GAME_CREDITS_ADDRESS}`)
    console.log(`MetaTransaction Address: ${META_TRANSACTION_ADDRESS}\n`)

    const gameCreditsContract = new ethers.Contract(
      GAME_CREDITS_ADDRESS,
      GAME_CREDITS_ABI,
      provider
    )

    // Check owner
    const owner = await gameCreditsContract.owner()
    console.log(`Owner: ${owner}`)
    console.log(`Is Relayer Owner: ${owner.toLowerCase() === relayer.address.toLowerCase()}\n`)

    // Check authorizations
    const relayerAuthorized = await gameCreditsContract.authorizedConsumers(relayer.address)
    const processorAuthorized = await gameCreditsContract.authorizedConsumers(META_TRANSACTION_ADDRESS)
    
    console.log(`Relayer Authorized: ${relayerAuthorized}`)
    console.log(`Processor Authorized: ${processorAuthorized}\n`)

    // Test player address (you can change this)
    const testPlayer = process.argv[2] || "0xB51158878a08a860443B10b2F24617bab5F1F3eA"
    console.log(`Testing with player: ${testPlayer}`)
    
    const playerCredits = await gameCreditsContract.credits(testPlayer)
    console.log(`Player Credits: ${playerCredits.toString()}\n`)

    // Try to authorize relayer if owner
    if (owner.toLowerCase() === relayer.address.toLowerCase() && !relayerAuthorized) {
      console.log("🔧 Authorizing relayer as consumer...")
      const gameCreditsContractWithSigner = new ethers.Contract(
        GAME_CREDITS_ADDRESS,
        GAME_CREDITS_ABI,
        relayer
      )
      
      try {
        const authTx = await gameCreditsContractWithSigner.authorizeConsumer(relayer.address)
        console.log(`Authorization transaction: ${authTx.hash}`)
        await authTx.wait()
        console.log("✅ Relayer authorized!\n")
      } catch (error) {
        console.error("❌ Failed to authorize:", error.message)
      }
    }

    // Try to consume credits
    if (owner.toLowerCase() === relayer.address.toLowerCase() || relayerAuthorized) {
      console.log("🧪 Testing credit consumption...")
      const gameCreditsContractWithSigner = new ethers.Contract(
        GAME_CREDITS_ADDRESS,
        GAME_CREDITS_ABI,
        relayer
      )

      if (playerCredits < 1n) {
        console.error(`❌ Player has insufficient credits: ${playerCredits.toString()}`)
        return
      }

      try {
        const tx = await gameCreditsContractWithSigner.consumeCredits(testPlayer, 1)
        console.log(`Transaction sent: ${tx.hash}`)
        const receipt = await tx.wait()
        console.log(`✅ Credits consumed successfully! Block: ${receipt.blockNumber}`)
        
        // Check new balance
        const newBalance = await gameCreditsContract.credits(testPlayer)
        console.log(`New balance: ${newBalance.toString()}`)
      } catch (error) {
        console.error("❌ Failed to consume credits:")
        console.error(`Error: ${error.message}`)
        if (error.reason) {
          console.error(`Reason: ${error.reason}`)
        }
        if (error.data) {
          console.error(`Data: ${JSON.stringify(error.data)}`)
        }
      }
    } else {
      console.error("❌ Relayer is not authorized to consume credits")
      console.error("   Relayer must be owner or authorized consumer")
    }

  } catch (error) {
    console.error("❌ Error:", error.message)
    process.exit(1)
  }
}

testCreditConsumption()

