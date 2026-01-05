import "dotenv/config"
import { ethers } from "ethers"

const RPC = process.env.ARC_RPC_URL || "https://rpc.testnet.arc.network"
const USDC_ADDRESS = "0x37225a0bC4bc9f2dAA06F535E7B8BC7AB03636c4"

const USDC_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address account) view returns (uint256)",
]

async function main() {
  const walletAddress = process.argv[2] || "0x56e623940C9d3CaeF6098E080EEe712081F0F4e1"
  
  console.log("🔍 Verificando saldo da carteira...")
  console.log("📍 Endereço:", walletAddress)
  console.log("🌐 RPC:", RPC, "\n")

  const provider = new ethers.JsonRpcProvider(RPC)
  
  // Verificar saldo de USDC
  const usdc = new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider)
  
  const name = await usdc.name()
  const symbol = await usdc.symbol()
  const decimals = await usdc.decimals()
  
  const usdcBalance = await usdc.balanceOf(walletAddress)
  const usdcBalanceFormatted = ethers.formatUnits(usdcBalance, decimals)
  
  console.log("💰 Saldo de USDC:")
  console.log(`   ${usdcBalanceFormatted} ${symbol}`)
  console.log(`   (${usdcBalance.toString()} na menor unidade)`)
  
  // Verificar saldo nativo (na Arc Network, o saldo nativo é USDC)
  try {
    const nativeBalance = await provider.getBalance(walletAddress)
    // Na Arc Network, o saldo nativo retorna em wei (18 decimais), mas representa USDC
    // Para converter para USDC (6 decimais), dividimos por 10^12 (18-6=12)
    const usdcBalance = nativeBalance / BigInt(10 ** 12)
    const nativeBalanceFormatted = ethers.formatUnits(usdcBalance, 6)
    console.log("\n💎 Saldo nativo (USDC na Arc Network):")
    console.log(`   ${nativeBalanceFormatted} USDC`)
    console.log(`   (Saldo raw: ${nativeBalance.toString()})`)
  } catch (error) {
    // Ignorar se não houver saldo nativo
  }
  
  console.log("\n🔗 Ver no explorer:")
  console.log(`   https://testnet.arcscan.app/address/${walletAddress}`)
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
