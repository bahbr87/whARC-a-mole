import * as fs from "fs"
import * as path from "path"
import { Wallet } from "ethers"

const envPath = path.join(process.cwd(), ".env.local")

// Read existing .env.local or create new
let envContent = ""
if (fs.existsSync(envPath)) {
  envContent = fs.readFileSync(envPath, "utf-8")
}

// Configuration values
const config = {
  GAME_CREDITS_ADDRESS: "0xB6EF59882778d0A245202F1482f20f02ad82bd87",
  NEXT_PUBLIC_GAME_CREDITS_ADDRESS: "0xB6EF59882778d0A245202F1482f20f02ad82bd87",
  RPC_URL: "https://rpc.testnet.arc.network",
  CHAIN_ID: "5042002",
}

// Check if RELAYER_PRIVATE_KEY exists
const hasRelayerKey = envContent.includes("RELAYER_PRIVATE_KEY=") && 
                     !envContent.includes("RELAYER_PRIVATE_KEY=0x...") &&
                     !envContent.includes("RELAYER_PRIVATE_KEY=#")

let relayerKey = ""
let relayerAddress = ""

if (hasRelayerKey) {
  // Extract existing relayer key
  const match = envContent.match(/RELAYER_PRIVATE_KEY=(0x[a-fA-F0-9]+)/)
  if (match) {
    relayerKey = match[1]
    const wallet = new Wallet(relayerKey)
    relayerAddress = wallet.address
    console.log("✅ Found existing RELAYER_PRIVATE_KEY")
    console.log(`   Address: ${relayerAddress}`)
  }
} else {
  // Use DEPLOYER_PRIVATE_KEY if available
  const deployerMatch = envContent.match(/DEPLOYER_PRIVATE_KEY=(0x[a-fA-F0-9]+)/)
  if (deployerMatch) {
    relayerKey = deployerMatch[1]
    const wallet = new Wallet(relayerKey)
    relayerAddress = wallet.address
    console.log("✅ Using DEPLOYER_PRIVATE_KEY as RELAYER_PRIVATE_KEY")
    console.log(`   Address: ${relayerAddress}`)
  } else {
    console.log("⚠️  No RELAYER_PRIVATE_KEY or DEPLOYER_PRIVATE_KEY found")
    console.log("   Generating new wallet...")
    const wallet = Wallet.createRandom()
    relayerKey = wallet.privateKey
    relayerAddress = wallet.address
    console.log(`   New Relayer Address: ${relayerAddress}`)
  }
}

// Update or add configuration
const updates: string[] = []

// Update GAME_CREDITS_ADDRESS
if (!envContent.includes("GAME_CREDITS_ADDRESS=") || 
    envContent.includes("GAME_CREDITS_ADDRESS=0x0000000000000000000000000000000000000000")) {
  updates.push(`GAME_CREDITS_ADDRESS=${config.GAME_CREDITS_ADDRESS}`)
}

// Update NEXT_PUBLIC_GAME_CREDITS_ADDRESS
if (!envContent.includes("NEXT_PUBLIC_GAME_CREDITS_ADDRESS=") ||
    envContent.includes("NEXT_PUBLIC_GAME_CREDITS_ADDRESS=0x0000000000000000000000000000000000000000")) {
  updates.push(`NEXT_PUBLIC_GAME_CREDITS_ADDRESS=${config.NEXT_PUBLIC_GAME_CREDITS_ADDRESS}`)
}

// Update RPC_URL
if (!envContent.includes("RPC_URL=")) {
  updates.push(`RPC_URL=${config.RPC_URL}`)
}

// Update CHAIN_ID
if (!envContent.includes("CHAIN_ID=")) {
  updates.push(`CHAIN_ID=${config.CHAIN_ID}`)
}

// Update RELAYER_PRIVATE_KEY
if (!hasRelayerKey) {
  updates.push(`RELAYER_PRIVATE_KEY=${relayerKey}`)
  updates.push(`RELAYER_ADDRESS=${relayerAddress}`)
}

if (updates.length > 0) {
  console.log("\n📝 Updating .env.local with:")
  updates.forEach(update => {
    const key = update.split("=")[0]
    const value = update.split("=")[1]
    if (key.includes("PRIVATE_KEY")) {
      console.log(`   ${key}=${value.substring(0, 10)}...`)
    } else {
      console.log(`   ${update}`)
    }
  })

  // Append updates to .env.local
  const updateContent = "\n# Relayer Configuration (auto-updated)\n" + updates.join("\n") + "\n"
  fs.appendFileSync(envPath, updateContent)
  console.log("\n✅ .env.local updated successfully!")
} else {
  console.log("\n✅ .env.local already has all required configuration")
}

console.log("\n📋 Summary:")
console.log(`   Relayer Address: ${relayerAddress}`)
console.log(`   GameCredits: ${config.GAME_CREDITS_ADDRESS}`)
console.log(`   RPC: ${config.RPC_URL}`)
console.log(`   Chain ID: ${config.CHAIN_ID}`)
console.log("\n💡 Next steps:")
console.log("   1. Fund the relayer with USDC: https://faucet.circle.com")
console.log("   2. Authorize relayer: npm run authorize-relayer")
console.log("   3. Restart server: npm run dev")

