import { supabaseAdmin } from "@/lib/supabase";
import { getContractInstance } from "@/lib/contract";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const dayParam = url.searchParams.get('day');
    
    if (!dayParam) return new Response(JSON.stringify({ error: "Missing day parameter" }), { status: 400 });

    const day = parseInt(dayParam, 10);
    if (isNaN(day)) return new Response(JSON.stringify({ error: "Invalid day parameter" }), { status: 400 });

    const { data: claims, error } = await supabaseAdmin
      .from("prizes_claimed")
      .select("player, rank")
      .eq("day", day);

    if (error) return new Response(JSON.stringify({ error: "Database error" }), { status: 500 });
    return new Response(JSON.stringify({ claims: claims || [] }), { status: 200 });

  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Unexpected error" }), { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { day, rank, player } = await req.json();

    if (!day || !rank || !player) return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 });

    // Top 3 do dia
    const { data: topPlayers, error } = await supabaseAdmin
      .from("matches")
      .select("player, points, golden_moles, errors")
      .eq("day", day)
      .order("points", { ascending: false })
      .order("golden_moles", { ascending: false })
      .order("errors", { ascending: true })
      .limit(3);

    if (error) return new Response(JSON.stringify({ error: "Database error" }), { status: 500 });
    if (!topPlayers || topPlayers.length === 0) return new Response(JSON.stringify({ error: "No matches for this day" }), { status: 404 });

    const winner = topPlayers[rank - 1]?.player?.toLowerCase();
    if (!winner || winner !== player.toLowerCase()) return new Response(JSON.stringify({ error: "Not authorized" }), { status: 403 });

    // Já reclamou?
    const { data: claimedData, error: claimedError } = await supabaseAdmin
      .from("prizes_claimed")
      .select("*")
      .eq("day", day)
      .eq("rank", rank)
      .eq("player", player.toLowerCase());

    if (claimedError) return new Response(JSON.stringify({ error: "Database error" }), { status: 500 });
    if (claimedData && claimedData.length > 0) return new Response(JSON.stringify({ error: "Prize already claimed" }), { status: 400 });

    // Registra claim
    const { error: insertError } = await supabaseAdmin.from("prizes_claimed").insert({
      day,
      rank,
      player: player.toLowerCase(),
      claimed: true,
      claimed_at: new Date().toISOString()
    });
    if (insertError) return new Response(JSON.stringify({ error: "Failed to register claim" }), { status: 500 });

    // Opcional: registra no contrato
    try {
      const contract = getContractInstance();
      if (contract) await contract.claimPrize(day, rank, player);
    } catch (contractErr) {
      console.error("[CLAIM-PRIZE] Contract call failed:", contractErr);
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });

  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Unexpected error" }), { status: 500 });
  }
}

