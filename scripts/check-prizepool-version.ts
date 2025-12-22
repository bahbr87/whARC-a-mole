import "dotenv/config"
import { ethers } from "ethers"

const RPC_URL = process.env.ARC_RPC_URL || "https://rpc.testnet.arc.network"
const PRIZE_POOL_ADDRESS = "0xB98b8A9213072903277B9f592009E7C22acd2dd3"

async function main() {
  console.log("🔍 Verificando versão do PrizePool...")
  console.log("📍 Endereço:", PRIZE_POOL_ADDRESS)
  console.log("🌐 RPC:", RPC_URL)
  console.log()

  const provider = new ethers.JsonRpcProvider(RPC_URL)

  // Verificar se o contrato existe
  const code = await provider.getCode(PRIZE_POOL_ADDRESS)
  if (code === "0x") {
    console.log("❌ Contrato não existe neste endereço")
    return
  }

  console.log("✅ Contrato existe (tem código)")

  // Tentar diferentes versões do ABI
  const abis = {
    "Nova versão (usdc)": [
      "function usdc() view returns (address)",
      "function owner() view returns (address)",
    ],
    "Versão antiga (usdcToken)": [
      "function usdcToken() view returns (address)",
      "function owner() view returns (address)",
    ],
  }

  for (const [version, abi] of Object.entries(abis)) {
    try {
      const contract = new ethers.Contract(PRIZE_POOL_ADDRESS, abi, provider)
      const usdc = await contract.usdc ? await contract.usdc() : await contract.usdcToken()
      const owner = await contract.owner()
      
      console.log(`\n✅ ${version}:`)
      console.log(`   USDC: ${usdc}`)
      console.log(`   Owner: ${owner}`)
      console.log(`   🔗 Explorer: https://testnet.arcscan.app/address/${PRIZE_POOL_ADDRESS}`)
      return
    } catch (error: any) {
      // Continuar tentando
    }
  }

  console.log("\n⚠️ Não foi possível identificar a versão do contrato")
  console.log("   O contrato pode ser uma versão diferente ou ter problemas")
  console.log(`   🔗 Verifique no explorer: https://testnet.arcscan.app/address/${PRIZE_POOL_ADDRESS}`)
}

main().catch(console.error)




