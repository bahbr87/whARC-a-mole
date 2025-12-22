import { Wallet, JsonRpcProvider, ContractFactory } from "ethers"
import * as fs from "fs"
import * as path from "path"
import solc from "solc"
import dotenv from "dotenv"

dotenv.config({ path: path.join(process.cwd(), ".env.local") })

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY
const RPC_URL = "https://rpc.testnet.arc.network"
const CHAIN_ID = 5042002

// Official Arc Testnet USDC address
const OFFICIAL_USDC_ADDRESS = "0x3600000000000000000000000000000000000000"

if (!DEPLOYER_PRIVATE_KEY) {
  console.error("❌ DEPLOYER_PRIVATE_KEY not found in .env.local")
  process.exit(1)
}

async function main() {
  console.log("=".repeat(60))
  console.log("REDEPLOYING GAMECREDITS WITH OFFICIAL ARC USDC")
  console.log("=".repeat(60))
  console.log("Official USDC Address:", OFFICIAL_USDC_ADDRESS)

  const provider = new JsonRpcProvider(RPC_URL, CHAIN_ID)
  const wallet = new Wallet(DEPLOYER_PRIVATE_KEY, provider)

  console.log("\n📝 Deployer Address:", wallet.address)

  // Check balance
  try {
    const balance = await provider.getBalance(wallet.address)
    console.log("💰 Balance:", balance.toString(), "USDC (for gas)")
    
    if (balance < 1000000n) {
      console.error("\n❌ Deployer wallet has insufficient USDC for gas!")
      process.exit(1)
    }
  } catch (error) {
    console.error("Error checking balance:", error)
    process.exit(1)
  }

  // Compile GameCredits contract
  console.log("\n📦 Compiling GameCredits contract...")
  const contractsPath = path.join(process.cwd(), "contracts")
  const gameCreditsPath = path.join(contractsPath, "GameCredits.sol")

  const input = {
    language: "Solidity",
    sources: {
      "GameCredits.sol": {
        content: fs.readFileSync(gameCreditsPath, "utf8"),
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
  const openZeppelinPath = path.join(process.cwd(), "node_modules", "@openzeppelin", "contracts")
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

  // Deploy GameCredits with official USDC
  console.log("\n📦 Deploying GameCredits with official Arc USDC...")
  const GameCreditsFactory = new ContractFactory(GameCredits.abi, GameCredits.evm.bytecode.object, wallet)
  const gameCreditsContract = await GameCreditsFactory.deploy(OFFICIAL_USDC_ADDRESS)
  await gameCreditsContract.waitForDeployment()
  const gameCreditsAddress = await gameCreditsContract.getAddress()
  console.log("✅ GameCredits deployed to:", gameCreditsAddress)
  console.log("   Explorer:", `https://testnet.arcscan.app/address/${gameCreditsAddress}`)

  // Update .env.local
  console.log("\n📝 Updating .env.local...")
  const envLocalPath = path.join(process.cwd(), ".env.local")
  let envLocalContent = fs.existsSync(envLocalPath) ? fs.readFileSync(envLocalPath, "utf8") : ""

  if (envLocalContent.includes("NEXT_PUBLIC_GAME_CREDITS_ADDRESS")) {
    envLocalContent = envLocalContent.replace(
      /NEXT_PUBLIC_GAME_CREDITS_ADDRESS=0x[0-9a-fA-F]{40}/,
      `NEXT_PUBLIC_GAME_CREDITS_ADDRESS=${gameCreditsAddress}`
    )
  } else {
    envLocalContent += `\nNEXT_PUBLIC_GAME_CREDITS_ADDRESS=${gameCreditsAddress}\n`
  }

  fs.writeFileSync(envLocalPath, envLocalContent)
  console.log("✅ Updated .env.local")

  // Update lib/arc-config.ts
  console.log("\n📝 Updating lib/arc-config.ts...")
  const arcConfigPath = path.join(process.cwd(), "lib", "arc-config.ts")
  let arcConfigContent = fs.readFileSync(arcConfigPath, "utf8")

  if (arcConfigContent.includes("GAME_CREDITS_ADDRESS")) {
    arcConfigContent = arcConfigContent.replace(
      /export const GAME_CREDITS_ADDRESS = "0x[0-9a-fA-F]{40}"/,
      `export const GAME_CREDITS_ADDRESS = "${gameCreditsAddress}"`
    )
  } else {
    arcConfigContent += `\nexport const GAME_CREDITS_ADDRESS = "${gameCreditsAddress}"\n`
  }

  fs.writeFileSync(arcConfigPath, arcConfigContent)
  console.log("✅ Updated lib/arc-config.ts")

  // Update deployment.json
  console.log("\n📝 Updating deployment.json...")
  const deploymentPath = path.join(process.cwd(), "deployment.json")
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
}

main().catch((error) => {
  console.error("❌ Deployment failed:", error)
  process.exit(1)
})

