import "dotenv/config"
import { ethers } from "ethers"

const RPC = process.env.ARC_RPC_URL || "https://rpc.testnet.arc.network"

const GAME_CREDITS_ABI = [
  "function CREDIT_PRICE() external pure returns (uint256)",
  "function CLICK_COST() external pure returns (uint256)",
  "function usdcToken() external view returns (address)",
]

// Lista de endereços possíveis do GameCredits
const POSSIBLE_ADDRESSES = [
  process.env.NEXT_PUBLIC_GAME_CREDITS_ADDRESS,
  process.env.GAME_CREDITS_ADDRESS,
  "0xB6EF59882778d0A245202F1482f20f02ad82bd87", // Do deployment.json
  "0x4E5a96685a186B84a2E47Dc6f507dD18c2Ac99aC", // MetaTransactionProcessor (pode ter referência)
].filter(Boolean) as string[]

async function checkContract(address: string, provider: ethers.Provider): Promise<{
  isValid: boolean
  creditPrice: number
  clickCost: number
  usdcToken: string
  isCorrectPrice: boolean
} | null> {
  try {
    const contract = new ethers.Contract(address, GAME_CREDITS_ABI, provider)
    
    // Verificar se é um contrato GameCredits válido
    const creditPriceRaw = await contract.CREDIT_PRICE()
    const clickCostRaw = await contract.CLICK_COST()
    const usdcToken = await contract.usdcToken()
    
    const creditPrice = Number(creditPriceRaw)
    const clickCost = Number(clickCostRaw)
    const creditPriceUSDC = creditPrice / 1_000_000
    
    return {
      isValid: true,
      creditPrice,
      clickCost,
      usdcToken,
      isCorrectPrice: creditPrice === 5000,
    }
  } catch (error) {
    return null
  }
}

async function main() {
  console.log("🔍 Procurando contratos GameCredits deployados...")
  console.log("🌐 RPC:", RPC, "\n")

  const provider = new ethers.JsonRpcProvider(RPC)
  
  const results: Array<{
    address: string
    isValid: boolean
    creditPrice: number
    clickCost: number
    usdcToken: string
    isCorrectPrice: boolean
  }> = []

  // Verificar endereços conhecidos
  console.log("📋 Verificando endereços conhecidos...")
  for (const address of POSSIBLE_ADDRESSES) {
    console.log(`\n   Verificando: ${address}`)
    const result = await checkContract(address, provider)
    if (result) {
      results.push({ address, ...result })
      console.log(`   ✅ É um contrato GameCredits válido!`)
      console.log(`      CREDIT_PRICE: ${result.creditPrice} (${result.creditPrice / 1_000_000} USDC)`)
      console.log(`      CLICK_COST: ${result.clickCost} (${result.clickCost / 1_000_000} USDC)`)
      console.log(`      USDC Token: ${result.usdcToken}`)
      console.log(`      Preço correto (0.005 USDC)? ${result.isCorrectPrice ? "✅ SIM" : "❌ NÃO"}`)
    } else {
      console.log(`   ❌ Não é um contrato GameCredits válido ou não responde`)
    }
  }

  // Resumo
  console.log("\n" + "=".repeat(60))
  console.log("📊 RESUMO")
  console.log("=".repeat(60))
  
  if (results.length === 0) {
    console.log("❌ Nenhum contrato GameCredits válido encontrado nos endereços conhecidos")
  } else {
    const correctPriceContracts = results.filter(r => r.isCorrectPrice)
    const wrongPriceContracts = results.filter(r => !r.isCorrectPrice)
    
    if (correctPriceContracts.length > 0) {
      console.log("\n✅ Contratos com preço CORRETO (0.005 USDC):")
      correctPriceContracts.forEach(r => {
        console.log(`   ${r.address}`)
        console.log(`   Explorer: https://testnet.arcscan.app/address/${r.address}`)
      })
    }
    
    if (wrongPriceContracts.length > 0) {
      console.log("\n❌ Contratos com preço INCORRETO:")
      wrongPriceContracts.forEach(r => {
        console.log(`   ${r.address} - Preço: ${r.creditPrice / 1_000_000} USDC (esperado: 0.005 USDC)`)
      })
    }
  }
  
  console.log("\n" + "=".repeat(60))
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

