import { supabaseAdmin } from "@/lib/supabase";
import { getContractInstance } from "@/lib/contract";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const dayParam = url.searchParams.get("day");

    if (!dayParam) return new Response(JSON.stringify({ error: "Missing day parameter" }), { status: 400 });

    const day = parseInt(dayParam, 10);
    if (isNaN(day)) return new Response(JSON.stringify({ error: "Invalid day parameter" }), { status: 400 });

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
      return new Response(
        JSON.stringify({
          error: "Missing: day, rank or player",
        }),
        { status: 400 }
      );
    }

    // ✅ CORREÇÃO: Buscar TODAS as matches do dia e agregar por jogador
    // ANTES: Buscava apenas os primeiros 3 matches individuais (não agregados)
    // PROBLEMA: Se um jogador tinha múltiplas matches, podia não aparecer no top 3 correto
    // AGORA: Busca todas as matches, agrega por jogador, ordena e pega os top 3
    const { data: allMatches, error } = await supabaseAdmin
      .from("matches")
      .select("player, points, golden_moles, errors")
      .eq("day", day);

    if (error) {
      console.error("[CLAIM] DB ranking error:", error);
      return new Response(JSON.stringify({ error: "Database error" }), {
        status: 500,
      });
    }

    if (!allMatches || allMatches.length === 0) {
      return new Response(JSON.stringify({ error: "No matches found for this day" }), {
        status: 404,
      });
    }

    // Agregar por jogador (case-insensitive)
    const playerMap = new Map<string, { player: string; points: number; golden_moles: number; errors: number }>();
    
    allMatches.forEach((match: any) => {
      const playerLower = (match.player || '').toLowerCase().trim();
      if (!playerLower) return;
      
      if (playerMap.has(playerLower)) {
        const existing = playerMap.get(playerLower)!;
        existing.points += match.points || 0;
        existing.golden_moles += match.golden_moles || 0;
        existing.errors += match.errors || 0;
      } else {
        playerMap.set(playerLower, {
          player: match.player, // Manter o endereço original
          points: match.points || 0,
          golden_moles: match.golden_moles || 0,
          errors: match.errors || 0
        });
      }
    });
    
    // Converter para array e ordenar (mesma lógica do endpoint de rankings)
    const topPlayers = Array.from(playerMap.values()).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.golden_moles !== a.golden_moles) return b.golden_moles - a.golden_moles;
      return a.errors - b.errors;
    });

    console.log(`[CLAIM] Top players for day ${day}:`, topPlayers.slice(0, 3).map((p, i) => ({ rank: i + 1, player: p.player, points: p.points })));

    const winner = topPlayers[rank - 1]?.player?.toLowerCase();

    if (!winner || winner !== player.toLowerCase()) {
      return new Response(JSON.stringify({ error: "Not authorized" }), {
        status: 403,
      });
    }

    const { data: alreadyClaimed } = await supabaseAdmin
      .from("prizes_claimed")
      .select("*")
      .eq("day", day)
      .eq("rank", rank)
      .eq("player", player.toLowerCase());

    if (alreadyClaimed && alreadyClaimed.length > 0) {
      return new Response(
        JSON.stringify({ error: "Prize already claimed" }),
        { status: 400 }
      );
    }

    await supabaseAdmin.from("prizes_claimed").insert({
      day,
      rank,
      player: player.toLowerCase(),
      claimed: true,
      claimed_at: new Date().toISOString(),
    });

    try {
      const contract = getContractInstance();
      if (contract) {
        await contract.claimPrize(day, rank, player);
      }
    } catch (err) {
      console.error("[CLAIM] Contract fail:", err);
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error("[CLAIM] Unexpected:", err);
    return new Response(JSON.stringify({ error: "Unexpected error" }), {
      status: 500,
    });
  }
}

