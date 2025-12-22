import { Wallet } from "ethers"
import * as fs from "fs"
import * as path from "path"

// Generate a new wallet
const wallet = Wallet.createRandom()

console.log("=".repeat(60))
console.log("NEW WALLET GENERATED")
console.log("=".repeat(60))
console.log("Address:", wallet.address)
console.log("Private Key:", wallet.privateKey)
console.log("=".repeat(60))
console.log("\n⚠️  IMPORTANT: Save the private key securely!")
console.log("⚠️  DO NOT commit the private key to git!")
console.log("=".repeat(60))

// Save to .env.local (append, don't overwrite)
const envPath = path.join(process.cwd(), ".env.local")
const envContent = `\n# Deployer Wallet (generated)\nDEPLOYER_PRIVATE_KEY=${wallet.privateKey}\nDEPLOYER_ADDRESS=${wallet.address}\n`

try {
  fs.appendFileSync(envPath, envContent)
  console.log("\n✅ Wallet saved to .env.local")
} catch (error) {
  console.error("Error saving to .env.local:", error)
  console.log("\nPlease manually add to .env.local:")
  console.log(envContent)
}







