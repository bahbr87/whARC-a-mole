import { JsonRpcProvider, Contract } from "ethers"
import * as dotenv from "dotenv"
import * as path from "path"

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), ".env.local") })

const RPC_URL = process.env.RPC_URL || "https://rpc.testnet.arc.network"
const CHAIN_ID = parseInt(process.env.CHAIN_ID || "5042002")
const GAME_CREDITS_ADDRESS = process.env.GAME_CREDITS_ADDRESS || process.env.NEXT_PUBLIC_GAME_CREDITS_ADDRESS || "0xB6EF59882778d0A245202F1482f20f02ad82bd87"
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY || ""

async function main() {
  console.log("=".repeat(60))
  console.log("VERIFICANDO SE TRANSAÇÕES ESTÃO SENDO GERADAS")
  console.log("=".repeat(60))

  if (!RELAYER_PRIVATE_KEY) {
    console.error("❌ RELAYER_PRIVATE_KEY não configurado no .env.local")
    console.error("   Configure o relayer primeiro!")
    process.exit(1)
  }

  const provider = new JsonRpcProvider(RPC_URL, CHAIN_ID)

  console.log(`\n📋 Configuração:`)
  console.log(`   RPC: ${RPC_URL}`)
  console.log(`   Chain ID: ${CHAIN_ID}`)
  console.log(`   GameCredits: ${GAME_CREDITS_ADDRESS}`)
  console.log(`   Explorer: https://testnet.arcscan.app`)

  // GameCredits ABI
  const GAME_CREDITS_ABI = [
    "event CreditsConsumed(address indexed player, uint256 clickCount, uint256 timestamp)",
    "function credits(address) external view returns (uint256)",
  ]

  try {
    const gameCreditsContract = new Contract(
      GAME_CREDITS_ADDRESS,
      GAME_CREDITS_ABI,
      provider
    )

    // Get relayer address from private key
    const { Wallet } = await import("ethers")
    const relayerWallet = new Wallet(RELAYER_PRIVATE_KEY)
    const relayerAddress = relayerWallet.address
    
    console.log(`\n🔍 Verificando transações do relayer...`)
    console.log(`   Relayer Address: ${relayerAddress}`)
    
    // Get latest block
    const latestBlock = await provider.getBlockNumber()
    console.log(`   Último bloco: ${latestBlock}`)
    
    // Try to get transactions from relayer address (check last 1000 blocks)
    const fromBlock = Math.max(0, latestBlock - 1000)
    console.log(`   Verificando blocos ${fromBlock} a ${latestBlock}...`)

    try {
      // Try to get events first
      const filter = gameCreditsContract.filters.CreditsConsumed()
      const events = await gameCreditsContract.queryFilter(filter, fromBlock, latestBlock)
      
      if (events.length > 0) {
        console.log(`\n✅ Encontradas ${events.length} transação(ões) via eventos:`)
        console.log("")
        
        for (let i = 0; i < Math.min(events.length, 10); i++) {
          const event = events[i]
          const block = await provider.getBlock(event.blockNumber)
          const timestamp = new Date(Number(block.timestamp) * 1000).toLocaleString()
          
          console.log(`   Transação ${i + 1}:`)
          console.log(`      Hash: ${event.transactionHash}`)
          console.log(`      Bloco: ${event.blockNumber}`)
          console.log(`      Timestamp: ${timestamp}`)
          console.log(`      Player: ${event.args?.player || "N/A"}`)
          console.log(`      Clicks: ${event.args?.clickCount?.toString() || "N/A"}`)
          console.log(`      Explorer: https://testnet.arcscan.app/tx/${event.transactionHash}`)
          console.log("")
        }
        
        if (events.length > 10) {
          console.log(`   ... e mais ${events.length - 10} transação(ões)`)
        }
      } else {
        console.log(`\n⚠️  Nenhum evento encontrado nos últimos 1000 blocos`)
        console.log(`   Isso pode significar:`)
        console.log(`   1. Nenhum clique foi feito ainda`)
        console.log(`   2. O contrato não está emitindo eventos`)
        console.log(`   3. As transações estão em blocos mais antigos`)
        console.log(`\n💡 Verifique manualmente no explorer:`)
        console.log(`   https://testnet.arcscan.app/address/${relayerAddress}`)
      }
    } catch (error: any) {
      console.warn(`⚠️  Não foi possível buscar eventos:`)
      console.warn(`   ${error.message}`)
      console.log(`\n💡 Verifique manualmente no explorer:`)
      console.log(`   https://testnet.arcscan.app/address/${relayerAddress}`)
    }

    console.log(`\n💡 Como verificar manualmente:`)
    console.log(`   1. Jogue uma partida e clique nos animais`)
    console.log(`   2. Verifique os logs do servidor - você verá:`)
    console.log(`      "✅ TRANSACTION CONFIRMED"`)
    console.log(`      "Hash: 0x..."`)
    console.log(`   3. Copie o hash e verifique no explorer:`)
    console.log(`      https://testnet.arcscan.app/tx/[HASH]`)
    console.log(`   4. Ou verifique o endereço do relayer:`)
    console.log(`      https://testnet.arcscan.app/address/0xA6338636D92e024dBC3541524E332F68c5c811a2`)

  } catch (error: any) {
    console.error(`\n❌ Erro ao verificar:`)
    console.error(`   ${error.message}`)
    process.exit(1)
  }
}

main().catch((error) => {
  console.error("Fatal error:", error)
  process.exit(1)
})

