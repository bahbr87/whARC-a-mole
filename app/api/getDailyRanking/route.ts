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
 * All data comes from Supabase matches table using created_at column
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
    
    // Get ranking from Supabase
    // If date not provided, getRankingForDate(null) defaults to today
    const ranking = await getRankingForDate(dateParam);

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
