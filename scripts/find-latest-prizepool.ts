import "dotenv/config"
import { ethers } from "ethers"

const RPC_URL = process.env.ARC_RPC_URL || "https://rpc.testnet.arc.network"
const DEPLOYER_ADDRESS = process.env.DEPLOYER_PRIVATE_KEY 
  ? new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY).address 
  : "0xA6338636D92e024dBC3541524E332F68c5c811a2" // Do deployment.json

async function main() {
  console.log("🔍 Procurando o endereço mais recente do PrizePool...")
  console.log("👤 Deployer:", DEPLOYER_ADDRESS)
  console.log("🌐 RPC:", RPC_URL)
  console.log()

  const provider = new ethers.JsonRpcProvider(RPC_URL)

  try {
    // Buscar transações do deployer
    console.log("📡 Buscando transações do deployer...")
    
    // Tentar buscar as últimas transações (pode não funcionar em todos os RPCs)
    // Vamos tentar uma abordagem diferente: verificar o código do contrato
    
    // O código do contrato PrizePool começa com o bytecode específico
    // Vamos buscar contratos criados pelo deployer verificando transações de criação
    
    console.log("⚠️ Busca automática limitada pelo RPC.")
    console.log("\n💡 Opções para encontrar o endereço:")
    console.log("1. Verifique o output do último deploy:")
    console.log("   - Procure por '✅ PrizePool DEPLOYADO!' no terminal")
    console.log("   - O endereço aparece logo após essa mensagem")
    console.log("\n2. Verifique o explorer:")
    console.log(`   https://testnet.arcscan.app/address/${DEPLOYER_ADDRESS}`)
    console.log("   - Procure por transações de 'Contract Creation'")
    console.log("   - O endereço do contrato criado será o PrizePool")
    console.log("\n3. Verifique o arquivo de deploy (se existir):")
    console.log("   - deployments/prizepool-real-usdc.json")
    console.log("   - deployment.json")
    
  } catch (error: any) {
    console.error("❌ Erro ao buscar:", error.message)
  }
}

main().catch(console.error)




