import { NextResponse } from 'next/server';
import { db } from '@/lib/db'; // ajuste para seu client/db real

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');

    if (!dateParam) {
      return NextResponse.json({ error: 'Date parameter is required' }, { status: 400 });
    }

    console.log('🔍 [RANKING-DEBUG] Date string received:', dateParam);

    // Cria range UTC do dia
    const dayStart = new Date(`${dateParam}T00:00:00Z`);
    const dayEnd = new Date(`${dateParam}T23:59:59.999Z`);

    console.log('🔍 [RANKING-DEBUG] Day start (UTC):', dayStart.toISOString());
    console.log('🔍 [RANKING-DEBUG] Day end (UTC):', dayEnd.toISOString());

    // Query no banco
    const players = await db
      .selectFrom('ranking') // ajuste para sua tabela real
      .select(['player', 'totalPoints', 'timestamp'])
      .where('timestamp', '>=', dayStart.toISOString())
      .where('timestamp', '<=', dayEnd.toISOString())
      .orderBy('totalPoints', 'desc')
      .execute();

    console.log('🔍 [RANKING-DEBUG] Rows returned:', players.length);

    // Retorna apenas player + totalPoints
    const result = players.map(p => ({
      player: p.player,
      totalPoints: p.totalPoints,
    }));

    return NextResponse.json(result);
  } catch (err) {
    console.error('🔍 [RANKING-DEBUG] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
