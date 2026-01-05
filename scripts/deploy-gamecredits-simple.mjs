import { ethers } from "ethers"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import dotenv from "dotenv"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load .env.local
dotenv.config({ path: path.join(__dirname, "..", ".env.local") })

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || process.env.PRIVATE_KEY
const RPC_URL = "https://rpc.testnet.arc.network"
const CHAIN_ID = 5042002

// Official Arc Testnet USDC address
const OFFICIAL_USDC_ADDRESS = "0x3600000000000000000000000000000000000000"

if (!DEPLOYER_PRIVATE_KEY) {
  console.error("❌ DEPLOYER_PRIVATE_KEY or PRIVATE_KEY not found in .env.local")
  console.error("Please add one of these to your .env.local file:")
  console.error("   DEPLOYER_PRIVATE_KEY=0x...")
  console.error("   or")
  console.error("   PRIVATE_KEY=0x...")
  process.exit(1)
}

async function main() {
  console.log("=".repeat(60))
  console.log("DEPLOYING GAMECREDITS CONTRACT")
  console.log("=".repeat(60))
  console.log("USDC Address:", OFFICIAL_USDC_ADDRESS)
  console.log("Network: Arc Testnet")
  console.log("Chain ID:", CHAIN_ID)
  console.log("RPC:", RPC_URL)

  const provider = new ethers.JsonRpcProvider(RPC_URL, CHAIN_ID)
  const wallet = new ethers.Wallet(DEPLOYER_PRIVATE_KEY, provider)

  console.log("\n👤 Deploying with account:", wallet.address)

  // Check balance
  try {
    const balance = await provider.getBalance(wallet.address)
    const balanceFormatted = Number(balance) / 1_000_000_000_000_000_000 // 18 decimais
    console.log("💰 Balance:", balanceFormatted.toFixed(6), "USDC (for gas)")

    if (balance < 1000000n) {
      console.error("\n❌ Deployer wallet has insufficient USDC for gas!")
      console.error("Please fund the wallet with USDC for gas fees")
      console.error("Address:", wallet.address)
      process.exit(1)
    }
  } catch (error) {
    console.error("Error checking balance:", error)
    process.exit(1)
  }

  // Read and compile GameCredits contract
  console.log("\n📦 Compiling GameCredits contract...")
  const contractsPath = path.join(__dirname, "..", "contracts")
  const gameCreditsPath = path.join(contractsPath, "GameCredits.sol")
  const gameCreditsSource = fs.readFileSync(gameCreditsPath, "utf8")

  // Simple compilation using solc (if available) or use pre-compiled bytecode
  // For now, we'll use a simpler approach - deploy using ethers with the source
  // But first, let's check if we can use the existing compilation artifacts
  
  console.log("📝 Reading contract source...")
  
  // Use solc to compile
  const solc = (await import("solc")).default
  
  const input = {
    language: "Solidity",
    sources: {
      "GameCredits.sol": {
        content: gameCreditsSource,
      },
    },
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: "cancun",
      outputSelection: {
        "*": {
          "*": ["abi", "evm.bytecode"],
        },
      },
    },
  }

  // Add OpenZeppelin dependencies
  const openZeppelinPath = path.join(__dirname, "..", "node_modules", "@openzeppelin", "contracts")
  if (fs.existsSync(openZeppelinPath)) {
    const walkDir = (dir, fileMap = {}) => {
      const files = fs.readdirSync(dir)
      files.forEach((file) => {
        const filePath = path.join(dir, file)
        const stat = fs.statSync(filePath)
        if (stat.isDirectory()) {
          walkDir(filePath, fileMap)
        } else if (file.endsWith(".sol")) {
          const relativePath = path.relative(openZeppelinPath, filePath).replace(/\\/g, "/")
          fileMap[`@openzeppelin/contracts/${relativePath}`] = fs.readFileSync(filePath, "utf8")
        }
      })
      return fileMap
    }
    const openZeppelinFiles = walkDir(openZeppelinPath)
    Object.keys(openZeppelinFiles).forEach((key) => {
      input.sources[key] = { content: openZeppelinFiles[key] }
    })
  }

  const output = JSON.parse(solc.compile(JSON.stringify(input)))

  if (output.errors) {
    const errors = output.errors.filter((e) => e.severity === "error")
    if (errors.length > 0) {
      console.error("❌ Compilation errors:")
      errors.forEach((error) => console.error(error.formattedMessage))
      process.exit(1)
    }
  }

  const GameCredits = output.contracts["GameCredits.sol"]["GameCredits"]

  if (!GameCredits) {
    console.error("❌ GameCredits contract not found in compilation output")
    process.exit(1)
  }

  console.log("✅ GameCredits compiled successfully")

  // Deploy GameCredits
  console.log("\n📦 Deploying GameCredits...")
  const GameCreditsFactory = new ethers.ContractFactory(
    GameCredits.abi,
    GameCredits.evm.bytecode.object,
    wallet
  )
  
  const gameCreditsContract = await GameCreditsFactory.deploy(OFFICIAL_USDC_ADDRESS)
  await gameCreditsContract.waitForDeployment()
  const gameCreditsAddress = await gameCreditsContract.getAddress()

  console.log("\n" + "=".repeat(60))
  console.log("✅ DEPLOYMENT SUCCESSFUL!")
  console.log("=".repeat(60))
  console.log("GameCredits deployed at:", gameCreditsAddress)
  console.log("Explorer:", `https://testnet.arcscan.app/address/${gameCreditsAddress}`)

  // Verify CREDIT_PRICE
  const creditPrice = await gameCreditsContract.CREDIT_PRICE()
  const creditPriceUSDC = Number(creditPrice) / 1_000_000
  console.log("\n📋 Contract Details:")
  console.log("   CREDIT_PRICE:", creditPrice.toString(), `(${creditPriceUSDC} USDC)`)
  
  const clickCost = await gameCreditsContract.CLICK_COST()
  const clickCostUSDC = Number(clickCost) / 1_000_000
  console.log("   CLICK_COST:", clickCost.toString(), `(${clickCostUSDC} USDC)`)

  // Update .env.local
  console.log("\n📝 Updating .env.local...")
  const envLocalPath = path.join(__dirname, "..", ".env.local")
  let envLocalContent = fs.existsSync(envLocalPath) ? fs.readFileSync(envLocalPath, "utf8") : ""

  // Update or add NEXT_PUBLIC_GAME_CREDITS_ADDRESS
  if (envLocalContent.includes("NEXT_PUBLIC_GAME_CREDITS_ADDRESS")) {
    envLocalContent = envLocalContent.replace(
      /NEXT_PUBLIC_GAME_CREDITS_ADDRESS=0x[0-9a-fA-F]{40}/i,
      `NEXT_PUBLIC_GAME_CREDITS_ADDRESS=${gameCreditsAddress}`
    )
  } else {
    envLocalContent += `\nNEXT_PUBLIC_GAME_CREDITS_ADDRESS=${gameCreditsAddress}\n`
  }

  // Update or add GAME_CREDITS_ADDRESS
  if (envLocalContent.includes("GAME_CREDITS_ADDRESS")) {
    envLocalContent = envLocalContent.replace(
      /GAME_CREDITS_ADDRESS=0x[0-9a-fA-F]{40}/i,
      `GAME_CREDITS_ADDRESS=${gameCreditsAddress}`
    )
  } else {
    envLocalContent += `\nGAME_CREDITS_ADDRESS=${gameCreditsAddress}\n`
  }

  fs.writeFileSync(envLocalPath, envLocalContent)
  console.log("✅ Updated .env.local")

  // Update lib/arc-config.ts
  console.log("\n📝 Updating lib/arc-config.ts...")
  const arcConfigPath = path.join(__dirname, "..", "lib", "arc-config.ts")
  let arcConfigContent = fs.readFileSync(arcConfigPath, "utf8")

  if (arcConfigContent.includes('export const GAME_CREDITS_ADDRESS')) {
    arcConfigContent = arcConfigContent.replace(
      /export const GAME_CREDITS_ADDRESS = process\.env\.NEXT_PUBLIC_GAME_CREDITS_ADDRESS \|\| "0x[0-9a-fA-F]{40}"/,
      `export const GAME_CREDITS_ADDRESS = process.env.NEXT_PUBLIC_GAME_CREDITS_ADDRESS || "${gameCreditsAddress}"`
    )
  } else {
    arcConfigContent += `\nexport const GAME_CREDITS_ADDRESS = process.env.NEXT_PUBLIC_GAME_CREDITS_ADDRESS || "${gameCreditsAddress}"\n`
  }

  fs.writeFileSync(arcConfigPath, arcConfigContent)
  console.log("✅ Updated lib/arc-config.ts")

  // Update deployment.json
  console.log("\n📝 Updating deployment.json...")
  const deploymentPath = path.join(__dirname, "..", "deployment.json")
  let deployment = {}
  if (fs.existsSync(deploymentPath)) {
    deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"))
  }
  deployment.GameCredits = gameCreditsAddress
  deployment.USDC = OFFICIAL_USDC_ADDRESS
  deployment.Timestamp = new Date().toISOString()
  fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2))
  console.log("✅ Updated deployment.json")

  console.log("\n" + "=".repeat(60))
  console.log("✅ DEPLOYMENT COMPLETE!")
  console.log("=".repeat(60))
  console.log("\n📋 Contract Addresses:")
  console.log("   GameCredits:", gameCreditsAddress)
  console.log("   USDC (Official):", OFFICIAL_USDC_ADDRESS)
  console.log("\n🔗 Explorer Links:")
  console.log("   GameCredits:", `https://testnet.arcscan.app/address/${gameCreditsAddress}`)
  console.log("   USDC:", `https://testnet.arcscan.app/address/${OFFICIAL_USDC_ADDRESS}`)
  console.log("\n⚠️  IMPORTANT: Restart your Next.js dev server for changes to take effect!")
  console.log("=".repeat(60))
}

main().catch((error) => {
  console.error("❌ Deployment failed:", error)
  process.exit(1)
})

