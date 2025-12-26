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
    const url = new URL(request.url);
    const dateParam = url.searchParams.get('date');

    // Determine target date (default to today if not provided)
    let targetDate: Date;
    let dateString: string;

    if (dateParam) {
      const [year, month, day] = dateParam.split('-').map(Number);
      if (isNaN(year) || isNaN(month) || isNaN(day)) {
        return NextResponse.json(
          { date: dateParam, players: [], error: 'Invalid date format. Expected YYYY-MM-DD' },
          { status: 400 }
        );
      }
      targetDate = new Date(Date.UTC(year, month - 1, day));
      dateString = dateParam;
    } else {
      const now = new Date();
      targetDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      dateString = targetDate.toISOString().split('T')[0];
    }

    // Format day start/end as strings Supabase timestamptz can compare
    const dayStartStr = `${dateString} 00:00:00+00`;
    const dayEndStr = `${dateString} 23:59:59+00`;

    console.log('[GET-DAILY-RANKING] Fetching matches for date:', dateString);
    console.log('  Day start:', dayStartStr);
    console.log('  Day end:', dayEndStr);

    // Query matches table
    const { data: matches, error } = await supabase
      .from('matches')
      .select('player, points, timestamp')
      .gte('timestamp', dayStartStr)
      .lte('timestamp', dayEndStr);

    if (error) {
      console.error('[GET-DAILY-RANKING] Supabase query error:', error);
      return NextResponse.json({ date: dateString, players: [], error: 'Failed to fetch ranking' }, { status: 500 });
    }

    if (!matches || matches.length === 0) {
      return NextResponse.json({ date: dateString, players: [] });
    }

    // Aggregate points by player (case-insensitive)
    const rankingMap: Record<string, number> = {};
    matches.forEach((match: { player: string; points: number }) => {
      const player = match.player.toLowerCase();
      const points = match.points || 0;
      rankingMap[player] = (rankingMap[player] || 0) + points;
    });

    // Convert to array and sort by totalPoints descending
    const players = Object.entries(rankingMap)
      .map(([player, totalPoints]) => ({ player, totalPoints }))
      .sort((a, b) => b.totalPoints - a.totalPoints);

    return NextResponse.json({ date: dateString, players });
  } catch (err) {
    console.error('[GET-DAILY-RANKING] Unexpected error:', err);
    const dateString = new Date().toISOString().split('T')[0];
    return NextResponse.json({ date: dateString, players: [], error: 'Unexpected error' }, { status: 500 });
  }
}
