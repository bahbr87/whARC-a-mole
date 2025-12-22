/**
 * Script para transferir USDC da conta principal para o PrizePool
 * 
 * Uso:
 *   npx tsx scripts/transfer-usdc-to-prizepool.ts [amount]
 * 
 * Exemplo:
 *   npx tsx scripts/transfer-usdc-to-prizepool.ts 700
 *   (transfere 700 USDC)
 * 
 * Se não especificar o valor, pede interativamente
 */

import * as dotenv from "dotenv"
import * as path from "path"
import { ethers } from "ethers"
import * as readline from "readline"

dotenv.config({ path: path.join(process.cwd(), ".env.local") })

// Configuração
const RPC_URL = process.env.RPC_URL || process.env.ARC_RPC_URL || "https://rpc.testnet.arc.network"
const OWNER_PRIVATE_KEY = process.env.PRIZE_POOL_OWNER_PRIVATE_KEY || process.env.OWNER_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY
const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_CONTRACT_ADDRESS || process.env.USDC_CONTRACT_ADDRESS || "0x3600000000000000000000000000000000000000"
const PRIZE_POOL_ADDRESS = process.env.NEXT_PUBLIC_PRIZE_POOL_CONTRACT_ADDRESS || process.env.PRIZE_POOL_CONTRACT_ADDRESS

const ERC20_ABI = [
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
]

async function askAmount(): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    rl.question("💰 Quantos USDC deseja transferir? ", (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

async function main() {
  console.log("=".repeat(60))
  console.log("TRANSFERIR USDC PARA PRIZE POOL")
  console.log("=".repeat(60))

  // Validação de variáveis de ambiente
  if (!OWNER_PRIVATE_KEY) {
    console.error("❌ ERRO: PRIZE_POOL_OWNER_PRIVATE_KEY ou OWNER_PRIVATE_KEY não encontrado no .env.local")
    process.exit(1)
  }

  if (!PRIZE_POOL_ADDRESS) {
    console.error("❌ ERRO: NEXT_PUBLIC_PRIZE_POOL_CONTRACT_ADDRESS não encontrado no .env.local")
    process.exit(1)
  }

  // Obter valor a transferir e flag de confirmação
  const amountArg = process.argv[2]
  const skipConfirmation = process.argv.includes("--yes") || process.argv.includes("-y")
  let amountStr: string

  if (amountArg) {
    amountStr = amountArg
  } else {
    amountStr = await askAmount()
  }

  const amount = parseFloat(amountStr)
  if (isNaN(amount) || amount <= 0) {
    console.error("❌ ERRO: Valor inválido. Deve ser um número maior que 0.")
    process.exit(1)
  }

  console.log("\n📋 Configuração:")
  console.log("   RPC URL:", RPC_URL)
  console.log("   USDC Address:", USDC_ADDRESS)
  console.log("   PrizePool Address:", PRIZE_POOL_ADDRESS)
  console.log("   Valor:", amount, "USDC\n")

  // Conectar à rede
  const provider = new ethers.JsonRpcProvider(RPC_URL)
  const wallet = new ethers.Wallet(OWNER_PRIVATE_KEY, provider)

  console.log("👤 Wallet:", wallet.address)

  // Conectar ao contrato USDC
  const usdcContract = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, wallet)

  // Obter informações do token
  let decimals = 6 // Default para USDC
  try {
    decimals = await usdcContract.decimals()
  } catch (error) {
    console.log("⚠️  Não foi possível obter decimals, usando 6 (padrão USDC)")
  }

  const symbol = await usdcContract.symbol().catch(() => "USDC")
  const amountInWei = ethers.parseUnits(amount.toString(), decimals)

  // Verificar saldos antes
  console.log("\n🔎 Verificando saldos...")
  const ownerBalanceBefore = await usdcContract.balanceOf(wallet.address)
  const prizePoolBalanceBefore = await usdcContract.balanceOf(PRIZE_POOL_ADDRESS)

  console.log("   Conta principal:", ethers.formatUnits(ownerBalanceBefore, decimals), symbol)
  console.log("   PrizePool:", ethers.formatUnits(prizePoolBalanceBefore, decimals), symbol)

  // Verificar se tem saldo suficiente
  if (ownerBalanceBefore < amountInWei) {
    console.error(
      `\n❌ ERRO: Saldo insuficiente!`
    )
    console.error(`   Você tem: ${ethers.formatUnits(ownerBalanceBefore, decimals)} ${symbol}`)
    console.error(`   Precisa: ${ethers.formatUnits(amountInWei, decimals)} ${symbol}`)
    process.exit(1)
  }

  // Confirmar transferência (pular se --yes ou -y for passado)
  console.log(`\n⚠️  Você está prestes a transferir ${amount} ${symbol} para o PrizePool`)
  console.log("   Endereço do PrizePool:", PRIZE_POOL_ADDRESS)

  if (!skipConfirmation) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })

    const confirm = await new Promise<string>((resolve) => {
      rl.question("\n❓ Confirmar transferência? (sim/não): ", (answer) => {
        rl.close()
        resolve(answer.trim().toLowerCase())
      })
    })

    if (confirm !== "sim" && confirm !== "s" && confirm !== "yes" && confirm !== "y") {
      console.log("\n❌ Transferência cancelada.")
      process.exit(0)
    }
  } else {
    console.log("\n✅ Confirmação automática (--yes flag usado)")
  }

  // Executar transferência
  console.log("\n💸 Transferindo USDC para PrizePool...")
  try {
    const tx = await usdcContract.transfer(PRIZE_POOL_ADDRESS, amountInWei)
    console.log("   📤 Transaction hash:", tx.hash)
    console.log("   ⏳ Aguardando confirmação...")

    const receipt = await tx.wait()
    console.log("   ✅ Transferência confirmada!")
    console.log("   🔗 Explorer:", `https://testnet.arcscan.app/tx/${tx.hash}`)

    // Verificar saldos depois
    console.log("\n🔎 Saldos após transferência:")
    const ownerBalanceAfter = await usdcContract.balanceOf(wallet.address)
    const prizePoolBalanceAfter = await usdcContract.balanceOf(PRIZE_POOL_ADDRESS)

    console.log("   Conta principal:", ethers.formatUnits(ownerBalanceAfter, decimals), symbol)
    console.log("   PrizePool:", ethers.formatUnits(prizePoolBalanceAfter, decimals), symbol)

    // Calcular quantos dias de prêmios isso cobre
    const dailyPrizeTotal = ethers.parseUnits("35", decimals) // 20 + 10 + 5 = 35 USDC por dia
    const daysCovered = Number(prizePoolBalanceAfter) / Number(dailyPrizeTotal)
    console.log(`\n📅 O PrizePool agora cobre aproximadamente ${Math.floor(daysCovered)} dias de prêmios (35 USDC por dia)`)

    console.log("\n✅ Transferência concluída com sucesso!")
  } catch (error: any) {
    console.error("\n❌ ERRO na transferência:", error.message)
    if (error.transaction) {
      console.error("   Transaction hash:", error.transaction.hash)
    }
    process.exit(1)
  }
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error("\n❌ Erro fatal:", error)
    process.exit(1)
  })

