/**
 * Script para verificar:
 * 1. Se cada clique está gerando uma transação na blockchain
 * 2. Se os créditos estão sendo descontados corretamente
 * 
 * Uso:
 *   npx tsx scripts/verify-clicks-and-credits.ts [address] [fromBlock]
 */

import "dotenv/config"
import { ethers } from "ethers"
import { GAME_CREDITS_ADDRESS } from "../lib/arc-config"

const RPC_URL = process.env.RPC_URL || "https://rpc.testnet.arc.network"
const GAME_CREDITS_ADDRESS_FINAL = process.env.NEXT_PUBLIC_GAME_CREDITS_ADDRESS || GAME_CREDITS_ADDRESS

const GAME_CREDITS_ABI = [
  "function credits(address) external view returns (uint256)",
  "function getCredits(address player) external view returns (uint256)",
  "event CreditsConsumed(address indexed player, uint256 clickCount, uint256 creditsUsed, uint256 remainingCredits)",
]

async function verifyClicksAndCredits(address: string, fromBlock?: number) {
  if (!address || address === "0x0000000000000000000000000000000000000000") {
    console.error("❌ Invalid address")
    process.exit(1)
  }

  if (GAME_CREDITS_ADDRESS_FINAL === "0x0000000000000000000000000000000000000000") {
    console.error("❌ GAME_CREDITS_ADDRESS not configured")
    process.exit(1)
  }

  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL)
    const contract = new ethers.Contract(GAME_CREDITS_ADDRESS_FINAL, GAME_CREDITS_ABI, provider)

    console.log("🔍 Verificando cliques e créditos...")
    console.log("📍 Address:", address)
    console.log("📋 Contract:", GAME_CREDITS_ADDRESS_FINAL)
    console.log("🌐 RPC:", RPC_URL)
    console.log()

    // 1. Verificar saldo atual de créditos
    console.log("1️⃣ Verificando saldo atual de créditos...")
    let balance: bigint
    try {
      balance = await contract.credits(address)
    } catch (error: any) {
      balance = await contract.getCredits(address)
    }
    const currentBalance = Number(balance)
    console.log("   Saldo atual:", currentBalance.toLocaleString(), "créditos")
    console.log()

    // 2. Buscar eventos CreditsConsumed
    console.log("2️⃣ Buscando eventos CreditsConsumed...")
    const currentBlock = await provider.getBlockNumber()
    const fromBlockNumber = fromBlock || Math.max(0, currentBlock - 10000) // Últimos ~10000 blocos (ou especificado)
    
    console.log("   Bloco atual:", currentBlock)
    console.log("   Buscando desde o bloco:", fromBlockNumber)
    console.log()

    const filter = contract.filters.CreditsConsumed(address)
    const events = await contract.queryFilter(filter, fromBlockNumber, currentBlock)

    console.log(`   ✅ Encontrados ${events.length} eventos de consumo de créditos`)
    console.log()

    if (events.length === 0) {
      console.log("⚠️ Nenhum evento encontrado. Isso pode significar:")
      console.log("   - O jogador ainda não clicou em nenhum animal")
      console.log("   - Os eventos estão em blocos anteriores")
      console.log("   - Há um problema com o processamento de cliques")
      return
    }

    // 3. Analisar eventos
    console.log("3️⃣ Analisando eventos...")
    console.log()

    let totalClicks = 0
    let totalCreditsConsumed = 0
    const transactions = new Set<string>()

    events.forEach((event, index) => {
      const args = event.args as any
      const player = args[0]
      const clickCount = Number(args[1])
      const creditsUsed = Number(args[2])
      const remainingCredits = Number(args[3])

      totalClicks += clickCount
      totalCreditsConsumed += creditsUsed
      transactions.add(event.transactionHash)

      console.log(`   Evento ${index + 1}:`)
      console.log(`      Transaction Hash: ${event.transactionHash}`)
      console.log(`      Block: ${event.blockNumber}`)
      console.log(`      Cliques: ${clickCount}`)
      console.log(`      Créditos consumidos: ${creditsUsed}`)
      console.log(`      Créditos restantes: ${remainingCredits}`)
      console.log()
    })

    // 4. Resumo
    console.log("4️⃣ Resumo:")
    console.log("   Total de eventos:", events.length)
    console.log("   Total de transações únicas:", transactions.size)
    console.log("   Total de cliques processados:", totalClicks)
    console.log("   Total de créditos consumidos:", totalCreditsConsumed.toLocaleString())
    console.log("   Saldo atual:", currentBalance.toLocaleString())
    console.log()

    // 5. Verificações
    console.log("5️⃣ Verificações:")
    
    // Verificar se cada clique gerou uma transação
    const oneTransactionPerClick = transactions.size === totalClicks
    console.log(`   ✅ Cada clique gerou uma transação? ${oneTransactionPerClick ? "SIM ✅" : "NÃO ❌"}`)
    if (!oneTransactionPerClick) {
      console.log(`      ⚠️ Esperado: ${totalClicks} transações, encontrado: ${transactions.size}`)
      console.log(`      Isso pode indicar que os cliques estão sendo agrupados (batch)`)
    }

    // Verificar se os créditos foram descontados corretamente
    const creditsMatch = totalCreditsConsumed === totalClicks
    console.log(`   ✅ Créditos descontados corretamente (1 crédito por clique)? ${creditsMatch ? "SIM ✅" : "NÃO ❌"}`)
    if (!creditsMatch) {
      console.log(`      ⚠️ Esperado: ${totalClicks} créditos consumidos, encontrado: ${totalCreditsConsumed}`)
    }

    // Verificar se o saldo faz sentido
    // Assumindo que começou com algum saldo inicial (ex: 1000 ou 2000)
    // O saldo atual deveria ser: saldo_inicial - total_credits_consumidos
    console.log(`   📊 Saldo atual: ${currentBalance.toLocaleString()} créditos`)
    console.log(`   📊 Total consumido: ${totalCreditsConsumed.toLocaleString()} créditos`)
    console.log(`   📊 Saldo estimado inicial: ${(currentBalance + totalCreditsConsumed).toLocaleString()} créditos`)
    console.log()

    // 6. Verificar transações recentes
    if (events.length > 0) {
      console.log("6️⃣ Últimas 5 transações:")
      const recentEvents = events.slice(-5).reverse()
      recentEvents.forEach((event, index) => {
        const args = event.args as any
        console.log(`   ${index + 1}. Tx: ${event.transactionHash}`)
        console.log(`      Block: ${event.blockNumber}, Cliques: ${args[1]}, Créditos: ${args[2]}`)
      })
    }

  } catch (error: any) {
    console.error("❌ Error:", error.message)
    process.exit(1)
  }
}

// Get address from command line or use default
const address = process.argv[2] || "0x650cCD684cAb88E05d1b4b5fF3627FA57EfE75E5"
const fromBlock = process.argv[3] ? parseInt(process.argv[3]) : undefined

verifyClicksAndCredits(address, fromBlock)
  .then(() => {
    console.log()
    console.log("✅ Verificação concluída!")
    process.exit(0)
  })
  .catch((error) => {
    console.error("❌ Error:", error)
    process.exit(1)
  })

