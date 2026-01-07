import { ethers } from "ethers"

const RPC_URL = "https://rpc.testnet.arc.network"
const CHAIN_ID = 5042002
const INTERMEDIARY_CONTRACT = "0x41Afb27763416f555207c9B0bB04F08E665b4AFd"

const ABI = [
  "function credits(address player) view returns (uint256)",
]

// Alguns endereços para testar (você pode adicionar o seu)
const TEST_ADDRESSES = [
  "0xB51158878a08a860443B10b2F24617bab5F1F3eA", // Endereço que você mencionou antes
]

async function main() {
  console.log("=".repeat(70))
  console.log("TESTE DIRETO - CONTRATO INTERMEDIÁRIO")
  console.log("=".repeat(70))
  console.log(`Contrato: ${INTERMEDIARY_CONTRACT}`)
  console.log("")

  const provider = new ethers.JsonRpcProvider(RPC_URL, CHAIN_ID)
  const contract = new ethers.Contract(INTERMEDIARY_CONTRACT, ABI, provider)

  // Testar se o contrato responde
  console.log("🔍 Testando se o contrato responde...")
  try {
    // Tentar ler o código do contrato
    const code = await provider.getCode(INTERMEDIARY_CONTRACT)
    if (code === "0x") {
      console.log("❌ Contrato não existe ou não tem código!")
      return
    }
    console.log("✅ Contrato existe e tem código")
    console.log("")

    // Testar alguns endereços
    console.log("🔍 Verificando saldos de endereços de teste...")
    for (const address of TEST_ADDRESSES) {
      try {
        const balance = await contract.credits(address)
        const balanceNum = Number(balance)
        console.log(`   ${address}: ${balanceNum} créditos`)
        if (balanceNum > 0) {
          console.log(`   ✅ ENCONTRADO! ${balanceNum} créditos`)
        }
      } catch (error) {
        console.log(`   ${address}: Erro - ${error.message}`)
      }
    }

    // Tentar buscar eventos desde o início
    console.log("")
    console.log("🔍 Buscando TODOS os eventos desde o início...")
    const currentBlock = await provider.getBlockNumber()
    
    // Tentar encontrar o block de deploy (verificar transações do contrato)
    console.log(`   Block atual: ${currentBlock}`)
    console.log(`   Buscando eventos desde block 0 até ${currentBlock}...`)
    console.log("   (Isso pode demorar...)")
    
    const filter = contract.filters.CreditsPurchased?.() || null
    if (!filter) {
      console.log("   ⚠️ Não foi possível criar filtro de eventos")
      return
    }

    // Buscar em chunks menores
    const CHUNK_SIZE = 5000
    let totalEvents = 0
    let fromBlock = 0
    let toBlock = Math.min(CHUNK_SIZE, currentBlock)
    let foundAny = false

    while (fromBlock <= currentBlock) {
      try {
        const events = await contract.queryFilter(filter, fromBlock, toBlock)
        if (events.length > 0) {
          foundAny = true
          totalEvents += events.length
          console.log(`   ✅ Encontrados ${events.length} eventos nos blocos ${fromBlock}-${toBlock}`)
          
          // Mostrar os primeiros eventos
          events.slice(0, 5).forEach((event, i) => {
            const player = event.args.player
            console.log(`      ${i + 1}. Player: ${player}`)
          })
        }
        fromBlock = toBlock + 1
        toBlock = Math.min(fromBlock + CHUNK_SIZE, currentBlock)
        if (fromBlock % 50000 === 0) {
          process.stdout.write(`   Processados blocos até ${fromBlock}...\r`)
        }
      } catch (error) {
        if (error.message.includes("eth_getLogs is limited")) {
          // Chunk muito grande, reduzir
          toBlock = Math.min(fromBlock + 1000, currentBlock)
          continue
        }
        console.error(`   ⚠️ Erro nos blocos ${fromBlock}-${toBlock}: ${error.message}`)
        fromBlock = toBlock + 1
        toBlock = Math.min(fromBlock + CHUNK_SIZE, currentBlock)
      }
    }

    console.log("")
    if (foundAny) {
      console.log(`✅ Total de eventos encontrados: ${totalEvents}`)
    } else {
      console.log("ℹ️ Nenhum evento encontrado em todo o histórico")
    }

  } catch (error) {
    console.error("❌ Erro:", error.message)
  }
}

main().catch(console.error)

