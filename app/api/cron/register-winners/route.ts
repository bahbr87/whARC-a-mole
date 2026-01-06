import { NextRequest, NextResponse } from "next/server"
import { registerDailyWinners } from "@/lib/register-daily-winners"
import { getDayId } from "@/utils/day"
import { supabaseAdmin } from "@/lib/supabase"
import { JsonRpcProvider, Contract } from "ethers"

/**
 * ✅ API Route para execução automática do registro de vencedores
 * 
 * REGISTRA AUTOMATICAMENTE todos os dias pendentes que têm matches mas não foram finalizados
 * 
 * Comportamento:
 * - Se ?day=X for fornecido: registra apenas esse dia específico
 * - Se não: busca todos os dias pendentes e finaliza todos
 * 
 * Pode ser chamada por:
 * - Vercel Cron Jobs (executa diariamente às 00:00 UTC)
 * - GitHub Actions
 * - Serviços externos de agendamento
 * 
 * Para proteger, use um secret token:
 * ?token=SEU_SECRET_TOKEN
 * 
 * Também pode registrar um dia específico:
 * ?day=20443
 */
export async function GET(request: NextRequest) {
  try {
    // ✅ CORREÇÃO: Verificar token de segurança (opcional)
    const { searchParams } = new URL(request.url)
    const token = searchParams.get("token") || request.headers.get("authorization")?.replace("Bearer ", "")
    const expectedToken = process.env.CRON_SECRET_TOKEN

    if (expectedToken && token && token !== expectedToken) {
      console.warn(`[CRON] Unauthorized request - token mismatch`)
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }
    
    console.log(`[CRON] Register winners request received - token configured: ${!!expectedToken}`)

    // ✅ CORREÇÃO: Se day for fornecido, registrar apenas esse dia
    const dayParam = searchParams.get("day")
    if (dayParam) {
      const day = parseInt(dayParam)
      if (isNaN(day)) {
        return NextResponse.json(
          { error: "Invalid day parameter. Must be a number." },
          { status: 400 }
        )
      }
      console.log(`🚀 [CRON] Registering winners for specific day: ${day}`)
      
      const result = await registerDailyWinners(day)
      return formatResponse(result, day)
    }

    // ✅ CORREÇÃO: Buscar todos os dias pendentes e finalizar todos
    console.log(`🚀 [CRON] Finding all pending days to finalize...`)
    
    const pendingDays = await findPendingDays()
    console.log(`📋 [CRON] Found ${pendingDays.length} pending days:`, pendingDays)

    if (pendingDays.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No pending days to finalize",
        finalizedDays: [],
        timestamp: new Date().toISOString(),
      })
    }

    // Finalizar todos os dias pendentes
    const results: Array<{ day: number; success: boolean; message: string; error?: string }> = []
    
    for (const day of pendingDays) {
      console.log(`🔄 [CRON] Finalizing day ${day}...`)
      const result = await registerDailyWinners(day)
      
      results.push({
        day,
        success: result.success,
        message: result.success 
          ? (result.alreadyRegistered ? "Already registered" : "Registered successfully")
          : result.error || "Failed",
        error: result.error,
      })
      
      // Pequeno delay entre registros para evitar rate limiting
      if (pendingDays.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    const successful = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length

    return NextResponse.json({
      success: true,
      message: `Finalized ${successful} day(s), ${failed} failed`,
      results,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error("❌ [CRON] Error registering winners:", error)
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

/**
 * ✅ NOVA FUNÇÃO: Encontrar todos os dias pendentes
 * Busca todos os dias únicos que têm matches no Supabase mas não foram finalizados no contrato
 */
async function findPendingDays(): Promise<number[]> {
  try {
    // Buscar todos os dias únicos que têm matches no Supabase
    const { data: matches, error } = await supabaseAdmin
      .from("matches")
      .select("day, timestamp")
      .not("day", "is", null) // Apenas matches que têm o campo day preenchido

    if (error) {
      console.error("[CRON] Error fetching matches:", error)
      return []
    }

    if (!matches || matches.length === 0) {
      console.log("[CRON] No matches found in database")
      return []
    }

    // Extrair dias únicos
    const daysWithMatches = new Set<number>()
    const todayDay = getDayId()

    matches.forEach((match: any) => {
      let day: number
      
      if (match.day) {
        // Se tem campo day, usar diretamente
        day = match.day
      } else if (match.timestamp) {
        // Se não tem day, calcular do timestamp
        day = getDayId(new Date(match.timestamp))
      } else {
        return // Pular se não tem nem day nem timestamp
      }

      // Só incluir dias passados (não finalizar o dia atual)
      if (day < todayDay) {
        daysWithMatches.add(day)
      }
    })

    const uniqueDays = Array.from(daysWithMatches).sort((a, b) => a - b)
    console.log(`[CRON] Found ${uniqueDays.length} unique days with matches (before today):`, uniqueDays)

    // Verificar quais dias não foram finalizados no contrato
    const RPC_URL = process.env.RPC_URL || "https://rpc.testnet.arc.network"
    const PRIZE_POOL_ADDRESS = process.env.NEXT_PUBLIC_PRIZE_POOL_CONTRACT_ADDRESS || 
                                process.env.PRIZE_POOL_CONTRACT_ADDRESS ||
                                "0xeA0df70040E77a821b14770E53aa577A745930ae"

    if (!PRIZE_POOL_ADDRESS) {
      console.warn("[CRON] PRIZE_POOL_ADDRESS not configured, cannot check contract")
      return uniqueDays // Retornar todos os dias se não conseguir verificar
    }

    const provider = new JsonRpcProvider(RPC_URL)
    const PRIZE_POOL_ABI = [
      "function totalPlayers(uint256 day) view returns (uint256)",
    ]
    const contract = new Contract(PRIZE_POOL_ADDRESS, PRIZE_POOL_ABI, provider)

    const pendingDays: number[] = []

    for (const day of uniqueDays) {
      try {
        const totalPlayers = await contract.totalPlayers(day)
        if (totalPlayers === BigInt(0)) {
          pendingDays.push(day)
          console.log(`[CRON] Day ${day} is pending (totalPlayers = 0)`)
        } else {
          console.log(`[CRON] Day ${day} is already finalized (totalPlayers = ${totalPlayers})`)
        }
      } catch (err) {
        console.warn(`[CRON] Error checking day ${day} on contract:`, err)
        // Se houver erro ao verificar, incluir o dia para tentar finalizar
        pendingDays.push(day)
      }
    }

    console.log(`[CRON] Found ${pendingDays.length} pending days to finalize:`, pendingDays)
    return pendingDays
  } catch (error: any) {
    console.error("[CRON] Error finding pending days:", error)
    return []
  }
}

/**
 * Helper function para formatar resposta
 */
function formatResponse(result: any, day: number) {
  if (result.success) {
    if (result.alreadyRegistered) {
      return NextResponse.json({
        success: true,
        message: `Winners for day ${day} were already registered`,
        day,
        alreadyRegistered: true,
        totalPlayers: result.totalPlayers,
        timestamp: new Date().toISOString(),
      })
    } else {
      return NextResponse.json({
        success: true,
        message: `Winners registered successfully for day ${day}`,
        day,
        winners: result.winners,
        totalPlayers: result.totalPlayers,
        timestamp: new Date().toISOString(),
      })
    }
  } else {
    return NextResponse.json(
      {
        success: false,
        error: result.error || "Failed to register winners",
        day,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

