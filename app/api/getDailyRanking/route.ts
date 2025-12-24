import { NextResponse } from "next/server";
import { getRankingForDate } from "@/lib/ranking";

/**
 * GET /api/getDailyRanking
 * 
 * Returns daily ranking from Supabase matches table
 * 
 * Query parameters:
 * - ?date=YYYY-MM-DD (optional) - Specific date to query (UTC)
 *   If not provided, defaults to today's date (UTC)
 * 
 * Returns:
 * [
 *   { player: "0x123...", totalPoints: 130 },
 *   { player: "0xabc...", totalPoints: 90 }
 * ]
 * 
 * Sorted by totalPoints descending
 * 
 * NO filesystem access - works on Vercel
 * All data comes from Supabase matches table using timestamp column
 */
export async function GET(request: Request) {
  try {
    // Validate Supabase configuration at runtime
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    // Parse query parameter ?date=YYYY-MM-DD
    const url = new URL(request.url);
    const dateParam = url.searchParams.get("date");
    
    console.log(`🌐 [GET-DAILY-RANKING] Request received:`)
    console.log(`   URL: ${request.url}`)
    console.log(`   Date param: ${dateParam || 'null (defaulting to today)'}`)
    
    // Get ranking from Supabase
    // If date not provided, getRankingForDate(null) defaults to today
    const ranking = await getRankingForDate(dateParam);
    
    console.log(`✅ [GET-DAILY-RANKING] Returning ${ranking.length} players`)
    if (ranking.length > 0) {
      console.log(`   Top 3: ${ranking.slice(0, 3).map(r => `${r.player}: ${r.totalPoints}`).join(', ')}`)
    }

    return NextResponse.json(ranking, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (err) {
    console.error("Erro ao gerar ranking:", err);
    return NextResponse.json({ error: "Erro ao gerar ranking" }, { status: 500 });
  }
}
