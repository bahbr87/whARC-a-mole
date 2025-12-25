import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

/**
 * GET /api/getDailyRanking
 * 
 * Returns daily ranking from Supabase matches table
 * 
 * Query parameters:
 * - ?date=YYYY-MM-DD (optional) - Specific date to query (UTC)
 *   If not provided, defaults to today's date (UTC)
 * 
 * Returns consistent format:
 * {
 *   "date": "YYYY-MM-DD",
 *   "players": [
 *     { "player": "0x123...", "totalPoints": 130 },
 *     { "player": "0xabc...", "totalPoints": 90 }
 *   ]
 * }
 * 
 * Always returns this format, even if no players found (empty players array)
 */
export async function GET(request: Request) {
  try {
    // Validate Supabase configuration
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.SUPABASE_URL) {
      console.error('[GET-DAILY-RANKING] Supabase URL not configured');
      return NextResponse.json(
        { date: new Date().toISOString().split('T')[0], players: [], error: 'Supabase not configured' },
        { status: 500 }
      );
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[GET-DAILY-RANKING] Supabase service role key not configured');
      return NextResponse.json(
        { date: new Date().toISOString().split('T')[0], players: [], error: 'Supabase not configured' },
        { status: 500 }
      );
    }

    const url = new URL(request.url);
    const dateParam = url.searchParams.get('date');

    // Determine target date (default to today if not provided)
    let targetDate: Date;
    let dateString: string;

    if (dateParam) {
      // Parse date as UTC (YYYY-MM-DD format)
      const [year, month, day] = dateParam.split('-').map(Number);
      if (isNaN(year) || isNaN(month) || isNaN(day)) {
        console.error('[GET-DAILY-RANKING] Invalid date format:', dateParam);
        return NextResponse.json(
          { date: dateParam, players: [], error: 'Invalid date format. Expected YYYY-MM-DD' },
          { status: 400 }
        );
      }
      targetDate = new Date(Date.UTC(year, month - 1, day));
      dateString = dateParam;
    } else {
      // Default to today in UTC
      const now = new Date();
      targetDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      dateString = targetDate.toISOString().split('T')[0];
    }

    // Calculate day boundaries in UTC
    const dayStart = new Date(targetDate);
    dayStart.setUTCHours(0, 0, 0, 0);

    const dayEnd = new Date(targetDate);
    dayEnd.setUTCHours(23, 59, 59, 999);

    const dayStartISO = dayStart.toISOString();
    const dayEndISO = dayEnd.toISOString();

    console.log('[GET-DAILY-RANKING] Query parameters:');
    console.log('  Date requested:', dateString);
    console.log('  Day start (UTC):', dayStartISO);
    console.log('  Day end (UTC):', dayEndISO);

    // Query matches table
    const { data: matches, error } = await supabase
      .from('matches')
      .select('player, points, timestamp')
      .gte('timestamp', dayStartISO)
      .lte('timestamp', dayEndISO);

    if (error) {
      console.error('[GET-DAILY-RANKING] Supabase query error:', error);
      console.error('  Error details:', JSON.stringify(error, null, 2));
      // Return consistent format even on error
      return NextResponse.json(
        { date: dateString, players: [], error: 'Failed to fetch ranking from database' },
        { status: 500 }
      );
    }

    console.log('[GET-DAILY-RANKING] Matches found:', matches?.length || 0);

    // If no matches, return empty array in consistent format
    if (!matches || matches.length === 0) {
      console.log('[GET-DAILY-RANKING] No matches found for date:', dateString);
      return NextResponse.json({ date: dateString, players: [] });
    }

    // Aggregate points by player (case-insensitive)
    const rankingMap: Record<string, number> = {};
    matches.forEach((match: { player: string; points: number; timestamp: string }) => {
      const player = match.player.toLowerCase();
      const points = match.points || 0;
      rankingMap[player] = (rankingMap[player] || 0) + points;
    });

    // Convert to array and sort by totalPoints descending
    const players = Object.entries(rankingMap)
      .map(([player, totalPoints]) => ({ player, totalPoints }))
      .sort((a, b) => b.totalPoints - a.totalPoints);

    console.log('[GET-DAILY-RANKING] Returning', players.length, 'players for date', dateString);
    if (players.length > 0) {
      console.log('  Top 3:', players.slice(0, 3).map(p => `${p.player}: ${p.totalPoints}`).join(', '));
    }

    // Always return consistent format
    return NextResponse.json({ date: dateString, players });
  } catch (err) {
    console.error('[GET-DAILY-RANKING] Unexpected error:', err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('  Error stack:', err instanceof Error ? err.stack : 'No stack trace');
    
    // Return consistent format even on unexpected errors
    const dateString = new Date().toISOString().split('T')[0];
    return NextResponse.json(
      { date: dateString, players: [], error: `Unexpected error: ${errorMessage}` },
      { status: 500 }
    );
  }
}
