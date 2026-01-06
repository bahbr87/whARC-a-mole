import { readFileSync } from "fs"
import { fileURLToPath } from "url"
import { dirname, join } from "path"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

console.log("🔍 Verifying GameCredits Contract Configuration")
console.log("=".repeat(60))

// Read arc-config.ts to see the default
try {
  const arcConfigPath = join(__dirname, "..", "lib", "arc-config.ts")
  const arcConfigContent = readFileSync(arcConfigPath, "utf-8")
  
  const match = arcConfigContent.match(/GAME_CREDITS_ADDRESS.*?=.*?["'](0x[a-fA-F0-9]{40})["']/)
  if (match) {
    console.log("✅ arc-config.ts default:", match[1])
  }
} catch (error) {
  console.log("⚠️ Could not read arc-config.ts")
}

// Read deployment.json
try {
  const deploymentPath = join(__dirname, "..", "deployment.json")
  const deployment = JSON.parse(readFileSync(deploymentPath, "utf-8"))
  if (deployment.GameCredits) {
    console.log("✅ deployment.json:", deployment.GameCredits)
  }
} catch (error) {
  console.log("⚠️ Could not read deployment.json")
}

console.log("")
console.log("📝 IMPORTANT:")
console.log("   The frontend uses NEXT_PUBLIC_GAME_CREDITS_ADDRESS from .env.local")
console.log("   If not set, it falls back to arc-config.ts default")
console.log("")
console.log("🔧 To fix credits showing as 0:")
console.log("   1. Check .env.local has: NEXT_PUBLIC_GAME_CREDITS_ADDRESS=0x531Ba20fB57fb9Efe6b8f5c7Cbf29248A7B3D5cF")
console.log("   2. Restart Next.js dev server after updating .env.local")
console.log("   3. Check browser console for errors")
console.log("   4. Verify player has credits in the new contract")


