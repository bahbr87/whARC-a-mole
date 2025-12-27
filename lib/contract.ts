import { ethers } from "ethers"

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_PRIZE_POOL_ADDRESS || ""

const ABI = [
  // Adapte com o ABI real do seu contrato
  "function claimPrize(uint256 day, uint256 rank, address player) external"
]

let contractInstance: ethers.Contract | null = null

export function getContractInstance(): ethers.Contract | null {
  if (!CONTRACT_ADDRESS) return null

  if (!contractInstance) {
    try {
      const provider = new ethers.providers.Web3Provider((globalThis as any).ethereum)
      const signer = provider.getSigner()
      contractInstance = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer)
    } catch (error) {
      console.error("[CONTRACT] Error creating contract instance:", error)
      return null
    }
  }

  return contractInstance
}

