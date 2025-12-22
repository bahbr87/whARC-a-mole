import "dotenv/config"
import { ethers } from "ethers"

/**
 * CONFIG
 */
const RPC_URL = process.env.ARC_RPC_URL!
const PRIVATE_KEY = process.env.OWNER_PRIVATE_KEY!
const MOCK_USDC_ADDRESS = process.env.MOCK_USDC_ADDRESS!
const PRIZE_POOL_ADDRESS = process.env.NEXT_PUBLIC_PRIZE_POOL_CONTRACT_ADDRESS!

// 1,000,000 USDC (6 decimals)
const AMOUNT_USDC = ethers.parseUnits("1000000", 6)

if (!RPC_URL || !PRIVATE_KEY || !MOCK_USDC_ADDRESS || !PRIZE_POOL_ADDRESS) {
  throw new Error("❌ Variáveis de ambiente faltando no .env.local")
}

/**
 * Minimal ABI
 */
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
]

async function main() {
  console.log("🔌 Conectando à Arc Network...")
  const provider = new ethers.JsonRpcProvider(RPC_URL)
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider)

  console.log("👤 Wallet:", wallet.address)

  const usdc = new ethers.Contract(MOCK_USDC_ADDRESS, ERC20_ABI, wallet)

  const symbol = await usdc.symbol()
  const decimals = await usdc.decimals()

  console.log(`🪙 Token: ${symbol} (${decimals} decimals)`)

  const ownerBalance = await usdc.balanceOf(wallet.address)
  console.log("💰 Saldo do owner:", ethers.formatUnits(ownerBalance, decimals))

  if (ownerBalance < AMOUNT_USDC) {
    throw new Error(
      `❌ Saldo insuficiente! Owner tem ${ethers.formatUnits(ownerBalance, decimals)} ${symbol}, precisa de ${ethers.formatUnits(AMOUNT_USDC, decimals)} ${symbol}`
    )
  }

  // Verificar saldo atual do PrizePool
  const prizePoolBalance = await usdc.balanceOf(PRIZE_POOL_ADDRESS)
  console.log("🏆 Saldo atual do PrizePool:", ethers.formatUnits(prizePoolBalance, decimals))

  console.log(`\n📤 Transferindo ${ethers.formatUnits(AMOUNT_USDC, decimals)} ${symbol} para PrizePool...`)

  // Transferir USDC para PrizePool
  const tx = await usdc.transfer(PRIZE_POOL_ADDRESS, AMOUNT_USDC)
  console.log("📤 TX enviada:", tx.hash)
  console.log("⏳ Aguardando confirmação...")

  await tx.wait()

  console.log("✅ Transferência concluída!")

  // Verificar novos saldos
  const newOwnerBalance = await usdc.balanceOf(wallet.address)
  const newPrizePoolBalance = await usdc.balanceOf(PRIZE_POOL_ADDRESS)

  console.log("\n📊 Novos saldos:")
  console.log(`   Owner: ${ethers.formatUnits(newOwnerBalance, decimals)} ${symbol}`)
  console.log(`   PrizePool: ${ethers.formatUnits(newPrizePoolBalance, decimals)} ${symbol}`)

  // Calcular quantos dias de prêmios isso cobre
  // 20 + 10 + 5 = 35 USDC por dia
  const dailyPrizeTotal = ethers.parseUnits("35", decimals)
  const daysCovered = Number(newPrizePoolBalance) / Number(dailyPrizeTotal)
  console.log(`\n📅 Isso cobre aproximadamente ${Math.floor(daysCovered)} dias de prêmios (35 USDC por dia)`)
}

main()
  .then(() => {
    console.log("\n✅ Script concluído!")
    process.exit(0)
  })
  .catch((error) => {
    console.error("\n❌ Erro no script:")
    console.error(error)
    process.exit(1)
  })




