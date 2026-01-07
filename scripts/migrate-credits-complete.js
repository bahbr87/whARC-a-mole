import { ethers } from "ethers"
import * as fs from "fs"
import * as path from "path"
import dotenv from "dotenv"

dotenv.config({ path: path.join(process.cwd(), ".env.local") })

// ============================================================================
// CONFIGURAÇÃO DE CONTRATOS
// ============================================================================
const CONTRATO_ANTIGO = "0xB6EF59882778d0A245202F1482f20f02ad82bd87" // Fonte de identificação de jogadores
const CONTRATO_INTERMEDIARIO = "0x41Afb27763416f555207c9B0bB04F08E665b4AFd" // Onde os créditos estão
const CONTRATO_NOVO = "0x531Ba20fB57fb9Efe6b8f5c7Cbf29248A7B3D5cF" // Destino da migração

const RPC_URL = "https://rpc.testnet.arc.network"
const CHAIN_ID = 5042002

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || process.env.PRIVATE_KEY || process.env.OWNER_PRIVATE_KEY

if (!DEPLOYER_PRIVATE_KEY) {
  console.error("❌ DEPLOYER_PRIVATE_KEY, PRIVATE_KEY, or OWNER_PRIVATE_KEY not found in .env.local")
  process.exit(1)
}

// ============================================================================
// ABIs
// ============================================================================
const CONTRATO_ANTIGO_ABI = [
  "event CreditsPurchased(address indexed player, uint256 amount, uint256 creditsReceived, uint256 totalCost)",
  "event CreditsConsumed(address indexed player, uint256 clickCount, uint256 creditsUsed, uint256 remainingCredits)",
]

const CONTRATO_INTERMEDIARIO_ABI = [
  "function credits(address player) external view returns (uint256)",
]

const CONTRATO_NOVO_ABI = [
  "function migrateCredits(address player, uint256 amount) external",
  "function credits(address) external view returns (uint256)",
  "function migrationEnabled() external view returns (bool)",
  "function owner() external view returns (address)",
]

// ============================================================================
// FUNÇÕES AUXILIARES
// ============================================================================

/**
 * Busca todos os eventos de compra e consumo do contrato antigo
 */
async function identificarJogadores(provider) {
  console.log("=".repeat(80))
  console.log("PASSO 1: IDENTIFICANDO JOGADORES DO CONTRATO ANTIGO")
  console.log("=".repeat(80))
  console.log(`Contrato Antigo: ${CONTRATO_ANTIGO}`)
  console.log("")

  const contract = new ethers.Contract(CONTRATO_ANTIGO, CONTRATO_ANTIGO_ABI, provider)
  
  const currentBlock = await provider.getBlockNumber()
  console.log(`📍 Block atual: ${currentBlock}`)
  console.log("🔍 Buscando eventos desde o início do contrato...")
  console.log("   (Isso pode demorar alguns minutos...)")
  console.log("")

  const players = new Set()
  let totalEvents = 0

  // Buscar eventos CreditsPurchased
  const purchaseFilter = contract.filters.CreditsPurchased()
  const consumeFilter = contract.filters.CreditsConsumed()

  // Buscar apenas dos últimos 200k blocos (mais eficiente)
  const START_BLOCK = Math.max(0, currentBlock - 200000)
  const CHUNK_SIZE = 5000
  let fromBlock = START_BLOCK
  let toBlock = Math.min(fromBlock + CHUNK_SIZE, currentBlock)

  console.log(`   Buscando eventos dos blocos ${START_BLOCK} a ${currentBlock}...`)
  console.log("")

  const maxRetries = 3
  const retryDelay = 2000 // 2 segundos

  while (fromBlock <= currentBlock) {
    let retries = 0
    let success = false

    while (retries < maxRetries && !success) {
      try {
        // Buscar eventos de compra
        const purchaseEvents = await contract.queryFilter(purchaseFilter, fromBlock, toBlock)
        purchaseEvents.forEach(event => {
          players.add(event.args.player.toLowerCase())
          totalEvents++
        })

        // Buscar eventos de consumo
        const consumeEvents = await contract.queryFilter(consumeFilter, fromBlock, toBlock)
        consumeEvents.forEach(event => {
          players.add(event.args.player.toLowerCase())
          totalEvents++
        })

        if (fromBlock % 50000 === 0 || purchaseEvents.length > 0 || consumeEvents.length > 0) {
          process.stdout.write(
            `   Blocos ${fromBlock}-${toBlock}: ${purchaseEvents.length} compras, ${consumeEvents.length} consumos, ${players.size} jogadores únicos...\r`
          )
        }

        success = true
        fromBlock = toBlock + 1
        toBlock = Math.min(fromBlock + CHUNK_SIZE, currentBlock)

        // Pequeno delay para evitar sobrecarga
        if (fromBlock % 10000 === 0) {
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      } catch (error) {
        retries++
        
        if (error.message.includes("eth_getLogs is limited")) {
          // Reduzir chunk
          toBlock = Math.min(fromBlock + 1000, currentBlock)
          success = true
          continue
        }

        if (retries >= maxRetries) {
          // Se falhou muitas vezes, pular este chunk e continuar
          console.error(`\n   ⚠️ Erro persistente nos blocos ${fromBlock}-${toBlock}: ${error.message}`)
          console.error(`   Pulando este chunk e continuando...`)
          fromBlock = toBlock + 1
          toBlock = Math.min(fromBlock + CHUNK_SIZE, currentBlock)
          success = true
        } else {
          // Retry com delay
          await new Promise(resolve => setTimeout(resolve, retryDelay * retries))
        }
      }
    }
  }

  console.log(`\n   ✅ Total de eventos encontrados: ${totalEvents}`)
  console.log(`   ✅ Total de jogadores únicos: ${players.size}`)
  console.log("")

  // Se não encontrou muitos jogadores, adicionar endereços conhecidos
  if (players.size === 0) {
    console.log("   ⚠️ Nenhum jogador encontrado via eventos")
    console.log("   Adicionando endereços conhecidos para verificação...")
    // Adicionar endereço que sabemos que tem créditos
    players.add("0xb51158878a08a860443b10b2f24617bab5f1f3ea")
  }

  return Array.from(players)
}

/**
 * Verifica saldos no contrato intermediário
 */
async function verificarSaldosIntermediario(provider, players) {
  console.log("=".repeat(80))
  console.log("PASSO 2: VERIFICANDO SALDOS NO CONTRATO INTERMEDIÁRIO")
  console.log("=".repeat(80))
  console.log(`Contrato Intermediário: ${CONTRATO_INTERMEDIARIO}`)
  console.log("")

  const contract = new ethers.Contract(CONTRATO_INTERMEDIARIO, CONTRATO_INTERMEDIARIO_ABI, provider)

  const playersWithCredits = []
  let checked = 0

  for (const playerAddress of players) {
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

      checked++
      if (checked % 20 === 0) {
        process.stdout.write(`   Verificados ${checked}/${players.length} jogadores (${playersWithCredits.length} com créditos)...\r`)
      }
    } catch (error) {
      console.error(`\n   ⚠️ Erro ao verificar ${playerAddress}: ${error.message}`)
    }
  }

  console.log(`\n   ✅ Jogadores com créditos > 0: ${playersWithCredits.length}`)
  
  if (playersWithCredits.length > 0) {
    let total = 0
    playersWithCredits.forEach(p => total += p.balance)
    console.log(`   ✅ Total de créditos no intermediário: ${total}`)
  }

  console.log("")

  return playersWithCredits.sort((a, b) => b.balance - a.balance)
}

/**
 * Valida o contrato novo antes da migração
 */
async function validarContratoNovo(provider, wallet) {
  console.log("=".repeat(80))
  console.log("PASSO 3: VALIDANDO CONTRATO NOVO")
  console.log("=".repeat(80))
  console.log(`Contrato Novo: ${CONTRATO_NOVO}`)
  console.log(`👤 Wallet Owner: ${wallet.address}`)
  console.log("")

  const contract = new ethers.Contract(CONTRATO_NOVO, CONTRATO_NOVO_ABI, provider)

  try {
    // Verificar se o contrato existe
    const code = await provider.getCode(CONTRATO_NOVO)
    if (code === "0x") {
      throw new Error("Contrato não existe ou não tem código")
    }
    console.log("   ✅ Contrato existe e tem código")

    // Verificar owner
    const owner = await contract.owner()
    if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
      throw new Error(`Wallet não é o owner! Owner: ${owner}, Wallet: ${wallet.address}`)
    }
    console.log("   ✅ Wallet é o owner do contrato")

    // Verificar se migration está habilitada
    const migrationEnabled = await contract.migrationEnabled()
    if (!migrationEnabled) {
      throw new Error("Migration está desabilitada no contrato!")
    }
    console.log("   ✅ Migration está habilitada")

    console.log("")
    return true
  } catch (error) {
    console.error(`   ❌ Erro na validação: ${error.message}`)
    console.log("")
    return false
  }
}

/**
 * Verifica se o jogador já foi migrado
 */
async function verificarSeJaMigrado(provider, playerAddress) {
  const contract = new ethers.Contract(CONTRATO_NOVO, CONTRATO_NOVO_ABI, provider)
  try {
    const balance = await contract.credits(playerAddress)
    return Number(balance) > 0
  } catch (error) {
    return false
  }
}

/**
 * Executa dry-run (apenas lista o que será migrado)
 */
async function dryRun(provider, playersWithCredits) {
  console.log("=".repeat(80))
  console.log("DRY-RUN: SIMULAÇÃO DA MIGRAÇÃO")
  console.log("=".repeat(80))
  console.log("")

  const contract = new ethers.Contract(CONTRATO_NOVO, CONTRATO_NOVO_ABI, provider)

  console.log("🔍 Verificando quais jogadores já foram migrados...")
  console.log("")

  const toMigrate = []
  const alreadyMigrated = []
  let checked = 0

  for (const player of playersWithCredits) {
    const alreadyHasCredits = await verificarSeJaMigrado(provider, player.address)
    
    if (alreadyHasCredits) {
      const currentBalance = await contract.credits(player.address)
      alreadyMigrated.push({
        ...player,
        currentBalance: Number(currentBalance)
      })
    } else {
      toMigrate.push(player)
    }

    checked++
    if (checked % 10 === 0) {
      process.stdout.write(`   Verificados ${checked}/${playersWithCredits.length} jogadores...\r`)
    }
  }

  console.log(`\n   ✅ Verificação concluída`)
  console.log("")

  // Relatório
  console.log("=".repeat(80))
  console.log("RELATÓRIO DO DRY-RUN")
  console.log("=".repeat(80))
  console.log("")

  if (toMigrate.length > 0) {
    console.log(`📋 JOGADORES A MIGRAR: ${toMigrate.length}`)
    console.log("-".repeat(80))
    let totalToMigrate = 0
    toMigrate.forEach((p, i) => {
      console.log(`${i + 1}. ${p.address}`)
      console.log(`   Saldo no intermediário: ${p.balance} créditos`)
      totalToMigrate += p.balance
    })
    console.log("-".repeat(80))
    console.log(`Total de créditos a migrar: ${totalToMigrate}`)
    console.log("")
  } else {
    console.log("ℹ️ Nenhum jogador precisa ser migrado")
    console.log("")
  }

  if (alreadyMigrated.length > 0) {
    console.log(`⏭️  JOGADORES JÁ MIGRADOS: ${alreadyMigrated.length}`)
    console.log("-".repeat(80))
    alreadyMigrated.forEach((p, i) => {
      console.log(`${i + 1}. ${p.address}`)
      console.log(`   Saldo no intermediário: ${p.balance} créditos`)
      console.log(`   Saldo atual no novo contrato: ${p.currentBalance} créditos`)
    })
    console.log("-".repeat(80))
    console.log("")
  }

  return { toMigrate, alreadyMigrated }
}

/**
 * Executa a migração real
 */
async function executarMigracao(provider, wallet, playersToMigrate) {
  console.log("=".repeat(80))
  console.log("PASSO 4: EXECUTANDO MIGRAÇÃO")
  console.log("=".repeat(80))
  console.log("")

  const contract = new ethers.Contract(CONTRATO_NOVO, CONTRATO_NOVO_ABI, wallet)

  const results = {
    success: [],
    failed: [],
    totalMigrated: 0,
    totalCredits: 0
  }

  for (let i = 0; i < playersToMigrate.length; i++) {
    const player = playersToMigrate[i]
    console.log(`[${i + 1}/${playersToMigrate.length}] Migrando ${player.address}...`)
    console.log(`   Saldo no intermediário: ${player.balance} créditos`)

    try {
      // Verificar se já foi migrado (double-check)
      const alreadyHasCredits = await verificarSeJaMigrado(provider, player.address)
      if (alreadyHasCredits) {
        const currentBalance = await contract.credits(player.address)
        console.log(`   ⏭️  Já migrado! Saldo atual: ${currentBalance.toString()}`)
        results.success.push({
          ...player,
          skipped: true,
          reason: "Already migrated"
        })
        continue
      }

      // Migrar em chunks de 50k (limite do contrato)
      let remaining = player.balance
      const transactions = []

      while (remaining > 0) {
        const migrateAmount = Math.min(remaining, 50000)
        
        console.log(`   🔄 Migrando ${migrateAmount} créditos...`)
        const tx = await contract.migrateCredits(player.address, migrateAmount)
        console.log(`   📝 Transaction: ${tx.hash}`)
        
        const receipt = await tx.wait()
        
        if (receipt.status === 1) {
          console.log(`   ✅ Confirmado no block ${receipt.blockNumber}`)
          transactions.push({
            hash: tx.hash,
            amount: migrateAmount,
            blockNumber: receipt.blockNumber
          })
          remaining -= migrateAmount
        } else {
          throw new Error("Transaction failed")
        }
      }

      // Verificar migração
      const newBalance = await contract.credits(player.address)
      const newBalanceNum = Number(newBalance)
      
      if (newBalanceNum === player.balance) {
        console.log(`   ✅ Verificado: ${player.address} agora tem ${newBalanceNum} créditos`)
        results.success.push({
          ...player,
          transactions,
          newBalance: newBalanceNum
        })
        results.totalMigrated++
        results.totalCredits += player.balance
      } else {
        throw new Error(`Saldo não corresponde! Esperado: ${player.balance}, Atual: ${newBalanceNum}`)
      }

      console.log("")
    } catch (error) {
      console.error(`   ❌ Erro: ${error.message}`)
      results.failed.push({
        ...player,
        error: error.message
      })
      console.log("")
    }
  }

  return results
}

/**
 * Gera relatório final
 */
function gerarRelatorioFinal(results, dryRunResults) {
  console.log("")
  console.log("=".repeat(80))
  console.log("RELATÓRIO FINAL DA MIGRAÇÃO")
  console.log("=".repeat(80))
  console.log("")

  console.log("📊 ESTATÍSTICAS:")
  console.log(`   ✅ Migrados com sucesso: ${results.totalMigrated} jogadores`)
  console.log(`   ❌ Falhas: ${results.failed.length} jogadores`)
  console.log(`   💰 Total de créditos migrados: ${results.totalCredits}`)
  console.log("")

  if (results.success.length > 0) {
    console.log("✅ MIGRAÇÕES BEM-SUCEDIDAS:")
    console.log("-".repeat(80))
    results.success.forEach((p, i) => {
      if (p.skipped) {
        console.log(`${i + 1}. ${p.address} - ⏭️  Já estava migrado`)
      } else {
        console.log(`${i + 1}. ${p.address}`)
        console.log(`   Saldo migrado: ${p.balance} créditos`)
        console.log(`   Saldo atual: ${p.newBalance} créditos`)
        if (p.transactions) {
          console.log(`   Transações: ${p.transactions.length}`)
          p.transactions.forEach((tx, idx) => {
            console.log(`      ${idx + 1}. ${tx.hash} (${tx.amount} créditos, block ${tx.blockNumber})`)
          })
        }
      }
    })
    console.log("-".repeat(80))
    console.log("")
  }

  if (results.failed.length > 0) {
    console.log("❌ FALHAS:")
    console.log("-".repeat(80))
    results.failed.forEach((p, i) => {
      console.log(`${i + 1}. ${p.address}`)
      console.log(`   Saldo no intermediário: ${p.balance} créditos`)
      console.log(`   Erro: ${p.error}`)
    })
    console.log("-".repeat(80))
    console.log("")
  }

  // Salvar relatório em arquivo
  const report = {
    timestamp: new Date().toISOString(),
    contracts: {
      antigo: CONTRATO_ANTIGO,
      intermediario: CONTRATO_INTERMEDIARIO,
      novo: CONTRATO_NOVO
    },
    statistics: {
      totalMigrated: results.totalMigrated,
      totalFailed: results.failed.length,
      totalCredits: results.totalCredits
    },
    success: results.success.map(p => ({
      address: p.address,
      balance: p.balance,
      newBalance: p.newBalance || null,
      transactions: p.transactions || null,
      skipped: p.skipped || false
    })),
    failed: results.failed.map(p => ({
      address: p.address,
      balance: p.balance,
      error: p.error
    }))
  }

  const reportPath = path.join(process.cwd(), "migration-report.json")
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
  console.log(`📄 Relatório salvo em: ${reportPath}`)
  console.log("")
}

// ============================================================================
// FUNÇÃO PRINCIPAL
// ============================================================================
async function main() {
  const args = process.argv.slice(2)
  const isDryRun = args.includes("--dry-run") || args.includes("-d")

  console.log("=".repeat(80))
  console.log("MIGRAÇÃO DE CRÉDITOS - CONTRATO INTERMEDIÁRIO → NOVO GAMECREDITS")
  console.log("=".repeat(80))
  console.log("")
  console.log(`Modo: ${isDryRun ? "🔍 DRY-RUN (Simulação)" : "🚀 EXECUÇÃO REAL"}`)
  console.log("")
  console.log("Contratos:")
  console.log(`   Antigo (fonte de jogadores): ${CONTRATO_ANTIGO}`)
  console.log(`   Intermediário (fonte de créditos): ${CONTRATO_INTERMEDIARIO}`)
  console.log(`   Novo (destino): ${CONTRATO_NOVO}`)
  console.log("")
  console.log("=".repeat(80))
  console.log("")

  const provider = new ethers.JsonRpcProvider(RPC_URL, CHAIN_ID)
  const wallet = new ethers.Wallet(DEPLOYER_PRIVATE_KEY, provider)

  // Passo 1: Identificar jogadores
  const players = await identificarJogadores(provider)

  if (players.length === 0) {
    console.log("ℹ️ Nenhum jogador encontrado no contrato antigo")
    return
  }

  // Passo 2: Verificar saldos no intermediário
  const playersWithCredits = await verificarSaldosIntermediario(provider, players)

  if (playersWithCredits.length === 0) {
    console.log("ℹ️ Nenhum jogador com créditos no contrato intermediário")
    return
  }

  // Passo 3: Validar contrato novo
  const isValid = await validarContratoNovo(provider, wallet)
  if (!isValid) {
    console.error("❌ Validação do contrato novo falhou. Abortando.")
    process.exit(1)
  }

  // Dry-run ou execução real
  if (isDryRun) {
    const dryRunResults = await dryRun(provider, playersWithCredits)
    console.log("")
    console.log("=".repeat(80))
    console.log("DRY-RUN CONCLUÍDO")
    console.log("=".repeat(80))
    console.log("")
    console.log("Para executar a migração real, execute:")
    console.log("   node scripts/migrate-credits-complete.js")
    console.log("")
  } else {
    // Confirmar execução
    console.log("")
    console.log("⚠️  ATENÇÃO: Você está prestes a executar a migração REAL!")
    console.log(`   ${playersWithCredits.length} jogadores serão migrados`)
    console.log("")
    console.log("Pressione Ctrl+C para cancelar ou aguarde 5 segundos...")
    console.log("")

    await new Promise(resolve => setTimeout(resolve, 5000))

    // Executar dry-run primeiro para mostrar o que será migrado
    const dryRunResults = await dryRun(provider, playersWithCredits)

    if (dryRunResults.toMigrate.length === 0) {
      console.log("ℹ️ Todos os jogadores já foram migrados. Nada a fazer.")
      return
    }

    console.log("")
    console.log("Iniciando migração em 3 segundos...")
    await new Promise(resolve => setTimeout(resolve, 3000))

    // Passo 4: Executar migração
    const results = await executarMigracao(provider, wallet, dryRunResults.toMigrate)

    // Passo 5: Gerar relatório
    gerarRelatorioFinal(results, dryRunResults)
  }
}

main().catch(error => {
  console.error("❌ Erro fatal:", error)
  process.exit(1)
})

