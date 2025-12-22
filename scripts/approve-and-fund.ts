import { ethers } from "ethers"
import dotenv from "dotenv"

dotenv.config()

/**
 * CONFIGURAÇÃO (NÃO MUDE ENDEREÇOS)
 */
const RPC_URL = process.env.ARC_RPC_URL!
const PRIVATE_KEY = process.env.OWNER_PRIVATE_KEY!

const USDC_ADDRESS = "0x3600000000000000000000000000000000000000" // USDC oficial Arc Testnet
const PRIZE_POOL = "0xEc5Cb537fecA57E2f7678D29a7622a92ebf2A3A8"   // PrizePool ATUAL (mais recente)

const AMOUNT_USDC = 800 // ou outro valor menor que o saldo
const DECIMALS = 6

/**
 * ABIs MÍNIMOS
 */
const USDC_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint256 amount) external returns (bool)",
]

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL)
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider)

  console.log("👛 Wallet:", wallet.address)
  console.log("🏆 PrizePool:", PRIZE_POOL)

  const usdc = new ethers.Contract(USDC_ADDRESS, USDC_ABI, wallet)

  const amount = ethers.parseUnits(AMOUNT_USDC.toString(), DECIMALS)

  const balance = await usdc.balanceOf(wallet.address)
  console.log("💰 USDC balance:", ethers.formatUnits(balance, DECIMALS))

  if (balance < amount) {
    throw new Error("❌ Saldo insuficiente de USDC")
  }

  // Verificar saldo atual do PrizePool
  const prizePoolBalance = await usdc.balanceOf(PRIZE_POOL)
  console.log("🏆 PrizePool balance atual:", ethers.formatUnits(prizePoolBalance, DECIMALS))

  console.log("💸 Transferindo USDC diretamente para PrizePool...")
  const txTransfer = await usdc.transfer(PRIZE_POOL, amount)
  await txTransfer.wait()

  // Verificar novos saldos
  const newBalance = await usdc.balanceOf(wallet.address)
  const newPrizePoolBalance = await usdc.balanceOf(PRIZE_POOL)
  
  console.log("🎉 SUCESSO!")
  console.log("💸 USDC enviados:", AMOUNT_USDC)
  console.log("🔗 TX:", txTransfer.hash)
  console.log("\n📊 Novos saldos:")
  console.log("   Wallet:", ethers.formatUnits(newBalance, DECIMALS), "USDC")
  console.log("   PrizePool:", ethers.formatUnits(newPrizePoolBalance, DECIMALS), "USDC")
}

main().catch((err) => {
  console.error("❌ ERRO:", err)
  process.exit(1)
})

