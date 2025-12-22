import { Wallet, JsonRpcProvider, Contract } from "ethers"
import * as dotenv from "dotenv"
import * as path from "path"

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), ".env.local") })

const RPC_URL = process.env.RPC_URL || "https://rpc.testnet.arc.network"
const CHAIN_ID = parseInt(process.env.CHAIN_ID || "5042002")
const GAME_CREDITS_ADDRESS = process.env.GAME_CREDITS_ADDRESS || "0xB6EF59882778d0A245202F1482f20f02ad82bd87"
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY || ""
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || ""

async function main() {
  console.log("=".repeat(60))
  console.log("AUTHORIZING RELAYER IN GAMECREDITS CONTRACT")
  console.log("=".repeat(60))

  if (!RELAYER_PRIVATE_KEY && !DEPLOYER_PRIVATE_KEY) {
    console.error("❌ Error: RELAYER_PRIVATE_KEY or DEPLOYER_PRIVATE_KEY not found in .env.local")
    process.exit(1)
  }

  // Use deployer key if relayer key not set (they might be the same)
  const privateKey = RELAYER_PRIVATE_KEY || DEPLOYER_PRIVATE_KEY
  const provider = new JsonRpcProvider(RPC_URL, CHAIN_ID)
  const wallet = new Wallet(privateKey, provider)
  const relayerAddress = wallet.address

  console.log(`\n📋 Configuration:`)
  console.log(`   RPC URL: ${RPC_URL}`)
  console.log(`   Chain ID: ${CHAIN_ID}`)
  console.log(`   GameCredits: ${GAME_CREDITS_ADDRESS}`)
  console.log(`   Relayer Address: ${relayerAddress}`)
  console.log(`   Wallet Address: ${wallet.address}`)

  // Check balance
  const balance = await provider.getBalance(wallet.address)
  console.log(`\n💰 Wallet Balance: ${balance.toString()} wei`)
  if (balance === 0n) {
    console.warn("⚠️  Warning: Wallet has no balance!")
    console.warn("   You need USDC (not ETH) on Arc Testnet for gas fees")
    console.warn("   Get USDC from: https://faucet.circle.com")
  }

  // GameCredits ABI
  const GAME_CREDITS_ABI = [
    "function owner() external view returns (address)",
    "function authorizedConsumers(address) external view returns (bool)",
    "function authorizeConsumer(address consumer) external",
    "function credits(address) external view returns (uint256)",
  ]

  const gameCreditsContract = new Contract(
    GAME_CREDITS_ADDRESS,
    GAME_CREDITS_ABI,
    wallet
  )

  try {
    // Check current authorization status
    console.log(`\n🔍 Checking authorization status...`)
    const owner = await gameCreditsContract.owner()
    const isOwner = owner.toLowerCase() === wallet.address.toLowerCase()
    const isAuthorized = await gameCreditsContract.authorizedConsumers(relayerAddress)

    console.log(`   Contract Owner: ${owner}`)
    console.log(`   Wallet is Owner: ${isOwner}`)
    console.log(`   Relayer is Authorized: ${isAuthorized}`)

    if (isAuthorized) {
      console.log(`\n✅ Relayer is already authorized!`)
      return
    }

    if (!isOwner) {
      console.error(`\n❌ Error: Wallet (${wallet.address}) is not the owner of the contract`)
      console.error(`   Contract owner is: ${owner}`)
      console.error(`\n💡 Solutions:`)
      console.error(`   1. Use the owner wallet to authorize the relayer`)
      console.error(`   2. Or call authorizeConsumer(${relayerAddress}) from the owner wallet`)
      process.exit(1)
    }

    // Authorize relayer
    console.log(`\n📤 Authorizing relayer as consumer...`)
    const tx = await gameCreditsContract.authorizeConsumer(relayerAddress)
    console.log(`   Transaction sent: ${tx.hash}`)
    console.log(`   Waiting for confirmation...`)

    const receipt = await tx.wait()
    console.log(`\n✅ SUCCESS! Relayer authorized`)
    console.log(`   Transaction: ${tx.hash}`)
    console.log(`   Block: ${receipt.blockNumber}`)
    console.log(`   Gas used: ${receipt.gasUsed?.toString()}`)

    // Verify authorization
    const verified = await gameCreditsContract.authorizedConsumers(relayerAddress)
    if (verified) {
      console.log(`\n✅ Verification: Relayer is now authorized`)
    } else {
      console.error(`\n❌ Verification failed: Relayer is not authorized`)
    }

  } catch (error: any) {
    console.error(`\n❌ Error authorizing relayer:`)
    console.error(`   Message: ${error.message || "Unknown error"}`)
    console.error(`   Reason: ${error.reason || "N/A"}`)
    if (error.transaction) {
      console.error(`   Transaction: ${error.transaction.hash || "N/A"}`)
    }
    process.exit(1)
  }
}

main().catch((error) => {
  console.error("Fatal error:", error)
  process.exit(1)
})

