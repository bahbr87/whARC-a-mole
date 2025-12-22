import "dotenv/config"
import { ethers } from "ethers"

const RPC = process.env.ARC_RPC_URL!
const OWNER_PK = process.env.OWNER_PRIVATE_KEY!

const USDC_ADDRESS = "0x37225a0bC4bc9f2dAA06F535E7B8BC7AB03636c4"
const PRIZE_POOL = "0xB98b8A9213072903277B9f592009E7C22acd2dd3"

const AMOUNT = ethers.parseUnits("1000000", 6) // 1,000,000 USDC

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function balanceOf(address owner) view returns (uint256)",
]

async function main() {
  if (!RPC || !OWNER_PK) {
    throw new Error("❌ Variáveis de ambiente faltando: ARC_RPC_URL e OWNER_PRIVATE_KEY")
  }

  const provider = new ethers.JsonRpcProvider(RPC)
  const wallet = new ethers.Wallet(OWNER_PK, provider)

  console.log("👤 Wallet:", wallet.address)
  console.log("🪙 USDC:", USDC_ADDRESS)
  console.log("🏆 PrizePool:", PRIZE_POOL)
  console.log("💰 Amount:", ethers.formatUnits(AMOUNT, 6), "USDC\n")

  const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, wallet)

  console.log("🔎 Saldo antes:")
  const ownerBalanceBefore = await usdc.balanceOf(wallet.address)
  const prizePoolBalanceBefore = await usdc.balanceOf(PRIZE_POOL)
  console.log("   Owner:", ethers.formatUnits(ownerBalanceBefore, 6), "USDC")
  console.log("   PrizePool:", ethers.formatUnits(prizePoolBalanceBefore, 6), "USDC\n")

  if (ownerBalanceBefore < AMOUNT) {
    throw new Error(
      `❌ Saldo insuficiente! Owner tem ${ethers.formatUnits(ownerBalanceBefore, 6)} USDC, precisa de ${ethers.formatUnits(AMOUNT, 6)} USDC`
    )
  }

  console.log("📝 Approve...")
  const approveTx = await usdc.approve(PRIZE_POOL, AMOUNT)
  console.log("   TX:", approveTx.hash)
  await approveTx.wait()
  console.log("   ✅ Approved\n")

  console.log("💸 Transferindo para PrizePool...")
  const transferTx = await usdc.transfer(PRIZE_POOL, AMOUNT)
  console.log("   TX:", transferTx.hash)
  await transferTx.wait()
  console.log("   ✅ Transferência concluída\n")

  console.log("🔎 Saldo depois:")
  const ownerBalanceAfter = await usdc.balanceOf(wallet.address)
  const prizePoolBalanceAfter = await usdc.balanceOf(PRIZE_POOL)
  console.log("   Owner:", ethers.formatUnits(ownerBalanceAfter, 6), "USDC")
  console.log("   PrizePool:", ethers.formatUnits(prizePoolBalanceAfter, 6), "USDC\n")

  // Calcular quantos dias de prêmios isso cobre
  const dailyPrizeTotal = ethers.parseUnits("35", 6) // 20 + 10 + 5 = 35 USDC por dia
  const daysCovered = Number(prizePoolBalanceAfter) / Number(dailyPrizeTotal)
  console.log(`📅 Isso cobre aproximadamente ${Math.floor(daysCovered)} dias de prêmios (35 USDC por dia)`)
}

main()
  .then(() => {
    console.log("\n✅ Script concluído!")
    process.exit(0)
  })
  .catch((error) => {
    console.error("\n❌ Erro:", error)
    process.exit(1)
  })




