import { ethers } from "hardhat"
import dotenv from "dotenv"
import path from "path"

dotenv.config({ path: path.join(process.cwd(), ".env.local") })

const USDC_ADDRESS = "0x3600000000000000000000000000000000000000" // Official Arc Testnet USDC

// Prize amounts in USDC (6 decimals)
const FIRST_PRIZE = ethers.parseUnits("20", 6)  // 20 USDC
const SECOND_PRIZE = ethers.parseUnits("10", 6) // 10 USDC
const THIRD_PRIZE = ethers.parseUnits("5", 6)   // 5 USDC

async function main() {
  console.log("=".repeat(70))
  console.log("🚀 DEPLOY DO NOVO PRIZEPOOL (HARDHAT)")
  console.log("=".repeat(70))
  console.log("")

  const [deployer] = await ethers.getSigners()
  const deployerAddress = await deployer.getAddress()

  console.log(`👤 Deployer: ${deployerAddress}`)
  console.log(`💵 USDC Address: ${USDC_ADDRESS}`)
  console.log(`💰 Prêmios:`)
  console.log(`   1º lugar: ${ethers.formatUnits(FIRST_PRIZE, 6)} USDC`)
  console.log(`   2º lugar: ${ethers.formatUnits(SECOND_PRIZE, 6)} USDC`)
  console.log(`   3º lugar: ${ethers.formatUnits(THIRD_PRIZE, 6)} USDC`)
  console.log("")

  // Get balance
  const balance = await ethers.provider.getBalance(deployerAddress)
  console.log(`💰 Saldo do deployer: ${ethers.formatEther(balance)} ETH`)
  console.log("")

  // Deploy PrizePool
  console.log("📤 Fazendo deploy do PrizePool...")
  const PrizePool = await ethers.getContractFactory("PrizePool")
  const prizePool = await PrizePool.deploy(
    USDC_ADDRESS,
    FIRST_PRIZE,
    SECOND_PRIZE,
    THIRD_PRIZE
  )

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
  console.log(`👤 Owner: ${deployerAddress}`)
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
  console.log("2. Faça o fund do contrato com USDC (se necessário)")
  console.log("")
  console.log("3. Verifique o owner do contrato:")
  console.log(`   npx tsx scripts/verify-prizepool-owner.ts ${contractAddress}`)
  console.log("")
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })



