// scripts/deploy-prizepool-with-faucet-usdc.ts

import "dotenv/config"
import { ethers } from "ethers"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import solc from "solc"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function main() {
  // =============================
  // CONFIGURAÇÃO OBRIGATÓRIA
  // =============================
  const RPC_URL = process.env.ARC_RPC_URL || process.env.RPC_URL || "https://rpc.testnet.arc.network"
  const PRIVATE_KEY = process.env.OWNER_PRIVATE_KEY || process.env.PRIZE_POOL_OWNER_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY

  // ⬇️ USDC DO FAUCET (O MESMO QUE VOCÊ RECEBE DA CIRCLE / EASYFAUCET)
  const FAUCET_USDC_ADDRESS = "0x3600000000000000000000000000000000000000"

  if (!PRIVATE_KEY) {
    throw new Error("Faltam variáveis de ambiente: OWNER_PRIVATE_KEY, PRIZE_POOL_OWNER_PRIVATE_KEY ou DEPLOYER_PRIVATE_KEY")
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL)
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider)

  console.log("🚀 Deployando PrizePool...")
  console.log("Owner:", wallet.address)
  console.log("USDC (faucet):", FAUCET_USDC_ADDRESS)
  console.log("")

  // =============================
  // COMPILAR CONTRATO
  // =============================
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

  // =============================
  // DEPLOY
  // =============================
  const factory = new ethers.ContractFactory(
    PrizePool.abi,
    PrizePool.evm.bytecode.object,
    wallet
  )

  // ⚠️ O CONSTRUCTOR RECEBE O USDC DO FAUCET E O OWNER
  console.log("📦 Deployando PrizePool com USDC do faucet...")
  const prizePool = await factory.deploy(FAUCET_USDC_ADDRESS, wallet.address)
  await prizePool.waitForDeployment()

  const address = await prizePool.getAddress()

  console.log("")
  console.log("✅ PRIZEPOOL DEPLOYADO COM USDC DO FAUCET")
  console.log("Endereço:", address)
  console.log("Explorer:", `https://testnet.arcscan.app/address/${address}`)
  console.log("")
  console.log("📝 Adicione ao .env.local:")
  console.log(`PRIZE_POOL_CONTRACT_ADDRESS=${address}`)
  console.log(`NEXT_PUBLIC_PRIZE_POOL_CONTRACT_ADDRESS=${address}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})




