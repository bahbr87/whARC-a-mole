import "dotenv/config"
import { ethers } from "ethers"

const RPC = process.env.ARC_RPC_URL || "https://rpc.testnet.arc.network"
const GAME_CREDITS_ADDRESS = process.env.NEXT_PUBLIC_GAME_CREDITS_ADDRESS || process.env.GAME_CREDITS_ADDRESS || "0xB6EF59882778d0A245202F1482f20f02ad82bd87"

const GAME_CREDITS_ABI = [
  "function CREDIT_PRICE() external pure returns (uint256)",
  "function CLICK_COST() external pure returns (uint256)",
  "function calculatePurchaseCost(uint256 creditAmount) external pure returns (uint256)",
]

async function main() {
  if (GAME_CREDITS_ADDRESS === "0x0000000000000000000000000000000000000000") {
    console.error("❌ GAME_CREDITS_ADDRESS not configured")
    process.exit(1)
  }

  console.log("🔍 Verificando preço de créditos no contrato...")
  console.log("📍 Endereço do contrato:", GAME_CREDITS_ADDRESS)
  console.log("🌐 RPC:", RPC, "\n")

  const provider = new ethers.JsonRpcProvider(RPC)
  const contract = new ethers.Contract(GAME_CREDITS_ADDRESS, GAME_CREDITS_ABI, provider)

  try {
    // Verificar CREDIT_PRICE
    const creditPriceRaw = await contract.CREDIT_PRICE()
    const creditPrice = Number(creditPriceRaw)
    const creditPriceUSDC = creditPrice / 1_000_000 // USDC tem 6 decimais
    
    console.log("💰 CREDIT_PRICE no contrato:")
    console.log(`   Valor raw: ${creditPrice}`)
    console.log(`   Valor em USDC: ${creditPriceUSDC} USDC`)
    console.log(`   Esperado: 0.005 USDC (5000 raw)\n`)

    // Verificar CLICK_COST
    const clickCostRaw = await contract.CLICK_COST()
    const clickCost = Number(clickCostRaw)
    const clickCostUSDC = clickCost / 1_000_000
    
    console.log("🖱️ CLICK_COST no contrato:")
    console.log(`   Valor raw: ${clickCost}`)
    console.log(`   Valor em USDC: ${clickCostUSDC} USDC`)
    console.log(`   Esperado: 0.005 USDC (5000 raw)\n`)

    // Testar calculatePurchaseCost para diferentes quantidades
    console.log("🧮 Testando calculatePurchaseCost:")
    const testAmounts = [1, 100, 1000, 5000]
    
    for (const amount of testAmounts) {
      const costRaw = await contract.calculatePurchaseCost(amount)
      const cost = Number(costRaw)
      const costUSDC = cost / 1_000_000
      const expectedCost = amount * 0.005
      
      console.log(`   ${amount} créditos:`)
      console.log(`      Custo calculado: ${costUSDC} USDC (${cost} raw)`)
      console.log(`      Custo esperado: ${expectedCost} USDC`)
      console.log(`      ✅ ${costUSDC === expectedCost ? "CORRETO" : "❌ INCORRETO"}`)
    }

    // Verificar se está correto
    if (creditPrice === 5000) {
      console.log("\n✅ O preço está configurado corretamente no contrato!")
    } else {
      console.log("\n❌ O preço NÃO está configurado corretamente no contrato!")
      console.log(`   Esperado: 5000 (0.005 USDC)`)
      console.log(`   Encontrado: ${creditPrice} (${creditPriceUSDC} USDC)`)
      console.log("\n⚠️  O contrato precisa ser atualizado ou redeployado com CREDIT_PRICE = 5000")
    }

  } catch (error: any) {
    console.error("❌ Erro ao verificar contrato:", error.message)
    if (error.message.includes("not deployed")) {
      console.error("   O contrato pode não estar deployado neste endereço")
    }
    process.exit(1)
  }
}

main()
  .then(() => {
    console.log("\n✅ Verificação concluída!")
    process.exit(0)
  })
  .catch((error) => {
    console.error("❌ Erro:", error)
    process.exit(1)
  })

