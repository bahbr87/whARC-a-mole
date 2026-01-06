import { ethers } from "ethers"
import * as fs from "fs"
import * as path from "path"
import dotenv from "dotenv"

dotenv.config({ path: path.join(process.cwd(), ".env.local") })

const INTERMEDIARY_CONTRACT = "0x41Afb27763416f555207c9B0bB04F08E665b4AFd" // Onde os créditos estão
const CURRENT_CONTRACT = "0x531Ba20fB57fb9Efe6b8f5c7Cbf29248A7B3D5cF" // Contrato atual
const RPC_URL = "https://rpc.testnet.arc.network"
const CHAIN_ID = 5042002

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || process.env.PRIVATE_KEY || process.env.OWNER_PRIVATE_KEY

if (!DEPLOYER_PRIVATE_KEY) {
  console.error("❌ DEPLOYER_PRIVATE_KEY, PRIVATE_KEY, or OWNER_PRIVATE_KEY not found in .env.local")
  process.exit(1)
}

const INTERMEDIARY_ABI = [
  "function credits(address) external view returns (uint256)",
  "event CreditsPurchased(address indexed player, uint256 amount, uint256 creditsReceived, uint256 totalCost)",
]

const CURRENT_ABI = [
  "function migrateCredits(address player, uint256 amount) external",
  "function credits(address) external view returns (uint256)",
  "function migrationEnabled() external view returns (bool)",
  "function owner() external view returns (address)",
]

async function getPlayersWithCredits(contractAddress) {
  console.log("📋 Getting players with credits from intermediary contract...")
  
  const provider = new ethers.JsonRpcProvider(RPC_URL, CHAIN_ID)
  const contract = new ethers.Contract(contractAddress, INTERMEDIARY_ABI, provider)
  
  // Primeiro, tentar buscar eventos desde o início
  const currentBlock = await provider.getBlockNumber()
  console.log(`   Current block: ${currentBlock}`)
  console.log(`   Querying ALL events from block 0 to ${currentBlock}...`)
  console.log("   (This may take a while...)")
  
  const players = new Map()
  
  // Query em chunks menores para evitar limites do RPC
  const chunkSize = 5000
  let totalEvents = 0
  for (let start = 0; start <= currentBlock; start += chunkSize) {
    const end = Math.min(start + chunkSize - 1, currentBlock)
    try {
      const filter = contract.filters.CreditsPurchased()
      const events = await contract.queryFilter(filter, start, end)
      
      events.forEach(event => {
        const player = event.args.player.toLowerCase()
        if (!players.has(player)) {
          players.set(player, true)
        }
      })
      
      totalEvents += events.length
      if (events.length > 0 || start % 50000 === 0) {
        process.stdout.write(`   Processed blocks ${start}-${end} (${totalEvents} events, ${players.size} players)...\r`)
      }
    } catch (error) {
      if (error.message.includes("eth_getLogs is limited")) {
        // Chunk muito grande, reduzir
        const smallerChunk = Math.min(start + 1000, currentBlock)
        try {
          const filter = contract.filters.CreditsPurchased()
          const events = await contract.queryFilter(filter, start, smallerChunk)
          events.forEach(event => {
            const player = event.args.player.toLowerCase()
            if (!players.has(player)) {
              players.set(player, true)
            }
          })
          totalEvents += events.length
          start = smallerChunk
          continue
        } catch (e) {
          // Skip this chunk
        }
      }
      // Continue to next chunk
    }
  }
  
  console.log(`\n   Found ${totalEvents} events and ${players.size} unique players`)
  
  // Se não encontrou eventos, verificar endereços conhecidos diretamente
  if (players.size === 0) {
    console.log("   ⚠️ No events found, checking known addresses directly...")
    const knownAddresses = [
      "0xB51158878a08a860443B10b2F24617bab5F1F3eA", // Endereço que sabemos que tem créditos
    ]
    
    for (const addr of knownAddresses) {
      players.set(addr.toLowerCase(), true)
    }
  }
  
  // Get actual balances
  console.log("   Checking balances for all players...")
  const playersWithCredits = []
  let index = 0
  for (const [playerAddress] of players) {
    try {
      const balance = await contract.credits(playerAddress)
      const balanceNum = Number(balance)
      if (balanceNum > 0) {
        playersWithCredits.push({
          address: playerAddress,
          balance: balanceNum,
          balanceRaw: balance.toString()
        })
      }
      index++
      if (index % 10 === 0) {
        process.stdout.write(`   Checked ${index}/${players.size} players (${playersWithCredits.length} with credits)...\r`)
      }
    } catch (error) {
      console.error(`   ⚠️ Error getting balance for ${playerAddress}:`, error.message)
    }
  }
  
  console.log(`\n   Found ${playersWithCredits.length} players with balance > 0`)
  
  return playersWithCredits.sort((a, b) => b.balance - a.balance)
}

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL, CHAIN_ID)
  const wallet = new ethers.Wallet(DEPLOYER_PRIVATE_KEY, provider)

  console.log("=".repeat(80))
  console.log("MIGRANDO CRÉDITOS DO CONTRATO INTERMEDIÁRIO PARA O ATUAL")
  console.log("=".repeat(80))
  console.log("👤 Owner:", wallet.address)
  console.log("📦 Contrato Intermediário (origem):", INTERMEDIARY_CONTRACT)
  console.log("✨ Contrato Atual (destino):", CURRENT_CONTRACT)
  console.log("=".repeat(80))
  console.log("")

  // Verify owner is the owner of current contract
  const currentContract = new ethers.Contract(CURRENT_CONTRACT, CURRENT_ABI, provider)
  const owner = await currentContract.owner()
  const migrationEnabled = await currentContract.migrationEnabled()
  
  if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
    console.error("❌ Wallet is not the owner of the current contract!")
    console.error(`   Owner: ${owner}`)
    console.error(`   Wallet: ${wallet.address}`)
    process.exit(1)
  }
  
  if (!migrationEnabled) {
    console.error("❌ Migration is disabled in the current contract!")
    process.exit(1)
  }
  
  console.log("✅ Owner verified")
  console.log("✅ Migration enabled")
  console.log("")

  // Get players with credits from intermediary
  const players = await getPlayersWithCredits(INTERMEDIARY_CONTRACT)
  
  if (players.length === 0) {
    console.log("ℹ️ No players with credits found in intermediary contract")
    return
  }
  
  console.log("")
  console.log("=".repeat(80))
  console.log("PLAYERS TO MIGRATE:")
  console.log("=".repeat(80))
  let totalCredits = 0
  players.forEach((p, i) => {
    console.log(`${i + 1}. ${p.address}: ${p.balance} credits`)
    totalCredits += p.balance
  })
  console.log("=".repeat(80))
  console.log(`Total players: ${players.length}`)
  console.log(`Total credits: ${totalCredits}`)
  console.log("=".repeat(80))
  console.log("")

  // Migrate credits
  const currentContractWithSigner = new ethers.Contract(CURRENT_CONTRACT, CURRENT_ABI, wallet)
  
  let migrated = 0
  let failed = 0
  
  for (const player of players) {
    try {
      // Check if player already has credits in current contract
      const currentBalance = await currentContract.credits(player.address)
      const currentBalanceNum = Number(currentBalance)
      
      if (currentBalanceNum > 0) {
        console.log(`⏭️  Skipping ${player.address}: already has ${currentBalanceNum} credits in current contract`)
        continue
      }
      
      // Migrate in chunks of 50k (contract limit)
      let remaining = player.balance
      while (remaining > 0) {
        const migrateAmount = Math.min(remaining, 50000)
        
        console.log(`🔄 Migrating ${migrateAmount} credits for ${player.address}...`)
        const tx = await currentContractWithSigner.migrateCredits(player.address, migrateAmount)
        console.log(`   Transaction: ${tx.hash}`)
        const receipt = await tx.wait()
        
        if (receipt.status === 1) {
          console.log(`   ✅ Confirmed in block ${receipt.blockNumber}`)
          remaining -= migrateAmount
          migrated++
        } else {
          throw new Error("Transaction failed")
        }
      }
      
      // Verify migration
      const newBalance = await currentContract.credits(player.address)
      console.log(`   ✅ Verified: ${player.address} now has ${newBalance.toString()} credits`)
      console.log("")
    } catch (error) {
      console.error(`   ❌ Failed to migrate ${player.address}:`, error.message)
      failed++
    }
  }
  
  console.log("")
  console.log("=".repeat(80))
  console.log("MIGRATION COMPLETE")
  console.log("=".repeat(80))
  console.log(`✅ Migrated: ${migrated} players`)
  if (failed > 0) {
    console.log(`❌ Failed: ${failed} players`)
  }
  console.log("=".repeat(80))
}

main().catch(console.error)


