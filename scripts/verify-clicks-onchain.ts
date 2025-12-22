import { JsonRpcProvider, Contract, ethers } from "ethers"
import dotenv from "dotenv"
import path from "path"

dotenv.config({ path: path.join(process.cwd(), ".env.local") })

const RPC_URL = process.env.RPC_URL || "https://rpc.testnet.arc.network"
const CHAIN_ID = parseInt(process.env.CHAIN_ID || "5042002")
const GAME_CREDITS_ADDRESS = process.env.GAME_CREDITS_ADDRESS || process.env.NEXT_PUBLIC_GAME_CREDITS_ADDRESS || "0xB6EF59882778d0A245202F1482f20f02ad82bd87"

// GameCredits ABI - includes CreditsConsumed event
const GAME_CREDITS_ABI = [
  "event CreditsConsumed(address indexed player, uint256 clickCount, uint256 creditsUsed, uint256 remainingCredits)",
  "function credits(address) external view returns (uint256)",
] as const

async function verifyClicks(playerAddress?: string, minutes: number = 5) {
  console.log("=".repeat(70))
  console.log("🔍 VERIFICAÇÃO DE CLIQUES ON-CHAIN")
  console.log("=".repeat(70))
  console.log("")

  const provider = new JsonRpcProvider(RPC_URL, CHAIN_ID)
  const relayerAddress = typeof RELAYER_ADDRESS === "string" ? RELAYER_ADDRESS : await RELAYER_ADDRESS
  
  console.log(`📋 Configuração:`)
  console.log(`   RPC URL: ${RPC_URL}`)
  console.log(`   Chain ID: ${CHAIN_ID}`)
  console.log(`   GameCredits: ${GAME_CREDITS_ADDRESS}`)
  console.log(`   Relayer: ${relayerAddress}`)
  if (playerAddress) {
    console.log(`   Player: ${playerAddress}`)
  }
  console.log(`   Período: últimos ${minutes} minutos`)
  console.log("")

  const gameCreditsContract = new Contract(
    GAME_CREDITS_ADDRESS,
    GAME_CREDITS_ABI,
    provider
  )

  // Calculate time range
  const now = Math.floor(Date.now() / 1000)
  const startTime = now - (minutes * 60)
  const endBlock = await provider.getBlockNumber()
  
  // Estimate start block (approximate - 1 block per 2 seconds)
  const blocksPerSecond = 0.5
  const blocksToCheck = Math.ceil((minutes * 60) / blocksPerSecond)
  const startBlock = Math.max(1, endBlock - blocksToCheck)

    console.log(`📦 Verificando blocos ${startBlock} a ${endBlock}...`)
    console.log("")

    try {
      console.log("🔍 Buscando eventos CreditsConsumed...")
      
      // Get event signature
      const eventSignature = gameCreditsContract.interface.getEvent("CreditsConsumed")
      const eventTopic = ethers.id(`${eventSignature.name}(${eventSignature.inputs.map(i => i.type).join(",")})`)
      
      // Build topics filter
      const topics: (string | null)[] = [eventTopic]
      if (playerAddress) {
        // Add player address as second topic (indexed parameter)
        topics.push(ethers.zeroPadValue(playerAddress.toLowerCase(), 32))
      }
      
      const events = await provider.getLogs({
        address: GAME_CREDITS_ADDRESS,
        topics: topics,
        fromBlock: startBlock,
        toBlock: endBlock,
      })

    console.log(`✅ Encontrados ${events.length} eventos`)
    console.log("")

    if (events.length === 0) {
      console.log("⚠️  Nenhum clique encontrado no período especificado")
      console.log("")
      console.log("💡 Dicas:")
      console.log("   1. Verifique se você está jogando e clicando nos animais")
      console.log("   2. Verifique se o relayer está configurado corretamente")
      console.log("   3. Verifique se você tem créditos suficientes")
      console.log("   4. Tente aumentar o período de busca (ex: 10 minutos)")
      return
    }

    // Parse events
    const clicks: Array<{
      player: string
      clickCount: number
      creditsUsed: number
      remainingCredits: number
      blockNumber: number
      transactionHash: string
      timestamp: number
    }> = []

    for (const event of events) {
      try {
        const parsed = gameCreditsContract.interface.parseLog({
          topics: event.topics as string[],
          data: event.data,
        })

        if (parsed) {
          const block = await provider.getBlock(event.blockNumber)
          clicks.push({
            player: parsed.args.player.toLowerCase(),
            clickCount: Number(parsed.args.clickCount),
            creditsUsed: Number(parsed.args.creditsUsed),
            remainingCredits: Number(parsed.args.remainingCredits),
            blockNumber: event.blockNumber,
            transactionHash: event.transactionHash,
            timestamp: block?.timestamp || 0,
          })
        }
      } catch (error) {
        console.warn(`⚠️  Erro ao processar evento: ${event.transactionHash}`, error)
      }
    }

    // Filter by time if needed
    const recentClicks = clicks.filter(click => click.timestamp >= startTime)

    console.log(`📊 RESUMO:`)
    console.log(`   Total de cliques encontrados: ${recentClicks.length}`)
    console.log(`   Período: ${new Date(startTime * 1000).toLocaleString()} até ${new Date(now * 1000).toLocaleString()}`)
    console.log("")

    // Group by player
    const clicksByPlayer = new Map<string, typeof recentClicks>()
    for (const click of recentClicks) {
      if (!clicksByPlayer.has(click.player)) {
        clicksByPlayer.set(click.player, [])
      }
      clicksByPlayer.get(click.player)!.push(click)
    }

    console.log(`👥 Cliques por jogador:`)
    console.log("")
    for (const [player, playerClicks] of clicksByPlayer) {
      const totalClicks = playerClicks.reduce((sum, c) => sum + c.clickCount, 0)
      console.log(`   ${player}:`)
      console.log(`      Total de cliques: ${totalClicks}`)
      console.log(`      Transações: ${playerClicks.length}`)
      console.log(`      Créditos usados: ${playerClicks.reduce((sum, c) => sum + c.creditsUsed, 0)}`)
      console.log("")
    }

    console.log(`📝 ÚLTIMAS 10 TRANSAÇÕES:`)
    console.log("")
    const sortedClicks = recentClicks.sort((a, b) => b.blockNumber - a.blockNumber).slice(0, 10)
    for (const click of sortedClicks) {
      const time = new Date(click.timestamp * 1000).toLocaleString()
      console.log(`   📤 TX: ${click.transactionHash}`)
      console.log(`      Player: ${click.player}`)
      console.log(`      Cliques: ${click.clickCount}`)
      console.log(`      Créditos usados: ${click.creditsUsed}`)
      console.log(`      Créditos restantes: ${click.remainingCredits}`)
      console.log(`      Bloco: ${click.blockNumber}`)
      console.log(`      Horário: ${time}`)
      console.log(`      🔗 https://testnet.arcscan.app/tx/${click.transactionHash}`)
      console.log("")
    }

    console.log("=".repeat(70))
    console.log("✅ VERIFICAÇÃO CONCLUÍDA")
    console.log("=".repeat(70))
    console.log("")
    console.log("💡 Cada clique deve gerar uma transação on-chain")
    console.log("   Se você vê transações aqui, os cliques estão funcionando!")
    console.log("")

  } catch (error: any) {
    console.error("❌ Erro ao verificar cliques:", error.message)
    console.error("")
    console.error("💡 Verifique:")
    console.error("   1. RPC_URL está configurado corretamente")
    console.error("   2. GAME_CREDITS_ADDRESS está correto")
    console.error("   3. Você está conectado à rede Arc Testnet")
  }
}

// Get command line arguments
const args = process.argv.slice(2)
const playerAddress = args[0] || undefined
const minutes = parseInt(args[1] || "5")

if (playerAddress && !playerAddress.startsWith("0x")) {
  console.error("❌ Endereço inválido. Deve começar com 0x")
  process.exit(1)
}

verifyClicks(playerAddress, minutes).catch(console.error)

