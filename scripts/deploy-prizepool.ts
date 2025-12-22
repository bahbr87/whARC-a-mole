import { ethers } from "ethers"
import * as fs from "fs"
import * as path from "path"
import { fileURLToPath } from "url"
import solc from "solc"
import "dotenv/config"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function main() {
  const RPC_URL = process.env.ARC_RPC_URL || process.env.RPC_URL || "https://rpc.testnet.arc.network"
  const OWNER_PK = process.env.OWNER_PRIVATE_KEY || process.env.PRIZE_POOL_OWNER_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY

  if (!OWNER_PK) {
    throw new Error("OWNER_PRIVATE_KEY, PRIZE_POOL_OWNER_PRIVATE_KEY ou DEPLOYER_PRIVATE_KEY não definidos no .env.local")
  }

  const USDC_REAL_ARC_TESTNET = "0x37225a0bC4bc9f2dAA06F535E7B8BC7AB03636c4"

  const provider = new ethers.JsonRpcProvider(RPC_URL)
  const wallet = new ethers.Wallet(OWNER_PK, provider)

  console.log("🚀 Deployando PrizePool")
  console.log("👤 Deployer:", wallet.address)
  console.log("💵 USDC:", USDC_REAL_ARC_TESTNET)
  console.log("")

  // Compile PrizePool contract
  console.log("📦 Compilando PrizePool contract...")
  const contractsPath = path.join(__dirname, "..", "contracts")
  const prizePoolPath = path.join(contractsPath, "PrizePool.sol")

  if (!fs.existsSync(prizePoolPath)) {
    throw new Error(`❌ Contract file not found: ${prizePoolPath}`)
  }

  const input = {
    language: "Solidity",
    sources: {
      "PrizePool.sol": {
        content: fs.readFileSync(prizePoolPath, "utf8"),
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
    const walkDir = (dir: string, fileMap: Record<string, string> = {}): Record<string, string> => {
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
    const errors = output.errors.filter((e: any) => e.severity === "error")
    if (errors.length > 0) {
      console.error("❌ Compilation errors:")
      errors.forEach((error: any) => console.error(error.formattedMessage))
      process.exit(1)
    }
  }

  const PrizePool = output.contracts["PrizePool.sol"]["PrizePool"]

  if (!PrizePool) {
    console.error("❌ PrizePool contract not found in compilation output")
    process.exit(1)
  }

  console.log("✅ PrizePool compiled successfully")
  console.log("")

  // Deploy PrizePool
  console.log("📦 Deployando PrizePool...")
  const factory = new ethers.ContractFactory(PrizePool.abi, PrizePool.evm.bytecode.object, wallet)
  const contract = await factory.deploy(USDC_REAL_ARC_TESTNET, wallet.address)
  await contract.waitForDeployment()

  const address = await contract.getAddress()

  console.log("")
  console.log("✅ NOVO PRIZEPOOL DEPLOYADO")
  console.log("📍 Endereço:", address)
  console.log("🔗 https://testnet.arcscan.app/address/" + address)
}

main().catch(err => {
  console.error("❌ ERRO:", err)
  process.exit(1)
})


