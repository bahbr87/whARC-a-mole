import { supabaseAdmin } from "@/lib/supabase";
import { getContractInstance } from "@/lib/contract";

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
      return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400 });
    }

    const today = new Date();
    const dayDate = new Date();
    dayDate.setDate(dayDate.getDate() - (dayDate.getTime() / 86400000 - day)); // convert day number to date approx

    // Só permite claim de dias passados
    if (dayDate >= today) {
      return new Response(JSON.stringify({ error: "Day not ended yet" }), { status: 403 });
    }

    // Verifica top 3
    const { data: topPlayers } = await supabaseAdmin
      .from("matches")
      .select("player, points, golden_moles, errors")
      .eq("day", day)
      .order("points", { ascending: false })
      .order("golden_moles", { ascending: false })
      .order("errors", { ascending: true })
      .limit(3);

    const winner = topPlayers?.[rank - 1]?.player?.toLowerCase();
    if (!winner || winner !== player.toLowerCase()) {
      return new Response(JSON.stringify({ error: "Not authorized" }), { status: 403 });
    }

    // Verifica se já foi claim
    const { data: claimedData } = await supabaseAdmin
      .from("prizes_claimed")
      .select("*")
      .eq("day", day)
      .eq("rank", rank)
      .eq("player", player.toLowerCase());

    if (claimedData?.length) {
      return new Response(JSON.stringify({ error: "Prize already claimed" }), { status: 400 });
    }

    // Registra claim
    await supabaseAdmin.from("prizes_claimed").insert({
      day,
      rank,
      player: player.toLowerCase(),
      claimed: true,
      claimed_at: new Date().toISOString(),
    });

    // Opcional: registrar no contrato
    try {
      const contract = getContractInstance();
      if (contract) {
        await contract.claimPrize(day, rank, player);
      }
    } catch (contractErr) {
      console.error("[CLAIM-PRIZE] Contract call failed:", contractErr);
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error("[CLAIM-PRIZE] Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Unexpected error" }), { status: 500 });
  }
}

