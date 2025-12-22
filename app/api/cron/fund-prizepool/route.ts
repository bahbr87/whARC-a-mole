import { NextRequest, NextResponse } from "next/server"
import { JsonRpcProvider, Contract, Wallet } from "ethers"

/**
 * ✅ API Route para execução automática de funding do PrizePool
 * 
 * Transfere 300 USDC da conta principal para o PrizePool
 * 
 * Pode ser chamada por:
 * - Vercel Cron Jobs
 * - GitHub Actions
 * - Serviços externos de agendamento
 * 
 * Para proteger, use um secret token:
 * ?token=SEU_SECRET_TOKEN
 * 
 * Também pode especificar o valor:
 * ?amount=300
 */
export async function GET(request: NextRequest) {
  try {
    // Verificar token de segurança (opcional, mas recomendado)
    const { searchParams } = new URL(request.url)
    const token = searchParams.get("token")
    const expectedToken = process.env.CRON_SECRET_TOKEN

    if (expectedToken && token !== expectedToken) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Obter valor a transferir (padrão: 300 USDC)
    const amountParam = searchParams.get("amount")
    const amount = amountParam ? parseFloat(amountParam) : 300

    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Invalid amount. Must be a positive number." },
        { status: 400 }
      )
    }

    console.log(`🚀 [CRON] Iniciando funding automático do PrizePool`)
    console.log(`💰 Valor: ${amount} USDC`)

    // Configuração
    const RPC_URL = process.env.RPC_URL || process.env.ARC_RPC_URL || "https://rpc.testnet.arc.network"
    const OWNER_PRIVATE_KEY = process.env.PRIZE_POOL_OWNER_PRIVATE_KEY || process.env.OWNER_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY
    const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_CONTRACT_ADDRESS || process.env.USDC_CONTRACT_ADDRESS || "0x3600000000000000000000000000000000000000"
    const PRIZE_POOL_ADDRESS = process.env.NEXT_PUBLIC_PRIZE_POOL_CONTRACT_ADDRESS || process.env.PRIZE_POOL_CONTRACT_ADDRESS

    if (!OWNER_PRIVATE_KEY) {
      return NextResponse.json(
        {
          success: false,
          error: "PRIZE_POOL_OWNER_PRIVATE_KEY not configured",
        },
        { status: 500 }
      )
    }

    if (!PRIZE_POOL_ADDRESS) {
      return NextResponse.json(
        {
          success: false,
          error: "PRIZE_POOL_CONTRACT_ADDRESS not configured",
        },
        { status: 500 }
      )
    }

    const ERC20_ABI = [
      "function transfer(address to, uint256 amount) external returns (bool)",
      "function balanceOf(address account) view returns (uint256)",
      "function decimals() view returns (uint8)",
      "function symbol() view returns (string)",
    ]

    // Conectar à rede
    const provider = new JsonRpcProvider(RPC_URL)
    const wallet = new Wallet(OWNER_PRIVATE_KEY, provider)

    console.log(`👤 Wallet: ${wallet.address}`)
    console.log(`🏆 PrizePool: ${PRIZE_POOL_ADDRESS}`)

    // Conectar ao contrato USDC
    const usdcContract = new Contract(USDC_ADDRESS, ERC20_ABI, wallet)

    // Obter informações do token
    let decimals = 6 // Default para USDC
    try {
      decimals = await usdcContract.decimals()
    } catch (error) {
      console.log("⚠️  Não foi possível obter decimals, usando 6 (padrão USDC)")
    }

    const symbol = await usdcContract.symbol().catch(() => "USDC")
    const amountInWei = BigInt(Math.floor(amount * 10 ** decimals))

    // Verificar saldos antes
    console.log("🔎 Verificando saldos...")
    const ownerBalanceBefore = await usdcContract.balanceOf(wallet.address)
    const prizePoolBalanceBefore = await usdcContract.balanceOf(PRIZE_POOL_ADDRESS)

    console.log(`   Conta principal: ${Number(ownerBalanceBefore) / 10 ** decimals} ${symbol}`)
    console.log(`   PrizePool: ${Number(prizePoolBalanceBefore) / 10 ** decimals} ${symbol}`)

    // Verificar se tem saldo suficiente
    if (ownerBalanceBefore < amountInWei) {
      return NextResponse.json(
        {
          success: false,
          error: `Insufficient balance. Owner has ${Number(ownerBalanceBefore) / 10 ** decimals} ${symbol}, needs ${amount} ${symbol}`,
          ownerBalance: Number(ownerBalanceBefore) / 10 ** decimals,
          requiredAmount: amount,
        },
        { status: 400 }
      )
    }

    // Executar transferência
    console.log(`💸 Transferindo ${amount} ${symbol} para PrizePool...`)
    const tx = await usdcContract.transfer(PRIZE_POOL_ADDRESS, amountInWei)
    console.log(`   📤 Transaction hash: ${tx.hash}`)
    console.log("   ⏳ Aguardando confirmação...")

    const receipt = await tx.wait()
    console.log("   ✅ Transferência confirmada!")

    // Verificar saldos depois
    const ownerBalanceAfter = await usdcContract.balanceOf(wallet.address)
    const prizePoolBalanceAfter = await usdcContract.balanceOf(PRIZE_POOL_ADDRESS)

    // Calcular quantos dias de prêmios isso cobre
    const dailyPrizeTotal = BigInt(35 * 10 ** decimals) // 20 + 10 + 5 = 35 USDC por dia
    const daysCovered = Math.floor(Number(prizePoolBalanceAfter) / Number(dailyPrizeTotal))

    console.log(`📅 O PrizePool agora cobre aproximadamente ${daysCovered} dias de prêmios`)

    return NextResponse.json({
      success: true,
      message: `Successfully transferred ${amount} ${symbol} to PrizePool`,
      transactionHash: tx.hash,
      explorer: `https://testnet.arcscan.app/tx/${tx.hash}`,
      balances: {
        ownerBefore: Number(ownerBalanceBefore) / 10 ** decimals,
        ownerAfter: Number(ownerBalanceAfter) / 10 ** decimals,
        prizePoolBefore: Number(prizePoolBalanceBefore) / 10 ** decimals,
        prizePoolAfter: Number(prizePoolBalanceAfter) / 10 ** decimals,
      },
      daysCovered,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error("❌ [CRON] Error funding PrizePool:", error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}


