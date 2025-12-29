/**
 * Script para verificar se o relayer está autorizado no contrato GameCredits
 * 
 * Uso:
 *   npx tsx scripts/verify-relayer-authorization.ts [relayerAddress]
 */

import "dotenv/config"
import { ethers } from "ethers"
import { GAME_CREDITS_ADDRESS } from "../lib/arc-config"

const RPC_URL = process.env.RPC_URL || "https://rpc.testnet.arc.network"
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY

const GAME_CREDITS_ABI = [
  "function owner() view returns (address)",
  "function authorizedConsumers(address) view returns (bool)",
  "function credits(address) view returns (uint256)",
]

async function verifyRelayerAuthorization(relayerAddress?: string) {
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL)
    
    // Se não fornecido, tentar obter do RELAYER_PRIVATE_KEY
    let address = relayerAddress
    if (!address && RELAYER_PRIVATE_KEY) {
      const wallet = new ethers.Wallet(RELAYER_PRIVATE_KEY, provider)
      address = wallet.address
      console.log("🔑 Relayer address from RELAYER_PRIVATE_KEY:", address)
    }
    
    if (!address) {
      console.error("❌ Relayer address not provided and RELAYER_PRIVATE_KEY not configured")
      console.error("   Por favor, forneça o endereço do relayer como argumento:")
      console.error("   npx tsx scripts/verify-relayer-authorization.ts 0x...")
      process.exit(1)
    }

    const GAME_CREDITS_ADDRESS_FINAL = process.env.NEXT_PUBLIC_GAME_CREDITS_ADDRESS || GAME_CREDITS_ADDRESS

    console.log("🔍 Verificando autorização do relayer...")
    console.log("📍 Relayer Address:", address)
    console.log("📋 GameCredits Contract:", GAME_CREDITS_ADDRESS_FINAL)
    console.log("🌐 RPC:", RPC_URL)
    console.log()

    const contract = new ethers.Contract(GAME_CREDITS_ADDRESS_FINAL, GAME_CREDITS_ABI, provider)

    // Verificar owner
    const owner = await contract.owner()
    console.log("👤 Owner do contrato:", owner)
    console.log()

    // Verificar se o relayer está autorizado
    const isAuthorized = await contract.authorizedConsumers(address)
    console.log(`🔐 Relayer autorizado? ${isAuthorized ? "✅ SIM" : "❌ NÃO"}`)
    console.log()

    if (!isAuthorized) {
      console.error("❌ PROBLEMA ENCONTRADO: O relayer NÃO está autorizado!")
      console.error("   Isso significa que as transações de consumo de créditos vão falhar.")
      console.error()
      console.error("💡 SOLUÇÃO:")
      console.error("   O owner do contrato precisa autorizar o relayer chamando:")
      console.error(`   contract.authorizeConsumer("${address}")`)
      console.error()
      console.error("   Ou verifique se o endereço do relayer está correto.")
    } else {
      console.log("✅ Relayer está autorizado corretamente!")
    }

    // Verificar saldo de créditos de teste
    const testAddress = "0x650cCD684cAb88E05d1b4b5fF3627FA57EfE75E5"
    const testBalance = await contract.credits(testAddress)
    console.log()
    console.log(`📊 Saldo de teste (${testAddress}):`, testBalance.toString(), "créditos")

  } catch (error: any) {
    console.error("❌ Error:", error.message)
    if (error.data) {
      console.error("   Error data:", error.data)
    }
    process.exit(1)
  }
}

// Get relayer address from command line
const relayerAddress = process.argv[2]

verifyRelayerAuthorization(relayerAddress)
  .then(() => {
    console.log()
    console.log("✅ Verificação concluída!")
    process.exit(0)
  })
  .catch((error) => {
    console.error("❌ Error:", error)
    process.exit(1)
  })


