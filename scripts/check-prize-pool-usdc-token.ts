import "dotenv/config"
import { ethers } from "ethers"

const RPC = process.env.ARC_RPC_URL || "https://rpc.testnet.arc.network"
const PRIZE_POOL = "0xB98b8A9213072903277B9f592009E7C22acd2dd3"

const ABI = [
  "function usdc() view returns (address)"
]

async function main() {
  if (!RPC) {
    throw new Error("❌ ARC_RPC_URL não configurado")
  }

  const provider = new ethers.JsonRpcProvider(RPC)
  const prizePool = new ethers.Contract(PRIZE_POOL, ABI, provider)

  console.log("🔍 Verificando endereço de USDC no PrizePool...")
  console.log("🏆 PrizePool:", PRIZE_POOL)
  console.log("🌐 RPC:", RPC, "\n")

  const usdc = await prizePool.usdc()
  console.log("✅ USDC configurado na PrizePool:", usdc)
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

