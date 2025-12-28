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
    // ✅ CORREÇÃO: Usar fallback por timestamp se não encontrar por day (mesma lógica do /api/rankings)
    let allMatches: any[] = [];
    
    // Primeiro tenta buscar por day
    const { data: dataByDay, error: errorByDay } = await supabaseAdmin
      .from("matches")
      .select("player, points, golden_moles, errors, day, timestamp")
      .eq("day", day);

    if (errorByDay) {
      console.error("[CLAIM] DB error (by day):", errorByDay);
    } else if (dataByDay && dataByDay.length > 0) {
      allMatches = dataByDay;
      console.log(`[CLAIM] Found ${allMatches.length} matches by day=${day}`);
    } else {
      // Fallback: buscar por timestamp (para dados antigos que não têm o campo day)
      console.log(`[CLAIM] No matches found with day=${day}, trying fallback query by timestamp...`);
      
      const dayStartMs = day * 86400000;
      const dayEndMs = (day + 1) * 86400000;
      const dayStartISO = new Date(dayStartMs).toISOString();
      const dayEndISO = new Date(dayEndMs).toISOString();
      
      const { data: dataByTimestamp, error: errorByTimestamp } = await supabaseAdmin
        .from("matches")
        .select("player, points, golden_moles, errors, day, timestamp")
        .gte("timestamp", dayStartISO)
        .lt("timestamp", dayEndISO);

      if (errorByTimestamp) {
        console.error("[CLAIM] DB error (by timestamp):", errorByTimestamp);
        return new Response(JSON.stringify({ error: "Database error" }), {
          status: 500,
        });
      } else if (dataByTimestamp && dataByTimestamp.length > 0) {
        // Calcular day do timestamp e filtrar
        const matchesWithDay = dataByTimestamp.map(match => {
          const calculatedDay = Math.floor(new Date(match.timestamp).getTime() / 86400000);
          return {
            ...match,
            day: calculatedDay
          };
        });
        
        allMatches = matchesWithDay.filter(m => m.day === day);
        console.log(`[CLAIM] Found ${allMatches.length} matches by timestamp (filtered to day=${day})`);
      }
    }

    if (!allMatches || allMatches.length === 0) {
      console.error(`[CLAIM] No matches found for day ${day} (tried both day field and timestamp)`);
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

    // ✅ CORREÇÃO: Verificar no banco E no contrato antes de bloquear
    // Se o banco tem registro mas o contrato não confirma, permitir nova tentativa
    const { data: alreadyClaimed } = await supabaseAdmin
      .from("prizes_claimed")
      .select("*")
      .eq("day", day)
      .eq("rank", rank)
      .eq("player", player.toLowerCase());

    if (alreadyClaimed && alreadyClaimed.length > 0) {
      console.log(`[CLAIM] Found claim record in database for day=${day}, rank=${rank}, player=${player}`);
      
      // ✅ CORREÇÃO: Verificar no contrato se realmente foi claimed
      // Se o contrato não confirma, remover registro do banco e permitir nova tentativa
      const PRIZE_POOL_ADDRESS = process.env.NEXT_PUBLIC_PRIZE_POOL_CONTRACT_ADDRESS || process.env.PRIZE_POOL_CONTRACT_ADDRESS;
      
      if (!PRIZE_POOL_ADDRESS) {
        console.warn(`[CLAIM] PRIZE_POOL_ADDRESS not configured. Cannot verify on contract. Using database record.`);
        return new Response(
          JSON.stringify({ error: "Prize already claimed" }),
          { status: 400 }
        );
      }
      
      try {
        const { JsonRpcProvider, Contract } = await import("ethers");
        const RPC_URL = process.env.RPC_URL || "https://rpc.testnet.arc.network";
        const provider = new JsonRpcProvider(RPC_URL);
        
        const PRIZE_POOL_ABI = [
          "function claimed(uint256 day, address user) view returns (bool)",
        ];
        
        console.log(`[CLAIM] Verifying claim on contract: PRIZE_POOL_ADDRESS=${PRIZE_POOL_ADDRESS}, day=${day}, player=${player.toLowerCase()}`);
        
        const contract = new Contract(PRIZE_POOL_ADDRESS, PRIZE_POOL_ABI, provider);
        const isClaimedOnChain = await contract.claimed(day, player.toLowerCase());
        
        console.log(`[CLAIM] Contract.claimed(${day}, ${player.toLowerCase()}) = ${isClaimedOnChain}`);
        
        if (isClaimedOnChain) {
          // Contrato confirma que foi claimed - bloquear
          console.log(`[CLAIM] Contract confirms claim. Blocking duplicate claim.`);
          return new Response(
            JSON.stringify({ error: "Prize already claimed" }),
            { status: 400 }
          );
        } else {
          // Contrato não confirma - remover registro do banco e permitir nova tentativa
          console.log(`[CLAIM] Contract does NOT confirm claim. Removing stale database record and allowing retry.`);
          
          const { error: deleteError } = await supabaseAdmin
            .from("prizes_claimed")
            .delete()
            .eq("day", day)
            .eq("rank", rank)
            .eq("player", player.toLowerCase());
          
          if (deleteError) {
            console.error(`[CLAIM] Error removing stale claim record:`, deleteError);
            // Ainda assim permitir nova tentativa
          } else {
            console.log(`[CLAIM] Stale claim record removed successfully. Allowing new claim attempt.`);
          }
          
          // Continue com o fluxo normal (não retornar erro)
        }
      } catch (contractErr: any) {
        // Se houver erro ao verificar no contrato, remover registro do banco e permitir nova tentativa
        // É melhor permitir nova tentativa do que bloquear incorretamente
        console.error(`[CLAIM] Error verifying claim on contract:`, contractErr);
        console.log(`[CLAIM] Removing stale database record due to contract verification error. Allowing retry.`);
        
        try {
          await supabaseAdmin
            .from("prizes_claimed")
            .delete()
            .eq("day", day)
            .eq("rank", rank)
            .eq("player", player.toLowerCase());
          console.log(`[CLAIM] Stale claim record removed after contract error. Allowing new claim attempt.`);
        } catch (deleteErr) {
          console.error(`[CLAIM] Error removing stale claim record:`, deleteErr);
        }
        
        // Continue com o fluxo normal (não retornar erro) - permitir nova tentativa
      }
    }

    // ✅ CORREÇÃO: Registrar claim no banco ANTES de chamar o contrato
    // Isso garante que mesmo se o contrato falhar, o claim está registrado
    const { error: insertError } = await supabaseAdmin.from("prizes_claimed").insert({
      day,
      rank,
      player: player.toLowerCase(),
      claimed: true,
      claimed_at: new Date().toISOString(),
    });

    if (insertError) {
      console.error("[CLAIM] Error inserting claim:", insertError);
      return new Response(JSON.stringify({ error: "Failed to register claim" }), {
        status: 500,
      });
    }

    console.log(`[CLAIM] Claim registered in database for day=${day}, rank=${rank}, player=${player}`);

    // ✅ CORREÇÃO: NÃO chamar o contrato no backend
    // O backend não pode chamar o contrato porque precisa da assinatura da wallet do usuário
    // O frontend deve chamar o contrato diretamente após registrar no banco
    // Retornar sucesso para que o frontend possa chamar o contrato
    
    return new Response(JSON.stringify({ 
      success: true,
      message: "Claim registered in database. Please call the contract from the frontend to transfer the prize."
    }), { status: 200 });
  } catch (err) {
    console.error("[CLAIM] Unexpected:", err);
    return new Response(JSON.stringify({ error: "Unexpected error" }), {
      status: 500,
    });
  }
}

