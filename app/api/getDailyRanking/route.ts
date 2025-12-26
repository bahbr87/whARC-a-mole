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
 * 
 * Uses SQL query via RPC to correctly handle timestamptz comparisons
 */
export async function GET(request: Request) {
  try {
    // Validate Supabase configuration
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.SUPABASE_URL) {
      return NextResponse.json(
        { date: new Date().toISOString().split('T')[0], players: [], error: 'Supabase not configured' },
        { status: 500 }
      );
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { date: new Date().toISOString().split('T')[0], players: [], error: 'Supabase not configured' },
        { status: 500 }
      );
    }

    const url = new URL(request.url);
    const dateParam = url.searchParams.get('date');

    console.log('🔥 [RANKING] API called with date param:', dateParam);

    // Determine target date in UTC
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

    // Calculate day boundaries in UTC
    const dayStart = new Date(targetDate);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(targetDate);
    dayEnd.setUTCHours(23, 59, 59, 999);

    const dayStartISO = dayStart.toISOString();
    const dayEndISO = dayEnd.toISOString();

    console.log('[RANKING] Date requested:', dateString);
    console.log('[RANKING] Day start (UTC):', dayStartISO);
    console.log('[RANKING] Day end (UTC):', dayEndISO);

    // Query using RPC function that handles timestamptz correctly
    // The RPC function uses SQL: SELECT * FROM matches WHERE DATE(timestamp AT TIME ZONE 'UTC') = target_date
    let matches: Array<{ player: string; points: number; timestamp: string }> | null = null;
    let error: any = null;

    try {
      // Try RPC function first (requires SQL function in Supabase)
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_daily_matches', {
        target_date: dateString
      });

      if (!rpcError && rpcData) {
        matches = rpcData;
        console.log('[RANKING] Using RPC function - matches found:', matches?.length || 0);
      } else {
        // RPC function doesn't exist, use direct query with improved timestamptz handling
        console.log('[RANKING] RPC function not available, using direct query with timestamptz');
        
        // Use a more robust query that works better with timestamptz
        // Format timestamps as strings that PostgreSQL can parse correctly
        const { data: queryData, error: queryError } = await supabase
          .from('matches')
          .select('player, points, timestamp')
          .gte('timestamp', dayStartISO)
          .lte('timestamp', dayEndISO);

        matches = queryData;
        error = queryError;

        if (error) {
          console.error('[RANKING] Direct query error:', error);
          // Try alternative: query all and filter in memory (fallback)
          console.log('[RANKING] Trying fallback: query all matches and filter in memory');
          const { data: allMatches, error: allError } = await supabase
            .from('matches')
            .select('player, points, timestamp');

          if (!allError && allMatches) {
            // Filter in memory by comparing dates
            const filtered = allMatches.filter((m: { timestamp: string }) => {
              if (!m.timestamp) return false;
              const matchDate = new Date(m.timestamp);
              const matchDateStr = matchDate.toISOString().split('T')[0];
              return matchDateStr === dateString;
            });
            matches = filtered;
            error = null;
            console.log('[RANKING] Fallback filter: found', matches?.length || 0, 'matches');
          } else {
            error = allError;
          }
        }
      }
    } catch (rpcErr) {
      console.error('[RANKING] RPC error:', rpcErr);
      // Fallback to direct query
      const { data: queryData, error: queryError } = await supabase
        .from('matches')
        .select('player, points, timestamp')
        .gte('timestamp', dayStartISO)
        .lte('timestamp', dayEndISO);

      matches = queryData;
      error = queryError;
    }

    if (error) {
      console.error('[RANKING] Supabase query error:', error);
      return NextResponse.json(
        { date: dateString, players: [], error: 'Database query failed' },
        { status: 500 }
      );
    }

    console.log('🔥 [RANKING] Matches returned from DB:', matches?.length || 0);
    if (matches && matches.length > 0) {
      console.log('[RANKING] Sample matches (first 3):');
      matches.slice(0, 3).forEach((m, idx) => {
        console.log(`  [${idx + 1}] player: ${m.player}, points: ${m.points}, timestamp: ${m.timestamp}`);
      });
    }

    if (!matches || matches.length === 0) {
      console.log('[RANKING] No matches found for date:', dateString);
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

    console.log('[RANKING] Returning', players.length, 'players for date', dateString);
    if (players.length > 0) {
      console.log('[RANKING] Top 3:', players.slice(0, 3).map(p => `${p.player}: ${p.totalPoints}`).join(', '));
    }

    return NextResponse.json({ date: dateString, players });
  } catch (err) {
    console.error('[RANKING] Unexpected error:', err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    const dateString = new Date().toISOString().split('T')[0];
    return NextResponse.json(
      { date: dateString, players: [], error: `Unexpected error: ${errorMessage}` },
      { status: 500 }
    );
  }
}
