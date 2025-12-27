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
      return new Response(JSON.stringify({ error: "Missing required fields: day, rank, player" }), { status: 400 });
    }

    // 1️⃣ Verifica top 3 do dia
    const { data: topPlayers, error } = await supabaseAdmin
      .from("matches")
      .select("player, score, golden_moles, errors")
      .eq("day", day)
      .order("score", { ascending: false })
      .order("golden_moles", { ascending: false })
      .order("errors", { ascending: true })
      .limit(3);

    if (error) {
      console.error("[CLAIM-PRIZE] Error fetching top players:", error);
      return new Response(JSON.stringify({ error: "Database error" }), { status: 500 });
    }

    if (!topPlayers || topPlayers.length === 0) {
      return new Response(JSON.stringify({ error: "No matches found for this day" }), { status: 404 });
    }

    const winner = topPlayers[rank - 1]?.player?.toLowerCase();
    if (!winner || winner !== player.toLowerCase()) {
      return new Response(JSON.stringify({ error: "Not authorized" }), { status: 403 });
    }

    // 2️⃣ Verifica se já foi reivindicado
    const { data: claimedData, error: claimedError } = await supabaseAdmin
      .from("prizes_claimed")
      .select("*")
      .eq("day", day)
      .eq("rank", rank)
      .eq("player", player.toLowerCase());

    if (claimedError) {
      console.error("[CLAIM-PRIZE] Error checking claims:", claimedError);
      return new Response(JSON.stringify({ error: "Database error" }), { status: 500 });
    }

    if (claimedData && claimedData.length > 0) {
      return new Response(JSON.stringify({ error: "Prize already claimed" }), { status: 400 });
    }

    // 3️⃣ Registra claim no Supabase
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

    // 4️⃣ (Opcional) Registra no contrato
    try {
      const contract = getContractInstance();
      if (contract) {
        await contract.claimPrize(day, rank, player);
      }
    } catch (contractErr) {
      console.error("[CLAIM-PRIZE] Contract call failed:", contractErr);
      // Não falha o request se o contrato falhar - o claim já foi registrado no Supabase
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error("[CLAIM-PRIZE] Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Unexpected error" }), { status: 500 });
  }
}

