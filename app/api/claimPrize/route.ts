import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const dayParam = url.searchParams.get('day');
    
    if (!dayParam) {
      return new Response(JSON.stringify({ error: "Missing day parameter" }), { status: 400 });
    }

    const day = parseInt(dayParam, 10);
    if (isNaN(day)) {
      return new Response(JSON.stringify({ error: "Invalid day parameter" }), { status: 400 });
    }

    const { data: claims, error } = await supabaseAdmin
      .from("prizes_claimed")
      .select("player, rank")
      .eq("day", day);

    if (error) {
      console.error("[CLAIM-PRIZE] Error fetching claims:", error);
      return new Response(JSON.stringify({ error: "Database error" }), { status: 500 });
    }

    return new Response(JSON.stringify({ claims: claims || [] }), { status: 200 });
  } catch (err) {
    console.error("[CLAIM-PRIZE] Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Unexpected error" }), { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { day, rank, player } = await req.json();

    if (!day || !rank || !player) {
      return new Response(JSON.stringify({ error: "Missing required fields: day, rank, player" }), { status: 400 });
    }

    // 1️⃣ Verifica se o player é realmente o vencedor do rank
    // Convert day (days since epoch) to timestamp range
    const dayStart = new Date(day * 86400000);
    const dayEnd = new Date((day + 1) * 86400000 - 1);

    const { data: matches, error: matchesError } = await supabaseAdmin
      .from("matches")
      .select("player, points, golden_moles, errors")
      .gte("timestamp", dayStart.toISOString())
      .lte("timestamp", dayEnd.toISOString());

    if (matchesError) {
      console.error("[CLAIM-PRIZE] Error fetching matches:", matchesError);
      return new Response(JSON.stringify({ error: "Database error" }), { status: 500 });
    }

    if (!matches || matches.length === 0) {
      return new Response(JSON.stringify({ error: "No matches found for this day" }), { status: 404 });
    }

    // Aggregate player totals
    const players = new Map<
      string,
      { player: string; score: number; goldenMoles: number; errors: number }
    >();

    for (const row of matches) {
      const addr = row.player.toLowerCase();
      if (!players.has(addr)) {
        players.set(addr, { player: addr, score: 0, goldenMoles: 0, errors: 0 });
      }
      const playerData = players.get(addr)!;
      playerData.score += row.points || 0;
      playerData.goldenMoles += row.golden_moles || 0;
      playerData.errors += row.errors || 0;
    }

    // Sort by score (desc), then golden_moles (desc), then errors (asc)
    const winners = Array.from(players.values()).sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.goldenMoles !== a.goldenMoles) return b.goldenMoles - a.goldenMoles;
      return a.errors - b.errors;
    });

    // Get winner for the requested rank (1-indexed)
    const winner = winners[rank - 1];
    if (!winner) {
      return new Response(JSON.stringify({ error: "Invalid rank" }), { status: 400 });
    }

    if (winner.player.toLowerCase() !== player.toLowerCase()) {
      return new Response(JSON.stringify({ error: "Not authorized" }), { status: 403 });
    }

    // 2️⃣ Verifica se já deu claim
    const { data: claimedData } = await supabaseAdmin
      .from("prizes_claimed")
      .select("*")
      .eq("day", day)
      .eq("rank", rank)
      .eq("player", player.toLowerCase());

    if (claimedData && claimedData.length > 0) {
      return new Response(JSON.stringify({ error: "Prize already claimed" }), { status: 400 });
    }

    // 3️⃣ Registra o claim
    const { error: insertError } = await supabaseAdmin.from("prizes_claimed").insert({
      day,
      rank,
      player: player.toLowerCase(),
      claimed: true,
      claimed_at: new Date().toISOString()
    });

    if (insertError) {
      console.error("[CLAIM-PRIZE] Error inserting claim:", insertError);
      return new Response(JSON.stringify({ error: "Failed to register claim" }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error("[CLAIM-PRIZE] Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Unexpected error" }), { status: 500 });
  }
}

