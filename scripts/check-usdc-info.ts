import "dotenv/config"
import { ethers } from "ethers"

const RPC = process.env.ARC_RPC_URL || "https://rpc.testnet.arc.network"
const USDC_ADDRESS = "0x37225a0bC4bc9f2dAA06F535E7B8BC7AB03636c4"

const USDC_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
]

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC)
  
  const usdc = new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider)

  console.log("🔍 Verificando informações do contrato USDC...")
  console.log("📍 Endereço:", USDC_ADDRESS)
  console.log("🌐 RPC:", RPC, "\n")

  const name = await usdc.name()
  const symbol = await usdc.symbol()
  const decimals = await usdc.decimals()
  const totalSupply = await usdc.totalSupply()

  console.log("📋 Informações do Token:")
  console.log("   Name:", name)
  console.log("   Symbol:", symbol)
  console.log("   Decimals:", decimals)
  console.log("   Total Supply:", ethers.formatUnits(totalSupply, decimals), symbol)

  // Verificar saldo do PrizePool - tentar múltiplos endereços possíveis
  const PRIZE_POOL_ADDRESSES = [
    process.env.NEXT_PUBLIC_PRIZE_POOL_CONTRACT_ADDRESS,
    process.env.PRIZE_POOL_CONTRACT_ADDRESS,
    "0xB98b8A9213072903277B9f592009E7C22acd2dd3",
    "0xeA0df70040E77a821b14770E53aa577A745930ae",
  ].filter(Boolean) as string[]

  console.log("\n🏆 Verificando saldo da PrizePool...")
  
  for (const PRIZE_POOL of PRIZE_POOL_ADDRESSES) {
    try {
      const prizePoolBalance = await usdc.balanceOf(PRIZE_POOL)
      const balanceFormatted = ethers.formatUnits(prizePoolBalance, decimals)
      console.log(`\n   Endereço: ${PRIZE_POOL}`)
      console.log(`   Saldo: ${balanceFormatted} ${symbol}`)
      
      // Calcular quantos dias de prêmios isso cobre
      const dailyPrizeTotal = ethers.parseUnits("35", decimals) // 20 + 10 + 5 = 35 USDC por dia
      const daysCovered = Number(prizePoolBalance) / Number(dailyPrizeTotal)
      console.log(`   Cobre aproximadamente ${Math.floor(daysCovered)} dias de prêmios (35 USDC por dia)`)
      
      if (Number(prizePoolBalance) > 0) {
        break // Se encontrou saldo, não precisa verificar outros endereços
      }
    } catch (error) {
      console.log(`   ❌ Erro ao verificar endereço ${PRIZE_POOL}:`, (error as Error).message)
    }
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




