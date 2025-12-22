import { JsonRpcProvider, Contract, Wallet } from "ethers"
import dotenv from "dotenv"
import path from "path"

dotenv.config({ path: path.join(process.cwd(), ".env.local") })

const RPC_URL = process.env.RPC_URL || "https://rpc.testnet.arc.network"
const CHAIN_ID = parseInt(process.env.CHAIN_ID || "5042002")
const PRIZE_POOL_ADDRESS = process.env.NEXT_PUBLIC_PRIZE_POOL_CONTRACT_ADDRESS || process.env.PRIZE_POOL_CONTRACT_ADDRESS || "0xeA0df70040E77a821b14770E53aa577A745930ae"
const OWNER_PRIVATE_KEY = process.env.PRIZE_POOL_OWNER_PRIVATE_KEY

const PRIZE_POOL_ABI = [
  "function owner() view returns (address)",
  "function getWinner(uint256 day, uint8 rank) view returns (address)",
  "function dailyWinners(uint256 day, uint8 rank) view returns (address)",
]

async function verifyConfig() {
  console.log("=".repeat(70))
  console.log("🔍 VERIFICAÇÃO DE CONFIGURAÇÃO DO PRIZE POOL")
  console.log("=".repeat(70))
  console.log("")

  // 1. Verificar PRIZE_POOL_OWNER_PRIVATE_KEY
  console.log("1️⃣ Verificando PRIZE_POOL_OWNER_PRIVATE_KEY...")
  if (!OWNER_PRIVATE_KEY) {
    console.log("❌ PRIZE_POOL_OWNER_PRIVATE_KEY não está configurado no .env.local")
    console.log("")
    console.log("💡 Solução:")
    console.log("   Adicione PRIZE_POOL_OWNER_PRIVATE_KEY=0x... no arquivo .env.local")
    console.log("")
  } else {
    try {
      const wallet = new Wallet(OWNER_PRIVATE_KEY)
      console.log("✅ PRIZE_POOL_OWNER_PRIVATE_KEY está configurado")
      console.log(`   Wallet address: ${wallet.address}`)
      console.log("")

      // 2. Verificar se a wallet é owner do contrato
      console.log("2️⃣ Verificando se a wallet é owner do contrato...")
      const provider = new JsonRpcProvider(RPC_URL, CHAIN_ID)
      const contract = new Contract(PRIZE_POOL_ADDRESS, PRIZE_POOL_ABI, provider)

      try {
        const contractOwner = await contract.owner()
        console.log(`   Contrato: ${PRIZE_POOL_ADDRESS}`)
        console.log(`   Owner do contrato: ${contractOwner}`)
        console.log(`   Wallet configurada: ${wallet.address}`)

        if (contractOwner.toLowerCase() === wallet.address.toLowerCase()) {
          console.log("✅ A wallet configurada É a owner do contrato")
        } else {
          console.log("❌ A wallet configurada NÃO é a owner do contrato")
          console.log("")
          console.log("💡 Solução:")
          console.log(`   Use a private key da wallet ${contractOwner} no PRIZE_POOL_OWNER_PRIVATE_KEY`)
        }
      } catch (error: any) {
        console.log("⚠️ Erro ao verificar owner do contrato:", error.message)
        console.log("   Pode ser que o contrato não tenha a função owner()")
      }
      console.log("")

      // 3. Verificar saldo da wallet
      console.log("3️⃣ Verificando saldo da wallet...")
      try {
        const balance = await provider.getBalance(wallet.address)
        const balanceEth = Number(balance) / 1e18
        console.log(`   Saldo: ${balanceEth.toFixed(6)} ETH`)
        if (balanceEth < 0.001) {
          console.log("⚠️ Saldo baixo - pode não ter gas suficiente para transações")
        } else {
          console.log("✅ Saldo suficiente para transações")
        }
      } catch (error: any) {
        console.log("⚠️ Erro ao verificar saldo:", error.message)
      }
      console.log("")

    } catch (error: any) {
      console.log("❌ Erro ao processar PRIZE_POOL_OWNER_PRIVATE_KEY:", error.message)
      console.log("   Verifique se a chave privada está no formato correto (0x...)")
      console.log("")
    }
  }

  // 4. Verificar endereço do contrato
  console.log("4️⃣ Verificando endereço do contrato...")
  console.log(`   PRIZE_POOL_ADDRESS: ${PRIZE_POOL_ADDRESS}`)
  try {
    const provider = new JsonRpcProvider(RPC_URL, CHAIN_ID)
    const code = await provider.getCode(PRIZE_POOL_ADDRESS)
    if (code === "0x") {
      console.log("❌ Nenhum código encontrado neste endereço - contrato pode não estar deployado")
    } else {
      console.log("✅ Contrato encontrado neste endereço")
    }
  } catch (error: any) {
    console.log("⚠️ Erro ao verificar contrato:", error.message)
  }
  console.log("")

  // 5. Verificar RPC
  console.log("5️⃣ Verificando conexão RPC...")
  console.log(`   RPC_URL: ${RPC_URL}`)
  try {
    const provider = new JsonRpcProvider(RPC_URL, CHAIN_ID)
    const blockNumber = await provider.getBlockNumber()
    console.log(`✅ Conexão RPC OK - Block atual: ${blockNumber}`)
  } catch (error: any) {
    console.log("❌ Erro ao conectar ao RPC:", error.message)
  }
  console.log("")

  console.log("=".repeat(70))
}

verifyConfig().catch(console.error)



