import "dotenv/config"
import { ethers } from "ethers"
import * as fs from "fs"
import * as path from "path"

const RPC_URL = process.env.ARC_RPC_URL || "https://rpc.testnet.arc.network"
const DEPLOYER_ADDRESS = process.env.DEPLOYER_PRIVATE_KEY 
  ? new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY).address 
  : "0xA6338636D92e024dBC3541524E332F68c5c811a2"

const PRIZE_POOL_ABI = [
  "function usdc() view returns (address)",
  "function owner() view returns (address)",
  "function FIRST_PRIZE() view returns (uint256)",
  "function SECOND_PRIZE() view returns (uint256)",
  "function THIRD_PRIZE() view returns (uint256)",
]

async function verifyContract(address: string, provider: ethers.Provider) {
  try {
    const contract = new ethers.Contract(address, PRIZE_POOL_ABI, provider)
    
    const usdc = await contract.usdc()
    const owner = await contract.owner()
    const firstPrize = await contract.FIRST_PRIZE()
    const secondPrize = await contract.SECOND_PRIZE()
    const thirdPrize = await contract.THIRD_PRIZE()
    
    return {
      valid: true,
      usdc,
      owner,
      firstPrize: ethers.formatUnits(firstPrize, 6),
      secondPrize: ethers.formatUnits(secondPrize, 6),
      thirdPrize: ethers.formatUnits(thirdPrize, 6),
    }
  } catch (error: any) {
    return {
      valid: false,
      error: error.message,
    }
  }
}

async function main() {
  console.log("🔍 Verificando se o PrizePool foi deployado...")
  console.log("👤 Deployer:", DEPLOYER_ADDRESS)
  console.log("🌐 RPC:", RPC_URL)
  console.log()

  const provider = new ethers.JsonRpcProvider(RPC_URL)

  // 1. Verificar arquivos de deploy
  console.log("📁 Verificando arquivos de deploy...")
  const deploymentFiles = [
    path.join(process.cwd(), "deployments", "prizepool-real-usdc.json"),
    path.join(process.cwd(), "deployment.json"),
  ]

  const addresses: string[] = []

  for (const file of deploymentFiles) {
    if (fs.existsSync(file)) {
      try {
        const content = JSON.parse(fs.readFileSync(file, "utf8"))
        const address = content.address || content.PrizePool || content.contracts?.prizePool
        if (address && ethers.isAddress(address)) {
          addresses.push(address)
          console.log(`✅ Endereço encontrado em ${path.basename(file)}: ${address}`)
        }
      } catch (error) {
        // Ignorar erros de parsing
      }
    }
  }

  // 2. Verificar .env.local
  const envPath = path.join(process.cwd(), ".env.local")
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf8")
    const matches = envContent.match(/NEXT_PUBLIC_PRIZE_POOL_CONTRACT_ADDRESS=(0x[a-fA-F0-9]{40})/g)
    if (matches) {
      matches.forEach(match => {
        const address = match.split("=")[1]
        if (!addresses.includes(address)) {
          addresses.push(address)
          console.log(`✅ Endereço encontrado no .env.local: ${address}`)
        }
      })
    }
  }

  if (addresses.length === 0) {
    console.log("❌ Nenhum endereço de PrizePool encontrado em arquivos locais")
    console.log("\n💡 Para fazer deploy:")
    console.log("   npm run deploy-prizepool-real-usdc")
    return
  }

  // 3. Verificar contratos on-chain
  console.log("\n🔍 Verificando contratos on-chain...")
  for (const address of addresses) {
    console.log(`\n📍 Verificando: ${address}`)
    
    // Verificar se é um contrato
    const code = await provider.getCode(address)
    if (code === "0x") {
      console.log("   ❌ Não é um contrato (sem código)")
      continue
    }

    // Verificar se é o PrizePool
    const verification = await verifyContract(address, provider)
    if (verification.valid) {
      console.log("   ✅ É um PrizePool válido!")
      console.log(`   🪙 USDC: ${verification.usdc}`)
      console.log(`   👤 Owner: ${verification.owner}`)
      console.log(`   🏆 Prêmios: ${verification.firstPrize} / ${verification.secondPrize} / ${verification.thirdPrize} USDC`)
      console.log(`   🔗 Explorer: https://testnet.arcscan.app/address/${address}`)
    } else {
      console.log(`   ⚠️ Contrato existe mas não é um PrizePool válido`)
      console.log(`   Erro: ${verification.error}`)
    }
  }
}

main().catch(console.error)




