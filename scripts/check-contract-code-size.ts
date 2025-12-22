import { JsonRpcProvider } from "ethers"
import dotenv from "dotenv"
import path from "path"

dotenv.config({ path: path.join(process.cwd(), ".env.local") })

const RPC_URL = process.env.RPC_URL || "https://rpc.testnet.arc.network"
const PRIZE_POOL_ADDRESS = process.env.NEXT_PUBLIC_PRIZE_POOL_CONTRACT_ADDRESS || "0xeA0df70040E77a821b14770E53aa577A745930ae"

async function checkContractCodeSize() {
  try {
    const provider = new JsonRpcProvider(RPC_URL)
    const code = await provider.getCode(PRIZE_POOL_ADDRESS)
    
    console.log("=".repeat(70))
    console.log("📋 VERIFICANDO CÓDIGO DO CONTRATO")
    console.log("=".repeat(70))
    console.log("")
    console.log(`📍 Endereço: ${PRIZE_POOL_ADDRESS}`)
    console.log(`📏 Tamanho do código: ${code.length} caracteres`)
    console.log(`📦 Tamanho em bytes: ${code.length / 2 - 1} bytes (aprox.)`)
    console.log("")
    
    if (code === "0x" || code === "0x0" || code.length <= 2) {
      console.log("❌ Nenhum código encontrado neste endereço")
      console.log("   O contrato pode não estar deployado ou o endereço está incorreto")
    } else {
      console.log("✅ Contrato encontrado e tem código")
      console.log("")
      console.log("📄 Primeiros 100 caracteres do código:")
      console.log(code.substring(0, 100) + "...")
    }
    
    console.log("")
    console.log("=".repeat(70))
  } catch (error: any) {
    console.error("❌ Erro:", error.message)
    process.exit(1)
  }
}

checkContractCodeSize().catch(console.error)



