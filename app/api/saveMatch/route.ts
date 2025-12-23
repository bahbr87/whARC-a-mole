import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const { player, points } = await req.json();

    const { error } = await supabase
      .from('matches')
      .insert([{ player, points }]);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Erro ao salvar partida' }, { status: 500 });
  }
}

