import { ethers } from "ethers"
import * as dotenv from "dotenv"
import * as path from "path"

// Load environment variables
const envPath = path.join(process.cwd(), ".env.local")
dotenv.config({ path: envPath })

const RPC_URL = process.env.RPC_URL || "https://rpc.testnet.arc.network"
// Use MockUSDC from deployment.json if USDC_CONTRACT_ADDRESS is not set
const USDC_CONTRACT_ADDRESS = process.env.USDC_CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_USDC_CONTRACT_ADDRESS || "0x37225a0bC4bc9f2dAA06F535E7B8BC7AB03636c4"
const PRIZE_POOL_ADDRESS = process.env.PRIZE_POOL_CONTRACT_ADDRESS || "0xB98b8A9213072903277B9f592009E7C22acd2dd3"

// ERC20 ABI for balance checking
const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
]

// PrizePool ABI
const PRIZE_POOL_ABI = [
  "event PrizeClaimed(uint256 indexed date, uint256 indexed rank, address indexed winner, uint256 amount)",
  "function prizesClaimed(uint256 date, uint256 rank) view returns (bool)",
]

async function verifyClaimTransaction(walletAddress: string) {
  console.log("=".repeat(60))
  console.log("VERIFICANDO TRANSAÇÃO DE CLAIM")
  console.log("=".repeat(60))
  console.log(`Carteira: ${walletAddress}`)
  console.log(`PrizePool: ${PRIZE_POOL_ADDRESS}`)
  console.log(`USDC Contract: ${USDC_CONTRACT_ADDRESS}`)
  console.log()

  const provider = new ethers.JsonRpcProvider(RPC_URL)

  try {
    // 1. Verificar saldo atual de USDC da carteira
    console.log("1️⃣ Verificando saldo de USDC da carteira...")
    const usdcContract = new ethers.Contract(USDC_CONTRACT_ADDRESS, ERC20_ABI, provider)
    const balance = await usdcContract.balanceOf(walletAddress)
    const decimals = await usdcContract.decimals()
    const symbol = await usdcContract.symbol()
    const balanceFormatted = ethers.formatUnits(balance, decimals)
    console.log(`   Saldo atual: ${balanceFormatted} ${symbol}`)
    console.log()

    // 2. Verificar saldo do PrizePool
    console.log("2️⃣ Verificando saldo do PrizePool...")
    const prizePoolBalance = await usdcContract.balanceOf(PRIZE_POOL_ADDRESS)
    const prizePoolBalanceFormatted = ethers.formatUnits(prizePoolBalance, decimals)
    console.log(`   Saldo do PrizePool: ${prizePoolBalanceFormatted} ${symbol}`)
    console.log()

    // 3. Verificar eventos PrizeClaimed recentes
    console.log("3️⃣ Verificando eventos PrizeClaimed recentes...")
    const prizePoolContract = new ethers.Contract(PRIZE_POOL_ADDRESS, PRIZE_POOL_ABI, provider)
    
    // Buscar eventos dos últimos 1000 blocos
    const currentBlock = await provider.getBlockNumber()
    const fromBlock = Math.max(0, currentBlock - 1000)
    
    const filter = prizePoolContract.filters.PrizeClaimed(null, null, walletAddress)
    const events = await prizePoolContract.queryFilter(filter, fromBlock, currentBlock)
    
    if (events.length > 0) {
      console.log(`   ✅ Encontrados ${events.length} evento(s) de PrizeClaimed:`)
      events.forEach((event, index) => {
        const args = event.args as any
        const amount = ethers.formatUnits(args.amount, decimals)
        console.log(`   ${index + 1}. Data: ${args.date.toString()}, Rank: ${args.rank.toString()}, Valor: ${amount} ${symbol}`)
        console.log(`      Block: ${event.blockNumber}, Tx: ${event.transactionHash}`)
        console.log(`      Explorer: https://testnet.arcscan.app/tx/${event.transactionHash}`)
      })
    } else {
      console.log("   ⚠️  Nenhum evento PrizeClaimed encontrado para esta carteira")
    }
    console.log()

    // 4. Verificar transferências de USDC do PrizePool para a carteira
    console.log("4️⃣ Verificando transferências de USDC do PrizePool para a carteira...")
    const transferFilter = usdcContract.filters.Transfer(PRIZE_POOL_ADDRESS, walletAddress)
    const transfers = await usdcContract.queryFilter(transferFilter, fromBlock, currentBlock)
    
    if (transfers.length > 0) {
      console.log(`   ✅ Encontradas ${transfers.length} transferência(s):`)
      transfers.forEach((event, index) => {
        const args = event.args as any
        const amount = ethers.formatUnits(args.value, decimals)
        console.log(`   ${index + 1}. Valor: ${amount} ${symbol}`)
        console.log(`      Block: ${event.blockNumber}, Tx: ${event.transactionHash}`)
        console.log(`      Explorer: https://testnet.arcscan.app/tx/${event.transactionHash}`)
      })
    } else {
      console.log("   ⚠️  Nenhuma transferência encontrada do PrizePool para esta carteira")
    }
    console.log()

    // 5. Verificar transações recentes da carteira
    console.log("5️⃣ Verificando transações recentes da carteira...")
    const walletTransactions = await provider.getTransactionCount(walletAddress)
    console.log(`   Total de transações (nonce): ${walletTransactions}`)
    console.log()

    // Resumo
    console.log("=".repeat(60))
    console.log("RESUMO")
    console.log("=".repeat(60))
    if (events.length > 0 || transfers.length > 0) {
      console.log("✅ Transação de claim encontrada!")
      console.log(`   - Eventos PrizeClaimed: ${events.length}`)
      console.log(`   - Transferências do PrizePool: ${transfers.length}`)
      console.log(`   - Saldo atual: ${balanceFormatted} ${symbol}`)
    } else {
      console.log("❌ Nenhuma transação de claim encontrada")
      console.log("   A transação pode não ter sido executada ou pode ter falhado")
      console.log("   Verifique se:")
      console.log("   1. O claim foi feito através do contrato PrizePool")
      console.log("   2. A carteira estava conectada corretamente")
      console.log("   3. A transação foi confirmada no blockchain")
    }
    console.log()

  } catch (error: any) {
    console.error("❌ Erro ao verificar transação:", error.message)
    if (error.data) {
      console.error("   Dados do erro:", error.data)
    }
  }
}

// Executar verificação
const walletAddress = process.argv[2] || "0xB51158878a08a860443B10b2F24617bab5F1F3eA"

if (!ethers.isAddress(walletAddress)) {
  console.error("❌ Endereço de carteira inválido:", walletAddress)
  process.exit(1)
}

verifyClaimTransaction(walletAddress)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
