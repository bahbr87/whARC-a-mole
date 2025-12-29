/**
 * Script para verificar transações recentes do relayer
 * 
 * Uso:
 *   npx tsx scripts/check-recent-transactions.ts [relayerAddress]
 */

import "dotenv/config"
import { ethers } from "ethers"

const RPC_URL = process.env.RPC_URL || "https://rpc.testnet.arc.network"
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY

async function checkRecentTransactions(relayerAddress?: string) {
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL)
    
    // Se não fornecido, tentar obter do RELAYER_PRIVATE_KEY
    let address = relayerAddress
    if (!address && RELAYER_PRIVATE_KEY) {
      const wallet = new ethers.Wallet(RELAYER_PRIVATE_KEY, provider)
      address = wallet.address
    }
    
    if (!address) {
      console.error("❌ Relayer address not provided and RELAYER_PRIVATE_KEY not configured")
      process.exit(1)
    }

    console.log("🔍 Verificando transações recentes do relayer...")
    console.log("📍 Relayer Address:", address)
    console.log("🌐 RPC:", RPC_URL)
    console.log()

    // Obter bloco atual
    const currentBlock = await provider.getBlockNumber()
    console.log("📊 Bloco atual:", currentBlock)
    console.log()

    // Buscar transações dos últimos 1000 blocos
    const fromBlock = Math.max(0, currentBlock - 1000)
    console.log(`🔍 Buscando transações desde o bloco ${fromBlock}...`)
    console.log()

    // Buscar transações enviadas pelo relayer
    let txCount = 0
    const transactions: Array<{
      hash: string
      blockNumber: number
      to: string
      method: string
    }> = []

    // Buscar em blocos recentes
    for (let blockNum = currentBlock; blockNum >= fromBlock && txCount < 50; blockNum--) {
      try {
        const block = await provider.getBlock(blockNum, true)
        if (!block || !block.transactions) continue

        for (const tx of block.transactions) {
          if (typeof tx === 'string') continue
          
          if (tx.from?.toLowerCase() === address.toLowerCase()) {
            txCount++
            transactions.push({
              hash: tx.hash,
              blockNumber: blockNum,
              to: tx.to || 'unknown',
              method: 'unknown'
            })
            
            if (txCount >= 50) break
          }
        }
      } catch (error: any) {
        // Ignorar erros de blocos individuais
        continue
      }
    }

    console.log(`✅ Encontradas ${transactions.length} transações do relayer`)
    console.log()

    if (transactions.length === 0) {
      console.log("⚠️ Nenhuma transação encontrada. Isso pode significar:")
      console.log("   - O relayer não está enviando transações")
      console.log("   - As transações estão em blocos mais antigos")
      console.log("   - Há um problema na configuração do relayer")
      return
    }

    // Mostrar últimas 10 transações
    console.log("📋 Últimas 10 transações:")
    const recentTxs = transactions.slice(0, 10)
    for (const tx of recentTxs) {
      console.log(`   ${tx.hash}`)
      console.log(`      Block: ${tx.blockNumber}, To: ${tx.to}`)
      console.log()
    }

    // Verificar se alguma transação é para o contrato GameCredits
    const GAME_CREDITS_ADDRESS = process.env.NEXT_PUBLIC_GAME_CREDITS_ADDRESS || 
                                  process.env.GAME_CREDITS_ADDRESS ||
                                  "0xB6EF59882778d0A245202F1482f20f02ad82bd87"
    
    const creditsTxs = transactions.filter(tx => 
      tx.to?.toLowerCase() === GAME_CREDITS_ADDRESS.toLowerCase()
    )

    console.log(`📊 Transações para GameCredits: ${creditsTxs.length}`)
    if (creditsTxs.length > 0) {
      console.log("   Últimas transações para GameCredits:")
      creditsTxs.slice(0, 5).forEach(tx => {
        console.log(`      ${tx.hash} (Block: ${tx.blockNumber})`)
      })
    }

  } catch (error: any) {
    console.error("❌ Error:", error.message)
    process.exit(1)
  }
}

// Get relayer address from command line or use from env
const relayerAddress = process.argv[2]

checkRecentTransactions(relayerAddress)
  .then(() => {
    console.log()
    console.log("✅ Verificação concluída!")
    process.exit(0)
  })
  .catch((error) => {
    console.error("❌ Error:", error)
    process.exit(1)
  })


