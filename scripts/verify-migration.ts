import { ethers } from "ethers"

const NEW_CONTRACT = "0x41Afb27763416f555207c9B0bB04F08E665b4AFd"
const RPC = "https://rpc.testnet.arc.network"

const ABI = [
  "function migrationEnabled() view returns (bool)",
  "function CREDIT_PRICE() view returns (uint256)",
  "function CLICK_COST() view returns (uint256)",
]

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC)
  const contract = new ethers.Contract(NEW_CONTRACT, ABI, provider)

  console.log("🔍 Verificando novo contrato GameCredits com migração...")
  console.log("📍 Endereço:", NEW_CONTRACT)
  console.log("🌐 RPC:", RPC, "\n")

  try {
    const migrationEnabled = await contract.migrationEnabled()
    console.log("🔓 migrationEnabled:", migrationEnabled ? "✅ ATIVADO" : "❌ DESATIVADO")

    const creditPrice = await contract.CREDIT_PRICE()
    const creditPriceNum = Number(creditPrice)
    const creditPriceUSDC = creditPriceNum / 1_000_000

    console.log("\n💰 CREDIT_PRICE:")
    console.log(`   Raw: ${creditPriceNum}`)
    console.log(`   USDC: ${creditPriceUSDC} USDC`)
    console.log(`   Esperado: 5000 (0.005 USDC)`)
    console.log(`   ${creditPriceNum === 5000 ? "✅ CORRETO" : "❌ INCORRETO"}`)

    const clickCost = await contract.CLICK_COST()
    const clickCostNum = Number(clickCost)
    const clickCostUSDC = clickCostNum / 1_000_000

    console.log("\n🖱️ CLICK_COST:")
    console.log(`   Raw: ${clickCostNum}`)
    console.log(`   USDC: ${clickCostUSDC} USDC`)
    console.log(`   Esperado: 5000 (0.005 USDC)`)
    console.log(`   ${clickCostNum === 5000 ? "✅ CORRETO" : "❌ INCORRETO"}`)

    if (migrationEnabled && creditPriceNum === 5000 && clickCostNum === 5000) {
      console.log("\n✅ Contrato configurado corretamente com migração ativada!")
    } else {
      console.log("\n❌ Contrato NÃO está configurado corretamente!")
    }
  } catch (error: any) {
    console.error("❌ Erro:", error.message)
  }
}

main()

