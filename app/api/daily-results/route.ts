import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const day = Number(searchParams.get("day"));
    
    if (!day || isNaN(day)) {
      return new Response(JSON.stringify({ error: "day parameter is required" }), { status: 400 });
    }
    
    const { data } = await supabaseAdmin
      .from("matches")
      .select("player, points, golden_moles, errors, timestamp")
      .gte("timestamp", new Date(day * 86400000).toISOString())
      .lte("timestamp", new Date((day + 1) * 86400000 - 1).toISOString())
      .order("points", { ascending: false })
      .order("golden_moles", { ascending: false })
      .order("errors", { ascending: true });

    if (!data || data.length === 0) {
      return new Response(JSON.stringify({ ranking: [] }), { status: 200 });
    }

    // Aggregate player totals with golden_moles and errors
    const players = new Map<
      string,
      { player: string; score: number; goldenMoles: number; errors: number }
    >()

    for (const row of data) {
      const addr = row.player.toLowerCase()
      if (!players.has(addr)) {
        players.set(addr, { player: addr, score: 0, goldenMoles: 0, errors: 0 })
      }

      const playerData = players.get(addr)!
      playerData.score += row.points || 0
      playerData.goldenMoles += row.golden_moles || 0
      playerData.errors += row.errors || 0
    }

    // Sort by score (desc), then golden_moles (desc), then errors (asc)
    const ranking = Array.from(players.values()).sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      if (b.goldenMoles !== a.goldenMoles) return b.goldenMoles - a.goldenMoles
      return a.errors - b.errors
    }).map(row => ({
      address: row.player,
      score: row.score,
      goldenMoles: row.goldenMoles,
      errors: row.errors
    }));

    return new Response(JSON.stringify({ ranking }), { status: 200 });
  } catch (err) {
    console.error("[DAILY-RESULTS] Error fetching ranking:", err);
    return new Response(JSON.stringify({ error: "Failed to fetch ranking" }), { status: 500 });
  }
}

