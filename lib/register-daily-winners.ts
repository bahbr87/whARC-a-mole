/**
 * ✅ FUNÇÃO INTERNA: registerDailyWinners(day)
 * 
 * Registra automaticamente os top 3 do ranking diário no contrato PrizePool.
 * 
 * REGRAS:
 * - Executa UMA única vez por dia (idempotente)
 * - Nunca sobrescreve winners existentes
 * - Não depende do frontend
 * - Pode ser chamada por cron/job/server action
 * 
 * @param day - Days since epoch (UTC)
 * @returns { success: boolean, winners?: string[], totalPlayers?: number, alreadyRegistered?: boolean, error?: string }
 */

import { JsonRpcProvider, Contract, Wallet, isAddress, getAddress } from "ethers"
import { promises as fs } from "fs"
import path from "path"

interface RankingEntry {
  player: string
  score: number
  goldenMoles: number
  errors: number
  timestamp: number
}

const RANKINGS_FILE = path.join(process.cwd(), "data", "rankings.json")
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"

// Load rankings from file
async function loadRankings(): Promise<RankingEntry[]> {
  try {
    await fs.mkdir(path.dirname(RANKINGS_FILE), { recursive: true })
    const data = await fs.readFile(RANKINGS_FILE, "utf-8")
    const parsed = JSON.parse(data)
    return Array.isArray(parsed) ? parsed : []
  } catch (error: any) {
    if (error.code === "ENOENT") {
      return []
    }
    console.error("Error loading rankings:", error)
    return []
  }
}

// Calculate daily winners from rankings
function calculateDailyWinners(rankings: RankingEntry[], day: number): { winners: string[]; totalPlayers: number } | null {
  // Convert day to timestamp range
  const dayStartTimestamp = day * 86400000
  const dayEndTimestamp = dayStartTimestamp + 86400000 - 1

  // Filter rankings for this specific day
  const dayRankings = rankings
    .filter((entry) => entry.timestamp >= dayStartTimestamp && entry.timestamp <= dayEndTimestamp)
    .reduce((acc, entry) => {
      const existing = acc.get(entry.player)
      if (existing) {
        existing.score += entry.score
        existing.goldenMoles += entry.goldenMoles
        existing.errors += entry.errors
      } else {
        acc.set(entry.player, {
          player: entry.player,
          score: entry.score,
          goldenMoles: entry.goldenMoles,
          errors: entry.errors,
          timestamp: entry.timestamp,
        })
      }
      return acc
    }, new Map<string, RankingEntry>())

  // Sort by score, goldenMoles, errors
  const sorted = Array.from(dayRankings.values()).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (b.goldenMoles !== a.goldenMoles) return b.goldenMoles - a.goldenMoles
    if (a.errors !== b.errors) return a.errors - b.errors
    return a.timestamp - b.timestamp
  })

  const totalPlayers = sorted.length

  if (totalPlayers === 0) {
    return null
  }

  // Extract top 3 (max) winners
  const winners: string[] = []
  for (let i = 0; i < Math.min(3, sorted.length); i++) {
    const address = sorted[i].player
    if (isAddress(address) && address !== ZERO_ADDRESS) {
      try {
        const normalized = getAddress(address)
        winners.push(normalized)
      } catch (error) {
        console.error(`Invalid address at position ${i}:`, address)
        return null
      }
    } else {
      console.error(`Invalid or zero address at position ${i}:`, address)
      return null
    }
  }

  return { winners, totalPlayers }
}

export async function registerDailyWinners(day: number): Promise<{
  success: boolean
  winners?: string[]
  totalPlayers?: number
  alreadyRegistered?: boolean
  error?: string
}> {
  try {
    // Get configuration
    const RPC_URL = process.env.RPC_URL || "https://rpc.testnet.arc.network"
    const PRIZE_POOL_ADDRESS =
      process.env.NEXT_PUBLIC_PRIZE_POOL_CONTRACT_ADDRESS ||
      process.env.PRIZE_POOL_CONTRACT_ADDRESS ||
      "0xeA0df70040E77a821b14770E53aa577A745930ae"
    const OWNER_PRIVATE_KEY = process.env.PRIZE_POOL_OWNER_PRIVATE_KEY

    if (!OWNER_PRIVATE_KEY) {
      return {
        success: false,
        error: "PRIZE_POOL_OWNER_PRIVATE_KEY not configured",
      }
    }

    if (!PRIZE_POOL_ADDRESS || PRIZE_POOL_ADDRESS === ZERO_ADDRESS) {
      return {
        success: false,
        error: "PRIZE_POOL_CONTRACT_ADDRESS not configured",
      }
    }

    // Create provider and contract
    const provider = new JsonRpcProvider(RPC_URL)
    const PRIZE_POOL_ABI = [
      "function setDailyWinners(uint256 day, address[] calldata _winners, uint256 _totalPlayers) external",
      "function getWinner(uint256 day, uint256 rank) view returns (address)",
      "function totalPlayers(uint256 day) view returns (uint256)",
      "function owner() view returns (address)",
    ]
    const contract = new Contract(PRIZE_POOL_ADDRESS, PRIZE_POOL_ABI, provider)

    // ✅ STEP 1: Check if winners are already registered (IDEMPOTENT)
    console.log(`🔍 [REGISTER-WINNERS] Checking if day ${day} is already registered...`)
    const totalPlayersOnChain = await contract.totalPlayers(day)
    const firstWinner = await contract.getWinner(day, 1)

    if (totalPlayersOnChain > BigInt(0) || (firstWinner && firstWinner !== ZERO_ADDRESS)) {
      console.log(`✅ [REGISTER-WINNERS] Day ${day} already registered (totalPlayers: ${totalPlayersOnChain})`)
      return {
        success: true,
        alreadyRegistered: true,
        winners: [],
        totalPlayers: Number(totalPlayersOnChain),
      }
    }

    // ✅ STEP 2: Load rankings and calculate winners
    console.log(`📊 [REGISTER-WINNERS] Loading rankings for day ${day}...`)
    const allRankings = await loadRankings()
    const winnersData = calculateDailyWinners(allRankings, day)

    if (!winnersData || winnersData.winners.length === 0) {
      console.log(`⚠️ [REGISTER-WINNERS] No players found for day ${day}`)
      return {
        success: false,
        error: `No players found for day ${day}`,
      }
    }

    console.log(`🏆 [REGISTER-WINNERS] Calculated winners for day ${day}:`, {
      winners: winnersData.winners,
      totalPlayers: winnersData.totalPlayers,
    })

    // ✅ STEP 3: Validate winners array
    if (winnersData.winners.length === 0) {
      return {
        success: false,
        error: "No valid winners found",
      }
    }

    // Check for duplicates
    const uniqueWinners = new Set(winnersData.winners.map((w) => w.toLowerCase()))
    if (uniqueWinners.size !== winnersData.winners.length) {
      return {
        success: false,
        error: "Duplicate addresses in winners array",
      }
    }

    // ✅ STEP 4: Register on contract
    console.log(`⛓️ [REGISTER-WINNERS] Registering winners on contract for day ${day}...`)
    const wallet = new Wallet(OWNER_PRIVATE_KEY)
    const walletWithProvider = wallet.connect(provider)
    const contractWithSigner = new Contract(PRIZE_POOL_ADDRESS, PRIZE_POOL_ABI, walletWithProvider)

    // Verify wallet is owner
    const contractOwner = await contract.owner()
    if (contractOwner.toLowerCase() !== wallet.address.toLowerCase()) {
      return {
        success: false,
        error: `Wallet ${wallet.address} is not the contract owner. Owner: ${contractOwner}`,
      }
    }

    // Call setDailyWinners
    console.log(
      `📤 [REGISTER-WINNERS] Calling setDailyWinners(${day}, [${winnersData.winners.join(", ")}], ${winnersData.totalPlayers})`
    )
    const tx = await contractWithSigner.setDailyWinners(day, winnersData.winners, winnersData.totalPlayers)
    console.log(`📤 [REGISTER-WINNERS] Transaction sent: ${tx.hash}`)

    // Wait for confirmation
    console.log(`⏳ [REGISTER-WINNERS] Waiting for transaction confirmation...`)
    const receipt = await tx.wait()

    if (!receipt || receipt.status !== 1) {
      return {
        success: false,
        error: "Transaction failed",
      }
    }

    console.log(`✅ [REGISTER-WINNERS] Winners registered successfully for day ${day}!`)
    console.log(`🔗 [REGISTER-WINNERS] Transaction: ${tx.hash}`)

    // Verify registration
    const verifyTotalPlayers = await contract.totalPlayers(day)
    const verifyFirstWinner = await contract.getWinner(day, 1)
    console.log(`✅ [REGISTER-WINNERS] Verification: totalPlayers=${verifyTotalPlayers}, firstWinner=${verifyFirstWinner}`)

    return {
      success: true,
      winners: winnersData.winners,
      totalPlayers: winnersData.totalPlayers,
      alreadyRegistered: false,
    }
  } catch (error: any) {
    console.error(`❌ [REGISTER-WINNERS] Error registering winners for day ${day}:`, error)
    return {
      success: false,
      error: error.message || "Unknown error",
    }
  }
}


