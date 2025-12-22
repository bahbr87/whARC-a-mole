import { JsonRpcProvider, Contract } from "ethers"
import dotenv from "dotenv"
import path from "path"

dotenv.config({ path: path.join(process.cwd(), ".env.local") })

const RPC_URL = process.env.RPC_URL || "https://rpc.testnet.arc.network"
const PRIZE_POOL_OLD_ADDRESS = "0xeA0df70040E77a821b14770E53aa577A745930ae"
const USDC_ADDRESS = "0x3600000000000000000000000000000000000000" // USDC oficial Arc Testnet

// USDC ABI
const USDC_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
]

async function checkOldPrizePoolBalance() {
  console.log("=".repeat(70))
  console.log("💰 VERIFICANDO SALDO USDC NO CONTRATO ANTIGO")
  console.log("=".repeat(70))
  console.log("")
  console.log(`📍 Endereço do contrato: ${PRIZE_POOL_OLD_ADDRESS}`)
  console.log(`💵 Endereço do USDC: ${USDC_ADDRESS}`)
  console.log("")

  try {
    const provider = new JsonRpcProvider(RPC_URL)
    
    // Criar contrato USDC
    const usdc = new Contract(USDC_ADDRESS, USDC_ABI, provider)
    
    // Obter informações do USDC
    const decimals = await usdc.decimals()
    const symbol = await usdc.symbol()
    
    console.log(`📊 Informações do USDC:`)
    console.log(`   Símbolo: ${symbol}`)
    console.log(`   Decimais: ${decimals}`)
    console.log("")

    // Obter saldo
    const balanceRaw = await usdc.balanceOf(PRIZE_POOL_OLD_ADDRESS)
    const balance = Number(balanceRaw) / Number(10n ** BigInt(decimals))
    
    console.log(`💰 Saldo USDC no contrato:`)
    console.log(`   Raw: ${balanceRaw.toString()}`)
    console.log(`   Formatado: ${balance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 6 })} ${symbol}`)
    console.log("")

    if (balance > 0) {
      console.log("✅ Contrato possui saldo USDC")
      console.log(`   Valor: ${balance} ${symbol}`)
    } else {
      console.log("⚠️ Contrato não possui saldo USDC")
    }

    console.log("")
    console.log("=".repeat(70))
  } catch (error: any) {
    console.error("❌ Erro:", error.message)
    console.error(error)
    process.exit(1)
  }
}

checkOldPrizePoolBalance().catch(console.error)

