import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

/**
 * GET /api/getDailyRanking
 * Retorna o ranking diário da tabela 'matches' do Supabase.
 * Query parameters:
 * - ?date=YYYY-MM-DD (opcional, padrão: hoje em UTC)
 * Retorno consistente:
 * {
 *   "date": "YYYY-MM-DD",
 *   "players": [
 *     { "player": "0x123...", "totalPoints": 130 },
 *     { "player": "0xabc...", "totalPoints": 90 }
 *   ]
 * }
 */
export async function GET(request: Request) {
  try {
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

    // Definir limites do dia em UTC
    const dayStart = new Date(targetDate);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(targetDate);
    dayEnd.setUTCHours(23, 59, 59, 999);

    // Buscar matches no Supabase
    const { data: matches, error } = await supabase
      .from('matches')
      .select('player, points, timestamp')
      .between('timestamp', dayStart.toISOString(), dayEnd.toISOString());

    if (error) {
      return NextResponse.json(
        { date: dateString, players: [], error: 'Failed to fetch ranking from database' },
        { status: 500 }
      );
    }

    if (!matches || matches.length === 0) {
      return NextResponse.json({ date: dateString, players: [] });
    }

    // Agregar pontos por jogador (case-insensitive)
    const rankingMap: Record<string, number> = {};
    matches.forEach((match: { player: string; points: number; timestamp: string }) => {
      const player = match.player.toLowerCase();
      const points = match.points || 0;
      rankingMap[player] = (rankingMap[player] || 0) + points;
    });

    const players = Object.entries(rankingMap)
      .map(([player, totalPoints]) => ({ player, totalPoints }))
      .sort((a, b) => b.totalPoints - a.totalPoints);

    return NextResponse.json({ date: dateString, players });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    const dateString = new Date().toISOString().split('T')[0];
    return NextResponse.json(
      { date: dateString, players: [], error: `Unexpected error: ${errorMessage}` },
      { status: 500 }
    );
  }
}
