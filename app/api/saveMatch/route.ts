import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    // Validate Supabase configuration at runtime
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    const { player, points } = await req.json();

    // Validate required fields
    if (!player || points === undefined) {
      return NextResponse.json({ error: 'Missing required fields: player and points' }, { status: 400 });
    }

    // Normalize player to lowercase
    const normalizedPlayer = player.toLowerCase();

    // Use current UTC timestamp
    const timestamp = new Date().toISOString();

    // Insert into Supabase matches table
    const { error } = await supabase
      .from('matches')
      .insert([{ 
        player: normalizedPlayer, 
        points,
        timestamp 
      }]);

    if (error) {
      console.error('Supabase insert error:', error);
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Error saving match:', err);
    return NextResponse.json({ error: 'Erro ao salvar partida' }, { status: 500 });
  }
}

