import { Wallet, JsonRpcProvider, Contract } from "ethers"
import dotenv from "dotenv"
import path from "path"

dotenv.config({ path: path.join(process.cwd(), ".env.local") })

const RPC_URL = process.env.RPC_URL || "https://rpc.testnet.arc.network"
const CHAIN_ID = parseInt(process.env.CHAIN_ID || "5042002")
const GAME_CREDITS_ADDRESS = process.env.GAME_CREDITS_ADDRESS || process.env.NEXT_PUBLIC_GAME_CREDITS_ADDRESS || "0xB6EF59882778d0A245202F1482f20f02ad82bd87"
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY || ""

async function diagnose() {
  console.log("=".repeat(70))
  console.log("🔍 DIAGNÓSTICO DO RELAYER")
  console.log("=".repeat(70))
  console.log("")

  // Check if RELAYER_PRIVATE_KEY is configured
  if (!RELAYER_PRIVATE_KEY) {
    console.error("❌ PROBLEMA ENCONTRADO: RELAYER_PRIVATE_KEY não está configurado")
    console.error("")
    console.error("💡 SOLUÇÃO:")
    console.error("   1. Adicione RELAYER_PRIVATE_KEY no arquivo .env.local")
    console.error("   2. O relayer precisa ter USDC para pagar gas")
    console.error("   3. O relayer precisa ser autorizado como consumer no GameCredits")
    console.error("")
    process.exit(1)
  }

  console.log("✅ RELAYER_PRIVATE_KEY está configurado")
  console.log("")

  const provider = new JsonRpcProvider(RPC_URL, CHAIN_ID)
  const relayer = new Wallet(RELAYER_PRIVATE_KEY, provider)

  console.log(`📋 Configuração:`)
  console.log(`   RPC URL: ${RPC_URL}`)
  console.log(`   Chain ID: ${CHAIN_ID}`)
  console.log(`   GameCredits: ${GAME_CREDITS_ADDRESS}`)
  console.log(`   Relayer Address: ${relayer.address}`)
  console.log("")

  // Check relayer balance
  try {
    const balance = await provider.getBalance(relayer.address)
    console.log(`💰 Saldo do Relayer: ${balance.toString()} wei`)
    if (balance === 0n) {
      console.error("❌ PROBLEMA: Relayer não tem saldo!")
      console.error("")
      console.error("💡 SOLUÇÃO:")
      console.error(`   Funde o relayer (${relayer.address}) com USDC`)
      console.error("   Use o faucet: https://faucet.circle.com")
      console.error("")
    } else {
      console.log("✅ Relayer tem saldo")
    }
  } catch (error: any) {
    console.error("❌ Erro ao verificar saldo:", error.message)
  }
  console.log("")

  // Check authorization
  try {
    const GAME_CREDITS_ABI = [
      "function owner() external view returns (address)",
      "function authorizedConsumers(address) external view returns (bool)",
    ]

    const gameCreditsContract = new Contract(
      GAME_CREDITS_ADDRESS,
      GAME_CREDITS_ABI,
      provider
    )

    const owner = await gameCreditsContract.owner()
    const isOwner = owner.toLowerCase() === relayer.address.toLowerCase()
    const isAuthorized = await gameCreditsContract.authorizedConsumers(relayer.address)

    console.log(`🔍 Status de Autorização:`)
    console.log(`   Owner do Contrato: ${owner}`)
    console.log(`   Relayer é Owner: ${isOwner ? "✅ SIM" : "❌ NÃO"}`)
    console.log(`   Relayer está Autorizado: ${isAuthorized ? "✅ SIM" : "❌ NÃO"}`)
    console.log("")

    if (!isOwner && !isAuthorized) {
      console.error("❌ PROBLEMA: Relayer não está autorizado!")
      console.error("")
      console.error("💡 SOLUÇÃO:")
      if (isOwner) {
        console.error("   O relayer é owner, mas não está autorizado como consumer")
        console.error(`   Execute: authorizeConsumer(${relayer.address}) no contrato GameCredits`)
      } else {
        console.error(`   O relayer precisa ser autorizado pelo owner (${owner})`)
        console.error(`   Execute: authorizeConsumer(${relayer.address}) no contrato GameCredits`)
      }
      console.error("")
      console.error("   Ou execute o script:")
      console.error("   npx tsx scripts/authorize-relayer.ts")
      console.error("")
    } else {
      console.log("✅ Relayer está autorizado!")
    }
  } catch (error: any) {
    console.error("❌ Erro ao verificar autorização:", error.message)
    console.error("")
  }

  console.log("=".repeat(70))
  console.log("✅ DIAGNÓSTICO CONCLUÍDO")
  console.log("=".repeat(70))
}

diagnose().catch(console.error)



