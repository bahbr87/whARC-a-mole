import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const dateParam = url.searchParams.get('date');

    console.log('🔥 [RANKING] API called with date param:', dateParam);

    // Determine target date in UTC
    let targetDate: Date;
    let dateString: string;

    if (dateParam) {
      const [year, month, day] = dateParam.split('-').map(Number);
      targetDate = new Date(Date.UTC(year, month - 1, day));
      dateString = dateParam;
    } else {
      const now = new Date();
      targetDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      dateString = targetDate.toISOString().split('T')[0];
    }

    const dayStart = new Date(targetDate);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(targetDate);
    dayEnd.setUTCHours(23, 59, 59, 999);

    console.log('[RANKING] Querying matches from', dayStart.toISOString(), 'to', dayEnd.toISOString());

    const { data: matches, error } = await supabase
      .from('matches')
      .select('player, points, timestamp')
      .gte('timestamp', dayStart.toISOString())
      .lte('timestamp', dayEnd.toISOString());

    if (error) {
      console.error('[RANKING] Supabase query error:', error);
      return NextResponse.json({ date: dateString, players: [], error: 'Database query failed' }, { status: 500 });
    }

    console.log('🔥 [RANKING] Matches returned from DB:', matches?.length);
    console.log(matches);

    if (!matches || matches.length === 0) {
      console.log('[RANKING] No matches found for date:', dateString);
      return NextResponse.json({ date: dateString, players: [] });
    }

    // Aggregate points by player (case-insensitive)
    const rankingMap: Record<string, number> = {};
    matches.forEach((match: { player: string; points: number }) => {
      const player = match.player.toLowerCase();
      const points = match.points || 0;
      rankingMap[player] = (rankingMap[player] || 0) + points;
    });

    const players = Object.entries(rankingMap)
      .map(([player, totalPoints]) => ({ player, totalPoints }))
      .sort((a, b) => b.totalPoints - a.totalPoints);

    console.log('[RANKING] Returning', players.length, 'players for date', dateString);
    if (players.length > 0) {
      console.log('  Top 3:', players.slice(0, 3).map(p => `${p.player}: ${p.totalPoints}`).join(', '));
    }

    return NextResponse.json({ date: dateString, players });
  } catch (err) {
    console.error('[RANKING] Unexpected error:', err);
    const dateString = new Date().toISOString().split('T')[0];
    return NextResponse.json({ date: dateString, players: [], error: 'Unexpected error' }, { status: 500 });
  }
}
