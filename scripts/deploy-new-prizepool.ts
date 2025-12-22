import { JsonRpcProvider, Contract, Wallet } from "ethers"
import dotenv from "dotenv"
import path from "path"
import { readFileSync } from "fs"

dotenv.config({ path: path.join(process.cwd(), ".env.local") })

const RPC_URL = process.env.RPC_URL || "https://rpc.testnet.arc.network"
const OWNER_PRIVATE_KEY = process.env.PRIZE_POOL_OWNER_PRIVATE_KEY
const USDC_ADDRESS = "0x3600000000000000000000000000000000000000" // Official Arc Testnet USDC

// Prize amounts in USDC (6 decimals)
const FIRST_PRIZE = 20e6  // 20 USDC
const SECOND_PRIZE = 10e6 // 10 USDC
const THIRD_PRIZE = 5e6   // 5 USDC

// PrizePool.sol bytecode and ABI (compiled)
const PRIZE_POOL_ABI = [
  "constructor(address _usdc, uint256 _first, uint256 _second, uint256 _third)",
  "function owner() view returns (address)",
  "function usdc() view returns (address)",
  "function prizes(uint256) view returns (uint256)",
  "function setDailyWinners(uint256 day, address[] calldata _winners, uint256 _totalPlayers) external",
  "function getWinner(uint256 day, uint256 rank) view returns (address)",
  "function canClaim(uint256 day, address user) view returns (bool)",
  "function claim(uint256 day) external",
  "function withdraw(uint256 amount) external",
]

async function deployNewPrizePool() {
  console.log("=".repeat(70))
  console.log("🚀 DEPLOY DO NOVO PRIZEPOOL")
  console.log("=".repeat(70))
  console.log("")

  if (!OWNER_PRIVATE_KEY) {
    console.error("❌ PRIZE_POOL_OWNER_PRIVATE_KEY não configurado no .env.local")
    process.exit(1)
  }

  try {
    const provider = new JsonRpcProvider(RPC_URL)
    const ownerWallet = new Wallet(OWNER_PRIVATE_KEY, provider)
    const ownerAddress = ownerWallet.address

    console.log(`👤 Owner wallet: ${ownerAddress}`)
    console.log(`🌐 RPC URL: ${RPC_URL}`)
    console.log(`💵 USDC Address: ${USDC_ADDRESS}`)
    console.log(`💰 Prêmios: 1º=${FIRST_PRIZE / 1e6} USDC, 2º=${SECOND_PRIZE / 1e6} USDC, 3º=${THIRD_PRIZE / 1e6} USDC`)
    console.log("")

    // Read and compile the contract
    console.log("📄 Lendo contrato PrizePool.sol...")
    const contractSource = readFileSync(
      path.join(process.cwd(), "contracts", "PrizePool.sol"),
      "utf-8"
    )

    // For now, we'll use a simple deployment approach
    // In a real scenario, you'd use Hardhat or Foundry to compile
    console.log("⚠️  Nota: Este script requer que o contrato seja compilado primeiro.")
    console.log("⚠️  Use Hardhat ou Foundry para compilar o contrato antes de executar este script.")
    console.log("")
    console.log("📋 Para compilar com Hardhat:")
    console.log("   npx hardhat compile")
    console.log("")
    console.log("📋 Ou use o script de deploy do Hardhat:")
    console.log("   npx hardhat run scripts/deploy-prizepool-hardhat.ts --network arcTestnet")
    console.log("")

    // Check if Hardhat artifacts exist
    const artifactsPath = path.join(process.cwd(), "artifacts", "contracts", "PrizePool.sol", "PrizePool.json")
    let contractArtifact: any = null
    
    try {
      contractArtifact = JSON.parse(readFileSync(artifactsPath, "utf-8"))
      console.log("✅ Contrato compilado encontrado!")
      console.log("")
    } catch (error) {
      console.log("❌ Contrato não compilado. Execute 'npx hardhat compile' primeiro.")
      console.log("")
      console.log("📋 Alternativa: Use o script de deploy do Hardhat diretamente:")
      console.log("   npx hardhat run scripts/deploy-prizepool-hardhat.ts --network arcTestnet")
      process.exit(1)
    }

    // Deploy using the compiled artifact
    console.log("📤 Fazendo deploy do contrato...")
    const factory = new ContractFactory(
      contractArtifact.abi,
      contractArtifact.bytecode,
      ownerWallet
    )

    const contract = await factory.deploy(
      USDC_ADDRESS,
      FIRST_PRIZE,
      SECOND_PRIZE,
      THIRD_PRIZE,
      {
        gasLimit: 3000000, // Adjust if needed
      }
    )

    console.log(`⏳ Aguardando confirmação...`)
    console.log(`   Transaction hash: ${contract.deploymentTransaction()?.hash}`)
    
    await contract.waitForDeployment()
    const contractAddress = await contract.getAddress()

    console.log("")
    console.log("✅ Contrato deployado com sucesso!")
    console.log("")
    console.log("=".repeat(70))
    console.log("📋 INFORMAÇÕES DO DEPLOY")
    console.log("=".repeat(70))
    console.log("")
    console.log(`📍 Endereço do contrato: ${contractAddress}`)
    console.log(`👤 Owner: ${ownerAddress}`)
    console.log(`💵 USDC: ${USDC_ADDRESS}`)
    console.log(`💰 Prêmios:`)
    console.log(`   1º lugar: ${FIRST_PRIZE / 1e6} USDC`)
    console.log(`   2º lugar: ${SECOND_PRIZE / 1e6} USDC`)
    console.log(`   3º lugar: ${THIRD_PRIZE / 1e6} USDC`)
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
    console.log("2. Faça o fund do contrato com USDC (se necessário)")
    console.log("")
    console.log("3. Teste o contrato:")
    console.log(`   npx tsx scripts/test-prizepool.ts ${contractAddress}`)
    console.log("")

  } catch (error: any) {
    console.error("❌ Erro no deploy:", error.message)
    if (error.reason) {
      console.error("   Reason:", error.reason)
    }
    if (error.transaction) {
      console.error("   Transaction:", error.transaction)
    }
    console.error(error)
    process.exit(1)
  }
}

// Import ContractFactory from ethers
import { ContractFactory } from "ethers"

deployNewPrizePool().catch(console.error)



