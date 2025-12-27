import { JsonRpcProvider, Contract, Wallet } from "ethers"

// PrizePool ABI - Funções necessárias para claim
const PRIZE_POOL_ABI = [
  "function claimPrize(uint256 day, uint256 rank, address player) external",
]

const PRIZE_POOL_ADDRESS = process.env.NEXT_PUBLIC_PRIZE_POOL_CONTRACT_ADDRESS || "0x0000000000000000000000000000000000000000"
const PRIVATE_KEY = process.env.PRIZE_POOL_PRIVATE_KEY || ""

/**
 * Get contract instance for prize pool
 * Returns null if contract is not configured
 */
export function getContractInstance(): Contract | null {
  if (!PRIZE_POOL_ADDRESS || PRIZE_POOL_ADDRESS === "0x0000000000000000000000000000000000000000") {
    return null
  }

  if (!PRIVATE_KEY) {
    console.warn("[CONTRACT] PRIZE_POOL_PRIVATE_KEY not set, contract calls will fail")
    return null
  }

  try {
    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "https://sepolia.infura.io/v3/YOUR_KEY"
    const provider = new JsonRpcProvider(rpcUrl)
    const wallet = new Wallet(PRIVATE_KEY, provider)
    return new Contract(PRIZE_POOL_ADDRESS, PRIZE_POOL_ABI, wallet)
  } catch (error) {
    console.error("[CONTRACT] Error creating contract instance:", error)
    return null
  }
}

