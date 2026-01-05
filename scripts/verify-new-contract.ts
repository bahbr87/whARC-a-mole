import { ethers } from "ethers"

const NEW_CONTRACT = "0x548eE0ACBF88fBc5f30CFD4Ee1324282EAf9814D"
const RPC = "https://rpc.testnet.arc.network"

const ABI = [
  "function CREDIT_PRICE() view returns (uint256)",
  "function CLICK_COST() view returns (uint256)",
  "function calculatePurchaseCost(uint256 creditAmount) view returns (uint256)",
]

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC)
  const contract = new ethers.Contract(NEW_CONTRACT, ABI, provider)

  console.log("🔍 Verificando novo contrato GameCredits...")
  console.log("📍 Endereço:", NEW_CONTRACT)
  console.log("🌐 RPC:", RPC, "\n")

  try {
    const creditPrice = await contract.CREDIT_PRICE()
    const creditPriceNum = Number(creditPrice)
    const creditPriceUSDC = creditPriceNum / 1_000_000

    console.log("💰 CREDIT_PRICE:")
    console.log(`   Raw: ${creditPriceNum}`)
    console.log(`   USDC: ${creditPriceUSDC} USDC`)
    console.log(`   Esperado: 5000 (0.005 USDC)`)
    console.log(`   ${creditPriceNum === 5000 ? "✅ CORRETO" : "❌ INCORRETO"}\n`)

    const clickCost = await contract.CLICK_COST()
    const clickCostNum = Number(clickCost)
    const clickCostUSDC = clickCostNum / 1_000_000

    console.log("🖱️ CLICK_COST:")
    console.log(`   Raw: ${clickCostNum}`)
    console.log(`   USDC: ${clickCostUSDC} USDC`)
    console.log(`   Esperado: 5000 (0.005 USDC)`)
    console.log(`   ${clickCostNum === 5000 ? "✅ CORRETO" : "❌ INCORRETO"}\n`)

    // Test calculatePurchaseCost
    console.log("🧮 Testando calculatePurchaseCost:")
    const testAmounts = [1, 100, 1000, 5000]
    for (const amount of testAmounts) {
      const cost = await contract.calculatePurchaseCost(amount)
      const costNum = Number(cost)
      const costUSDC = costNum / 1_000_000
      const expected = amount * 0.005
      console.log(`   ${amount} créditos: ${costUSDC} USDC (esperado: ${expected} USDC) ${costUSDC === expected ? "✅" : "❌"}`)
    }

    if (creditPriceNum === 5000 && clickCostNum === 5000) {
      console.log("\n✅ Contrato configurado corretamente!")
    } else {
      console.log("\n❌ Contrato NÃO está configurado corretamente!")
    }
  } catch (error: any) {
    console.error("❌ Erro:", error.message)
  }
}

main()

