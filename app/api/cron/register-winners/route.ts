import { NextRequest, NextResponse } from "next/server"
import { registerDailyWinners } from "@/lib/register-daily-winners"
import { getDayId } from "@/utils/day"

/**
 * ✅ API Route para execução automática do registro de vencedores
 * 
 * REGISTRA AUTOMATICAMENTE os winners do DIA ANTERIOR (UTC)
 * 
 * Pode ser chamada por:
 * - Vercel Cron Jobs
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

    // Determine which day to register
    const dayParam = searchParams.get("day")
    let day: number

    if (dayParam) {
      // Register specific day
      day = parseInt(dayParam)
      if (isNaN(day)) {
        return NextResponse.json(
          { error: "Invalid day parameter. Must be a number." },
          { status: 400 }
        )
      }
      console.log(`🚀 [CRON] Registering winners for specific day: ${day}`)
    } else {
      // Register yesterday (UTC) - default behavior
      const now = new Date()
      const yesterdayUTC = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1)
      )
      day = getDayId(yesterdayUTC)
      console.log(`🚀 [CRON] Registering winners for yesterday (UTC): day ${day}`)
    }

    // Register winners
    const result = await registerDailyWinners(day)

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

