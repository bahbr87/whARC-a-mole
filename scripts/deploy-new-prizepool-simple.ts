import { ethers } from "ethers"
import * as fs from "fs"
import * as path from "path"
import { fileURLToPath } from "url"
import solc from "solc"
import "dotenv/config"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function main() {
  const RPC_URL = process.env.RPC_URL || "https://rpc.testnet.arc.network"
  // Load .env.local explicitly
  const dotenv = await import("dotenv")
  dotenv.config({ path: path.join(__dirname, "..", ".env.local") })
  
  const OWNER_PK = process.env.PRIZE_POOL_OWNER_PRIVATE_KEY || process.env.OWNER_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY

  if (!OWNER_PK) {
    throw new Error("PRIZE_POOL_OWNER_PRIVATE_KEY, OWNER_PRIVATE_KEY ou DEPLOYER_PRIVATE_KEY não definidos no .env.local")
  }

  const USDC_ADDRESS = "0x3600000000000000000000000000000000000000" // Official Arc Testnet USDC

  // Prize amounts in USDC (6 decimals)
  const FIRST_PRIZE = ethers.parseUnits("20", 6)  // 20 USDC
  const SECOND_PRIZE = ethers.parseUnits("10", 6) // 10 USDC
  const THIRD_PRIZE = ethers.parseUnits("5", 6)   // 5 USDC

  const provider = new ethers.JsonRpcProvider(RPC_URL)
  const wallet = new ethers.Wallet(OWNER_PK, provider)

  console.log("=".repeat(70))
  console.log("🚀 DEPLOY DO NOVO PRIZEPOOL")
  console.log("=".repeat(70))
  console.log("")
  console.log("👤 Deployer:", wallet.address)
  console.log("🌐 RPC URL:", RPC_URL)
  console.log("💵 USDC Address:", USDC_ADDRESS)
  console.log("💰 Prêmios:")
  console.log(`   1º lugar: ${ethers.formatUnits(FIRST_PRIZE, 6)} USDC`)
  console.log(`   2º lugar: ${ethers.formatUnits(SECOND_PRIZE, 6)} USDC`)
  console.log(`   3º lugar: ${ethers.formatUnits(THIRD_PRIZE, 6)} USDC`)
  console.log("")

  // Get balance
  const balance = await provider.getBalance(wallet.address)
  console.log(`💰 Saldo do deployer: ${ethers.formatEther(balance)} ETH`)
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

  // Find OpenZeppelin contracts
  const openZeppelinPath = path.join(__dirname, "..", "node_modules", "@openzeppelin", "contracts")
  const findImports = (importPath: string) => {
    if (importPath.startsWith("@openzeppelin/")) {
      const filePath = path.join(
        openZeppelinPath,
        importPath.replace("@openzeppelin/contracts/", "")
      )
      if (fs.existsSync(filePath)) {
        return { contents: fs.readFileSync(filePath, "utf8") }
      }
    }
    return { error: "File not found" }
  }

  const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }))

  if (output.errors) {
    const errors = output.errors.filter((e: any) => e.severity === "error")
    if (errors.length > 0) {
      console.error("❌ Compilation errors:")
      errors.forEach((error: any) => {
        console.error(`   ${error.message}`)
      })
      throw new Error("Compilation failed")
    }
  }

  const contract = output.contracts["PrizePool.sol"]["PrizePool"]
  const abi = contract.abi
  const bytecode = contract.evm.bytecode.object

  console.log("✅ Compilação concluída!")
  console.log("")

  // Deploy
  console.log("📤 Fazendo deploy do contrato...")
  const factory = new ethers.ContractFactory(abi, bytecode, wallet)
  const prizePool = await factory.deploy(
    USDC_ADDRESS,
    FIRST_PRIZE,
    SECOND_PRIZE,
    THIRD_PRIZE,
    {
      gasLimit: 3000000,
    }
  )

  console.log(`⏳ Aguardando confirmação...`)
  console.log(`   Transaction hash: ${prizePool.deploymentTransaction()?.hash}`)
  console.log(`   Explorer: https://testnet.arcscan.app/tx/${prizePool.deploymentTransaction()?.hash}`)
  console.log("")

  await prizePool.waitForDeployment()
  const contractAddress = await prizePool.getAddress()

  console.log("")
  console.log("✅ Contrato deployado com sucesso!")
  console.log("")
  console.log("=".repeat(70))
  console.log("📋 INFORMAÇÕES DO DEPLOY")
  console.log("=".repeat(70))
  console.log("")
  console.log(`📍 Endereço do contrato: ${contractAddress}`)
  console.log(`👤 Owner: ${wallet.address}`)
  console.log(`💵 USDC: ${USDC_ADDRESS}`)
  console.log(`💰 Prêmios:`)
  console.log(`   1º lugar: ${ethers.formatUnits(FIRST_PRIZE, 6)} USDC`)
  console.log(`   2º lugar: ${ethers.formatUnits(SECOND_PRIZE, 6)} USDC`)
  console.log(`   3º lugar: ${ethers.formatUnits(THIRD_PRIZE, 6)} USDC`)
  console.log("")
  console.log(`🔗 Explorer: https://testnet.arcscan.app/address/${contractAddress}`)
  console.log("")
  console.log("=".repeat(70))
  console.log("📝 PRÓXIMOS PASSOS")
  console.log("=".repeat(70))
  console.log("")
  console.log("1. Atualize o .env.local com o novo endereço:")
  console.log(`   NEXT_PUBLIC_PRIZE_POOL_CONTRACT_ADDRESS=${contractAddress}`)
  console.log("")
  console.log("2. Verifique o owner do contrato:")
  console.log(`   npx tsx scripts/verify-prizepool-owner.ts ${contractAddress}`)
  console.log("")
  console.log("3. Faça o fund do contrato com USDC (se necessário)")
  console.log("")
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Erro:", error)
    process.exit(1)
  })

