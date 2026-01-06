import { ethers } from "ethers"
import { readFileSync } from "fs"

const RPC_URL = "https://rpc.testnet.arc.network"
const CHAIN_ID = 5042002

// Contratos
const INTERMEDIARY_CONTRACT = "0x41Afb27763416f555207c9B0bB04F08E665b4AFd"

// Ler deployment.json para pegar o contrato atual
let CURRENT_CONTRACT
try {
  const deployment = JSON.parse(readFileSync("deployment.json", "utf-8"))
  CURRENT_CONTRACT = deployment.GameCredits
} catch (error) {
  CURRENT_CONTRACT = "0x531Ba20fB57fb9Efe6b8f5c7Cbf29248A7B3D5cF" // fallback
}

const ABI = [
  "function credits(address player) view returns (uint256)",
  "event CreditsPurchased(address indexed player, uint256 amount, uint256 creditsReceived, uint256 totalCost)",
  "event CreditsMigrated(address indexed player, uint256 amount)",
]

async function main() {
  console.log("=".repeat(70))
  console.log("VERIFICANDO CONTRATO INTERMEDIÁRIO")
  console.log("=".repeat(70))
  console.log(`Intermediário: ${INTERMEDIARY_CONTRACT}`)
  console.log(`Atual: ${CURRENT_CONTRACT}`)
  console.log("")

  const provider = new ethers.JsonRpcProvider(RPC_URL, CHAIN_ID)
  const contract = new ethers.Contract(INTERMEDIARY_CONTRACT, ABI, provider)

  console.log("🔍 Buscando eventos de compra e migração...")

  // Get current block number
  const currentBlock = await provider.getBlockNumber()
  console.log(`📍 Block atual: ${currentBlock}`)

  const filter = contract.filters.CreditsPurchased()
  
  // Query em chunks de 5000 blocos para evitar limites do RPC
  // Começar de um range maior (últimos 200k blocos ou desde o início)
  const CHUNK_SIZE = 5000
  const events = []
  // Verificar desde o início do contrato (ou últimos 200k blocos)
  const startFromBlock = Math.max(0, currentBlock - 200000)
  let fromBlock = startFromBlock
  let toBlock = Math.min(fromBlock + CHUNK_SIZE, currentBlock)

  while (fromBlock <= currentBlock) {
    try {
      process.stdout.write(`   Consultando blocos ${fromBlock} a ${toBlock}...\r`)
      const chunkEvents = await contract.queryFilter(filter, fromBlock, toBlock)
      events.push(...chunkEvents)
      
      fromBlock = toBlock + 1
      toBlock = Math.min(fromBlock + CHUNK_SIZE, currentBlock)
    } catch (error) {
      console.error(`\n❌ Erro ao consultar blocos ${fromBlock}-${toBlock}:`, error.message)
      // Tenta chunk menor se erro
      if (CHUNK_SIZE > 1000) {
        toBlock = Math.min(fromBlock + 1000, currentBlock)
        continue
      }
      fromBlock = toBlock + 1
      toBlock = Math.min(fromBlock + CHUNK_SIZE, currentBlock)
    }
  }

  console.log(`\n   ✅ Encontrados ${events.length} eventos de compra`)

  // Obter jogadores únicos
  const players = new Set()
  events.forEach(event => {
    players.add(event.args.player.toLowerCase())
  })

  console.log(`   📊 Jogadores únicos: ${players.size}`)
  console.log("")

  // Verificar saldos
  console.log("🔍 Verificando saldos de créditos...")
  const playersWithCredits = []
  let checked = 0

  for (const playerAddress of players) {
    try {
      const balance = await contract.credits(playerAddress)
      const balanceNum = Number(balance)
      if (balanceNum > 0) {
        playersWithCredits.push({
          address: playerAddress,
          balance: balanceNum
        })
      }
      checked++
      if (checked % 10 === 0) {
        process.stdout.write(`   Verificados ${checked}/${players.size} jogadores (${playersWithCredits.length} com créditos)...\r`)
      }
    } catch (error) {
      // Ignorar erros
    }
  }

  console.log(`\n   ✅ Jogadores com créditos > 0: ${playersWithCredits.length}`)
  console.log("")

  if (playersWithCredits.length > 0) {
    let total = 0
    playersWithCredits.forEach(p => total += p.balance)
    
    console.log("=".repeat(70))
    console.log("CRÉDITOS ENCONTRADOS NO CONTRATO INTERMEDIÁRIO")
    console.log("=".repeat(70))
    console.log(`Total de jogadores: ${playersWithCredits.length}`)
    console.log(`Total de créditos: ${total}`)
    console.log("")
    console.log("Top 10 jogadores:")
    playersWithCredits.sort((a, b) => b.balance - a.balance).slice(0, 10).forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.address}: ${p.balance} créditos`)
    })
    console.log("=".repeat(70))
    console.log("")
    console.log("✅ Créditos confirmados no contrato intermediário!")
    console.log("   → Pronto para migração")
    console.log("")
    return { hasCredits: true, players: playersWithCredits }
  } else {
    console.log("=".repeat(70))
    console.log("ℹ️ Nenhum crédito encontrado no contrato intermediário")
    console.log("=".repeat(70))
    return { hasCredits: false, players: [] }
  }
}

main()
  .then(result => {
    if (result.hasCredits) {
      console.log("")
      console.log("🚀 Execute a migração com:")
      console.log("   node scripts/migrate-from-intermediary.js")
      process.exit(0)
    } else {
      process.exit(1)
    }
  })
  .catch(error => {
    console.error("❌ Erro:", error.message)
    process.exit(1)
  })

