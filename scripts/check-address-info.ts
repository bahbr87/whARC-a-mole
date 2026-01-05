import "dotenv/config"
import { ethers } from "ethers"

const RPC = process.env.ARC_RPC_URL || "https://rpc.testnet.arc.network"
const USDC_ADDRESS = "0x37225a0bC4bc9f2dAA06F535E7B8BC7AB03636c4"

// Normalizar endereço (adicionar 0x se não tiver)
function normalizeAddress(address: string): string {
  if (address.startsWith("0x")) {
    return address.toLowerCase()
  }
  return `0x${address.toLowerCase()}`
}

const USDC_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address account) view returns (uint256)",
]

async function main() {
  const address = normalizeAddress(process.argv[2] || "7a6711b442072d397b06d4b5c2f7e63fc6337230")
  
  console.log("🔍 Verificando informações do endereço...")
  console.log("📍 Endereço:", address)
  console.log("🌐 RPC:", RPC, "\n")

  const provider = new ethers.JsonRpcProvider(RPC)
  
  try {
    // Verificar se é um contrato ou uma carteira
    const code = await provider.getCode(address)
    const isContract = code !== "0x"
    
    console.log("📋 Tipo:")
    console.log(`   ${isContract ? "✅ Contrato" : "👤 Carteira"}`)
    
    // Verificar saldo nativo (USDC na Arc Network)
    const nativeBalance = await provider.getBalance(address)
    const nativeBalanceUSDC = Number(nativeBalance) / 1_000_000_000_000_000_000 // 18 decimais para USDC nativo
    console.log("\n💎 Saldo nativo (USDC na Arc Network):")
    console.log(`   ${nativeBalanceUSDC.toFixed(6)} USDC`)
    console.log(`   (${nativeBalance.toString()} na menor unidade)`)
    
    // Verificar saldo de USDC token
    const usdc = new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider)
    const usdcBalance = await usdc.balanceOf(address)
    const decimals = await usdc.decimals()
    const symbol = await usdc.symbol()
    const usdcBalanceFormatted = ethers.formatUnits(usdcBalance, decimals)
    
    console.log(`\n💰 Saldo de ${symbol} (token):`)
    console.log(`   ${usdcBalanceFormatted} ${symbol}`)
    console.log(`   (${usdcBalance.toString()} na menor unidade)`)
    
    // Se for contrato, tentar identificar qual tipo
    if (isContract) {
      console.log("\n📄 Informações do contrato:")
      console.log("   Código do contrato presente (não é uma carteira)")
      
      // Tentar verificar se é GameCredits
      try {
        const GAME_CREDITS_ABI = [
          "function CREDIT_PRICE() external pure returns (uint256)",
          "function usdcToken() external view returns (address)",
        ]
        const contract = new ethers.Contract(address, GAME_CREDITS_ABI, provider)
        const creditPrice = await contract.CREDIT_PRICE()
        const usdcToken = await contract.usdcToken()
        console.log("   ✅ É um contrato GameCredits!")
        console.log(`   CREDIT_PRICE: ${creditPrice.toString()} (${Number(creditPrice) / 1_000_000} USDC)`)
        console.log(`   USDC Token: ${usdcToken}`)
      } catch (e) {
        // Não é GameCredits, tentar PrizePool
        try {
          const PRIZE_POOL_ABI = [
            "function usdc() external view returns (address)",
            "function prizes(uint256) external view returns (uint256)",
          ]
          const contract = new ethers.Contract(address, PRIZE_POOL_ABI, provider)
          const usdcAddr = await contract.usdc()
          console.log("   ✅ É um contrato PrizePool!")
          console.log(`   USDC: ${usdcAddr}`)
        } catch (e2) {
          console.log("   Tipo de contrato desconhecido")
        }
      }
    }
    
    // Verificar transações recentes (últimos blocos)
    try {
      const currentBlock = await provider.getBlockNumber()
      console.log(`\n📊 Bloco atual: ${currentBlock}`)
    } catch (e) {
      // Ignorar erro
    }
    
  } catch (error: any) {
    console.error("❌ Erro ao verificar endereço:", error.message)
    process.exit(1)
  }
  
  console.log("\n🔗 Ver no explorer:")
  console.log(`   https://testnet.arcscan.app/address/${address}`)
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

