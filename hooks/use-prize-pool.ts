"use client"

import { useCallback } from "react"
import { BrowserProvider, Contract } from "ethers"
import { useArcWallet } from "./use-arc-wallet"

// PrizePool ABI
const PRIZE_POOL_ABI = [
  "function getWinner(uint256 day, uint256 rank) view returns (address)",
  "function winners(uint256 day, uint256 rank) view returns (address)",
  "function claimed(uint256 day, address user) view returns (bool)",
  "function canClaim(uint256 day, address user) view returns (bool)",
  "function claim(uint256 day) external",
  "function totalPlayers(uint256 day) view returns (uint256)",
]

// PrizePool contract address (mais recente)
const PRIZE_POOL_ADDRESS = process.env.NEXT_PUBLIC_PRIZE_POOL_CONTRACT_ADDRESS || "0xb07bB827a5A53e2b36eb0126aDD22ca1b4843DC7"

import { getDayId } from "@/utils/day"

/**
 * Calculate days since epoch (Unix epoch: January 1, 1970)
 * @deprecated Use getDayId() from @/utils/day instead
 * @param date JavaScript Date object (defaults to current date)
 * @returns Number of days since epoch (UTC midnight)
 */
export function getDayUTC(date = new Date()): number {
  return getDayId(date)
}

// Alias for backward compatibility
export const getDaysSinceEpoch = getDayUTC

export function usePrizePool() {
  const { provider, address, isConnected } = useArcWallet()

  const claimPrize = useCallback(
    async (date: Date): Promise<string> => {
      if (typeof window === "undefined" || !window.ethereum) {
        throw new Error("Wallet não conectada")
      }

      if (PRIZE_POOL_ADDRESS === "0x0000000000000000000000000000000000000000") {
        throw new Error("PrizePool contract address not configured")
      }

      const provider = new BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const wallet = await signer.getAddress()

      const prizePool = new Contract(PRIZE_POOL_ADDRESS, PRIZE_POOL_ABI, signer)

      // Calculate days since epoch
      const day = getDayUTC(date)

      // Verificar se pode fazer claim
      const canClaim = await prizePool.canClaim(day, wallet)
      if (!canClaim) {
        throw new Error("Você não pode reivindicar este prêmio (não é vencedor ou já foi reivindicado)")
      }

      const signerAddress = await signer.getAddress()
      console.log("🔥 SIGNER REAL DA TX:", signerAddress)

      // O contrato valida tudo internamente:
      // - Se o usuário é vencedor
      // - Se já foi claimado
      // - Calcula o prêmio baseado no rank e número de jogadores
      // - Transfere USDC automaticamente
      const tx = await prizePool.claim(day)
      await tx.wait()

      return tx.hash
    },
    [address, isConnected],
  )

  const checkPrizeClaimed = useCallback(
    async (date: Date, userAddress: string): Promise<boolean> => {
      if (PRIZE_POOL_ADDRESS === "0x0000000000000000000000000000000000000000") {
        return false
      }

      try {
        if (typeof window === "undefined" || !window.ethereum) {
          return false
        }

        const currentProvider = new BrowserProvider(window.ethereum)
        const contract = new Contract(PRIZE_POOL_ADDRESS, PRIZE_POOL_ABI, currentProvider)
        const day = getDayUTC(date)
        return await contract.claimed(day, userAddress)
      } catch (error) {
        console.error("Error checking if prize is claimed:", error)
        return false
      }
    },
    [],
  )

  return {
    claimPrize,
    checkPrizeClaimed,
    getDayUTC,
    getDaysSinceEpoch, // Alias for backward compatibility
  }
}

