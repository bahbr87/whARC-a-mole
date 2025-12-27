import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

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

    console.log('[RANKING] Date requested:', dateString);
    console.log('[RANKING] Target date (UTC):', targetDate.toISOString());

    // Query matches from Supabase
    // First, try to query all matches and filter in memory (most reliable)
    // This ensures we get all data and can filter correctly regardless of timezone issues
    let matches: Array<{ player: string; points: number; timestamp: string }> | null = null;
    let error: any = null;

    console.log('[RANKING] Querying all matches from Supabase...');
    const { data: allMatches, error: allError } = await supabase
      .from('matches')
      .select('player, points, timestamp')
      .order('timestamp', { ascending: false });

    if (allError) {
      console.error('[RANKING] Error querying matches:', allError);
      error = allError;
    } else {
      console.log(`[RANKING] Total matches in database: ${allMatches?.length || 0}`);
      
      if (allMatches && allMatches.length > 0) {
        // Log first few matches for debugging
        console.log('[RANKING] Sample matches (first 5):');
        allMatches.slice(0, 5).forEach((m, idx) => {
          const matchDate = m.timestamp ? new Date(m.timestamp).toISOString().split('T')[0] : 'N/A';
          console.log(`  [${idx + 1}] player: ${m.player}, points: ${m.points}, timestamp: ${m.timestamp}, date: ${matchDate}`);
        });

        // Filter matches for the target date
        const filtered = allMatches.filter((m: { timestamp: string }) => {
          if (!m.timestamp) {
            console.warn('[RANKING] Match without timestamp:', m);
            return false;
          }
          const matchDate = new Date(m.timestamp);
          const matchDateStr = matchDate.toISOString().split('T')[0];
          const isMatch = matchDateStr === dateString;
          if (isMatch) {
            console.log(`[RANKING] ✅ Match found for ${dateString}: player=${m.player}, points=${m.points}, timestamp=${m.timestamp}`);
          }
          return isMatch;
        });
        
        matches = filtered;
        console.log(`[RANKING] Filtered matches for ${dateString}: ${matches.length} matches found`);
      } else {
        console.log('[RANKING] No matches found in database');
        matches = [];
      }
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
