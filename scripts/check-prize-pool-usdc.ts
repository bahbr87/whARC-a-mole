import { ethers } from "ethers"

const RPC = "https://rpc.testnet.arc.network"
const PRIZE_POOL = "0xB98b8A9213072903277B9f592009E7C22acd2dd3"

const ABI = [
  "function usdc() view returns (address)"
]

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC)
  const contract = new ethers.Contract(PRIZE_POOL, ABI, provider)

  const usdc = await contract.usdc()
  console.log("USDC usado pelo PrizePool:", usdc)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Erro:", error)
    process.exit(1)
  })

