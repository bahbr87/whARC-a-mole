import { JsonRpcProvider, Contract, Wallet } from "ethers"
import dotenv from "dotenv"
import path from "path"

dotenv.config({ path: path.join(process.cwd(), ".env.local") })

const RPC_URL = process.env.RPC_URL || "https://rpc.testnet.arc.network"
const OWNER_PRIVATE_KEY = process.env.PRIZE_POOL_OWNER_PRIVATE_KEY
const PRIZE_POOL_ADDRESS = "0x61964Cc8Cea0bfC601edC75B1d4Cbb7900a19962" // Novo PrizePool
const USDC_ADDRESS = "0x3600000000000000000000000000000000000000" // Official Arc Testnet USDC

// Amount to transfer (in USDC with 6 decimals)
// You can adjust this value
const AMOUNT_TO_TRANSFER = 700e6 // 700 USDC

const USDC_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
]

async function fundNewPrizePool() {
  console.log("=".repeat(70))
  console.log("💰 TRANSFERINDO USDC PARA O NOVO PRIZEPOOL")
  console.log("=".repeat(70))
  console.log("")

  if (!OWNER_PRIVATE_KEY) {
    console.error("❌ PRIZE_POOL_OWNER_PRIVATE_KEY não configurado no .env.local")
    process.exit(1)
  }

  try {
    const provider = new JsonRpcProvider(RPC_URL)
    const ownerWallet = new Wallet(OWNER_PRIVATE_KEY, provider)
    const ownerAddress = ownerWallet.address

    console.log(`👤 Owner wallet: ${ownerAddress}`)
    console.log(`📍 Novo PrizePool: ${PRIZE_POOL_ADDRESS}`)
    console.log(`💵 USDC Address: ${USDC_ADDRESS}`)
    console.log("")

    // Check USDC info
    const usdc = new Contract(USDC_ADDRESS, USDC_ABI, provider)
    const decimals = await usdc.decimals()
    const symbol = await usdc.symbol()

    console.log(`📊 Informações do USDC:`)
    console.log(`   Símbolo: ${symbol}`)
    console.log(`   Decimais: ${decimals}`)
    console.log("")

    // Check owner's USDC balance
    const ownerBalanceRaw = await usdc.balanceOf(ownerAddress)
    const ownerBalance = Number(ownerBalanceRaw) / (10 ** Number(decimals))

    console.log(`💰 Saldo do owner: ${ownerBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${symbol}`)
    console.log(`   Raw: ${ownerBalanceRaw.toString()}`)
    console.log("")

    if (ownerBalanceRaw < BigInt(AMOUNT_TO_TRANSFER)) {
      console.error(`❌ Saldo insuficiente!`)
      console.error(`   Necessário: ${AMOUNT_TO_TRANSFER / 1e6} ${symbol}`)
      console.error(`   Disponível: ${ownerBalance} ${symbol}`)
      process.exit(1)
    }

    // Check current PrizePool balance
    const prizePoolBalanceRaw = await usdc.balanceOf(PRIZE_POOL_ADDRESS)
    const prizePoolBalance = Number(prizePoolBalanceRaw) / (10 ** Number(decimals))

    console.log(`💰 Saldo atual do PrizePool: ${prizePoolBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${symbol}`)
    console.log(`   Raw: ${prizePoolBalanceRaw.toString()}`)
    console.log("")

    // Transfer USDC
    console.log(`📤 Transferindo ${AMOUNT_TO_TRANSFER / 1e6} ${symbol} para o PrizePool...`)
    const usdcWithSigner = new Contract(USDC_ADDRESS, USDC_ABI, ownerWallet)
    
    const tx = await usdcWithSigner.transfer(PRIZE_POOL_ADDRESS, BigInt(AMOUNT_TO_TRANSFER))
    console.log(`✅ Transação enviada: ${tx.hash}`)
    console.log(`   Explorer: https://testnet.arcscan.app/tx/${tx.hash}`)
    console.log("")
    console.log("⏳ Aguardando confirmação...")

    const receipt = await tx.wait()
    console.log(`✅ Transação confirmada no bloco: ${receipt.blockNumber}`)
    console.log(`   Gas usado: ${receipt.gasUsed.toString()}`)
    console.log("")

    // Check new PrizePool balance
    const newPrizePoolBalanceRaw = await usdc.balanceOf(PRIZE_POOL_ADDRESS)
    const newPrizePoolBalance = Number(newPrizePoolBalanceRaw) / (10 ** Number(decimals))

    console.log(`💰 Novo saldo do PrizePool: ${newPrizePoolBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${symbol}`)
    console.log(`   Raw: ${newPrizePoolBalanceRaw.toString()}`)
    console.log("")

    // Check new owner balance
    const newOwnerBalanceRaw = await usdc.balanceOf(ownerAddress)
    const newOwnerBalance = Number(newOwnerBalanceRaw) / (10 ** Number(decimals))

    console.log(`💰 Novo saldo do owner: ${newOwnerBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${symbol}`)
    console.log(`   Raw: ${newOwnerBalanceRaw.toString()}`)
    console.log("")

    console.log("=".repeat(70))
    console.log("✅ TRANSFERÊNCIA CONCLUÍDA COM SUCESSO!")
    console.log("=".repeat(70))
    console.log("")
    console.log(`📍 PrizePool: ${PRIZE_POOL_ADDRESS}`)
    console.log(`💰 Saldo: ${newPrizePoolBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${symbol}`)
    console.log(`🔗 Explorer: https://testnet.arcscan.app/address/${PRIZE_POOL_ADDRESS}`)
    console.log("")

  } catch (error: any) {
    console.error("❌ Erro:", error.message)
    if (error.reason) {
      console.error("   Reason:", error.reason)
    }
    if (error.transaction) {
      console.error("   Transaction:", error.transaction)
    }
    console.error(error)
    process.exit(1)
  }
}

fundNewPrizePool().catch(console.error)
