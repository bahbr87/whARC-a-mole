import { JsonRpcProvider, Contract, Wallet } from "ethers"
import dotenv from "dotenv"
import path from "path"

dotenv.config({ path: path.join(process.cwd(), ".env.local") })

const RPC_URL = process.env.RPC_URL || "https://rpc.testnet.arc.network"
const PRIZE_POOL_OLD_ADDRESS = "0xeA0df70040E77a821b14770E53aa577A745930ae"
const OWNER_PRIVATE_KEY = process.env.PRIZE_POOL_OWNER_PRIVATE_KEY
const USDC_ADDRESS = "0x3600000000000000000000000000000000000000"

// ABI do contrato antigo
const PRIZE_POOL_ABI = [
  "function withdraw(uint256 amount) external",
  "function owner() view returns (address)",
]

// USDC ABI
const USDC_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
]

async function withdrawFromOldPrizePool() {
  console.log("=".repeat(70))
  console.log("💰 WITHDRAW USDC DO CONTRATO ANTIGO")
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
    console.log(`📍 Contrato antigo: ${PRIZE_POOL_OLD_ADDRESS}`)
    console.log("")

    // Verificar se wallet é owner
    const prizePool = new Contract(PRIZE_POOL_OLD_ADDRESS, PRIZE_POOL_ABI, provider)
    const contractOwner = await prizePool.owner()
    
    if (contractOwner.toLowerCase() !== ownerAddress.toLowerCase()) {
      console.error(`❌ Wallet ${ownerAddress} não é o owner do contrato`)
      console.error(`   Owner do contrato: ${contractOwner}`)
      process.exit(1)
    }
    console.log(`✅ Wallet confirmada como owner do contrato`)
    console.log("")

    // Verificar saldo atual
    const usdc = new Contract(USDC_ADDRESS, USDC_ABI, provider)
    const decimals = await usdc.decimals()
    const balanceRaw = await usdc.balanceOf(PRIZE_POOL_OLD_ADDRESS)
    const balance = Number(balanceRaw) / Number(10n ** BigInt(decimals))
    
    console.log(`💰 Saldo atual no contrato: ${balance} USDC`)
    console.log(`   Raw: ${balanceRaw.toString()}`)
    console.log("")

    if (balanceRaw === 0n) {
      console.log("⚠️ Contrato não possui saldo para retirar")
      process.exit(0)
    }

    // Criar contrato com signer
    const prizePoolWithSigner = new Contract(PRIZE_POOL_OLD_ADDRESS, PRIZE_POOL_ABI, ownerWallet)

    // Executar withdraw
    const amount = 830000000n // 830 USDC com 6 decimais
    console.log(`📤 Executando withdraw(${amount.toString()})...`)
    console.log(`   Valor: ${Number(amount) / 1e6} USDC`)
    console.log("")

    const tx = await prizePoolWithSigner.withdraw(amount)
    console.log(`✅ Transação enviada: ${tx.hash}`)
    console.log(`   Explorer: https://testnet.arcscan.app/tx/${tx.hash}`)
    console.log("")
    console.log("⏳ Aguardando confirmação...")

    const receipt = await tx.wait()
    console.log(`✅ Transação confirmada no bloco: ${receipt.blockNumber}`)
    console.log(`   Gas usado: ${receipt.gasUsed.toString()}`)
    console.log("")

    // Verificar saldo após withdraw
    const balanceAfterRaw = await usdc.balanceOf(PRIZE_POOL_OLD_ADDRESS)
    const balanceAfter = Number(balanceAfterRaw) / Number(10n ** BigInt(decimals))
    
    console.log(`💰 Saldo após withdraw: ${balanceAfter} USDC`)
    console.log(`   Raw: ${balanceAfterRaw.toString()}`)
    console.log("")

    if (balanceAfterRaw === 0n) {
      console.log("✅ Todo o saldo foi retirado com sucesso!")
    } else {
      console.log(`⚠️ Ainda há ${balanceAfter} USDC no contrato`)
    }

    console.log("")
    console.log("=".repeat(70))
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

withdrawFromOldPrizePool().catch(console.error)



