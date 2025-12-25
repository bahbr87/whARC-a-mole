import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const dateParam = url.searchParams.get('date');

    if (!dateParam) {
      return NextResponse.json({ error: 'Missing date parameter' }, { status: 400 });
    }

    // Parse date as UTC (YYYY-MM-DD format)
    const [year, month, day] = dateParam.split('-').map(Number);
    const targetDate = new Date(Date.UTC(year, month - 1, day));

    const dayStart = new Date(targetDate);
    dayStart.setUTCHours(0, 0, 0, 0);

    const dayEnd = new Date(targetDate);
    dayEnd.setUTCHours(23, 59, 59, 999);

    // Query matches table - need to aggregate points by player
    const { data: matches, error } = await supabase
      .from('matches')
      .select('player, points, timestamp')
      .gte('timestamp', dayStart.toISOString())
      .lte('timestamp', dayEnd.toISOString());

    if (error) {
      console.error('[GET-DAILY-RANKING] Supabase error:', error);
      return NextResponse.json({ error: 'Failed to fetch ranking' }, { status: 500 });
    }

    if (!matches || matches.length === 0) {
      return NextResponse.json({ message: 'No players found for this day', players: [] });
    }

    // Aggregate points by player (case-insensitive)
    const rankingMap: Record<string, number> = {};
    matches.forEach((match) => {
      const player = match.player.toLowerCase();
      const points = match.points || 0;
      rankingMap[player] = (rankingMap[player] || 0) + points;
    });

    // Convert to array and sort by totalPoints descending
    const players = Object.entries(rankingMap)
      .map(([player, totalPoints]) => ({ player, totalPoints }))
      .sort((a, b) => b.totalPoints - a.totalPoints);

    return NextResponse.json(players);
  } catch (err) {
    console.error('[GET-DAILY-RANKING] Unexpected error:', err);
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
  }
}
