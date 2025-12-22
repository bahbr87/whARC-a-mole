import { ethers } from "ethers"
import "dotenv/config"

// Quando executado via 'npx hardhat run', o hre é injetado automaticamente
// Para usar diretamente com tsx, precisamos importar hardhat
declare const hre: any

const USDC_REAL = process.env.USDC_ADDRESS || process.env.MOCK_USDC_ADDRESS || "0x37225a0bC4bc9f2dAA06F535E7B8BC7AB03636c4"

async function main() {
  // Usar Hardhat se disponível (quando executado via 'npx hardhat run')
  let factory
  let wallet
  
  if (typeof hre !== "undefined" && hre.ethers) {
    // Executado via Hardhat
    const [deployer] = await hre.ethers.getSigners()
    wallet = deployer
    factory = await hre.ethers.getContractFactory("PrizePool", deployer)
    console.log("🚀 Deployando PrizePool com USDC REAL (via Hardhat)")
  } else {
    // Executado via tsx - usar ethers diretamente
    const RPC_URL = process.env.ARC_RPC_URL!
    const OWNER_PRIVATE_KEY = process.env.OWNER_PRIVATE_KEY!
    
    if (!RPC_URL || !OWNER_PRIVATE_KEY) {
      throw new Error("❌ ARC_RPC_URL e OWNER_PRIVATE_KEY devem estar configurados, ou execute via 'npx hardhat run'")
    }
    
    const provider = new ethers.JsonRpcProvider(RPC_URL)
    wallet = new ethers.Wallet(OWNER_PRIVATE_KEY, provider)
    
    // Tentar importar Hardhat para usar getContractFactory
    try {
      const hardhat = await import("hardhat")
      factory = await hardhat.default.ethers.getContractFactory("PrizePool", wallet)
      console.log("🚀 Deployando PrizePool com USDC REAL (via Hardhat import)")
    } catch (error) {
      throw new Error("❌ Hardhat não disponível. Execute 'npx hardhat compile' primeiro ou use 'npx hardhat run scripts/deploy-prizepool-real-usdc.ts --network arc'")
    }
  }

  console.log("🪙 USDC:", USDC_REAL)
  console.log("👤 Owner:", wallet.address)
  console.log()

  const contract = await factory.deploy(USDC_REAL)
  console.log("📤 TX enviada:", contract.deploymentTransaction()?.hash)
  console.log("⏳ Aguardando confirmação...")

  await contract.waitForDeployment()

  const address = await contract.getAddress()
  console.log("\n✅ PrizePool DEPLOYADO!")
  console.log("📍 Endereço:", address)
  console.log("🔗 Explorer:", `https://testnet.arcscan.app/address/${address}`)

  // Verificar deploy
  const usdcAddress = await contract.usdc()
  const owner = await contract.owner()
  console.log("\n🔍 Verificação:")
  console.log("   USDC:", usdcAddress)
  console.log("   Owner:", owner)
}

main().catch(console.error)
