import { supabaseAdmin } from "@/lib/supabase";
import { ethers } from "ethers";

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
    const { player, day, rank } = await req.json();

    // ============================================================================
    // CONFIGURATION
    // ============================================================================
    const RPC_URL = process.env.RPC_URL || process.env.ARC_RPC_URL || "https://rpc.testnet.arc.network";
    const CHAIN_ID = 5042002;
    const PRIZE_POOL_ADDRESS = process.env.NEXT_PUBLIC_PRIZE_POOL_CONTRACT_ADDRESS || process.env.PRIZE_POOL_CONTRACT_ADDRESS;

    if (!PRIZE_POOL_ADDRESS) {
      console.error("[CLAIM-PRIZE] ❌ PRIZE_POOL_ADDRESS not configured");
      return new Response(JSON.stringify({ error: "PrizePool contract not configured" }), { status: 500 });
    }

    // ============================================================================
    // VALIDATE INPUT - Player
    // ============================================================================
    if (!player) {
      console.error("[CLAIM-PRIZE] ❌ Missing player field");
      return new Response(JSON.stringify({ error: "Missing player field" }), { status: 400 });
    }

    // Normalize player address
    const normalizedPlayer = player.toLowerCase();
    
    // Validate address format (basic check)
    if (!/^0x[a-fA-F0-9]{40}$/.test(normalizedPlayer)) {
      console.error("[CLAIM-PRIZE] ❌ Invalid player address format");
      return new Response(JSON.stringify({ error: "Invalid player address format" }), { status: 400 });
    }

    // ============================================================================
    // VALIDATE INPUT - Day
    // ============================================================================
    if (day === undefined || day === null) {
      console.error("[CLAIM-PRIZE] ❌ Missing day field");
      return new Response(JSON.stringify({ error: "Missing day field" }), { status: 400 });
    }

    const claimableDay = parseInt(String(day), 10);
    if (isNaN(claimableDay) || claimableDay < 0) {
      console.error("[CLAIM-PRIZE] ❌ Invalid day format");
      return new Response(JSON.stringify({ error: "Invalid day format" }), { status: 400 });
    }

    // ============================================================================
    // VALIDATE DAY IS FINALIZED (cannot claim for today or future days)
    // ============================================================================
    const todayDay = Math.floor(Date.now() / 86400000);
    if (claimableDay >= todayDay) {
      console.error(`[CLAIM-PRIZE] ❌ Day not finalized: claimableDay=${claimableDay}, todayDay=${todayDay}`);
      return new Response(JSON.stringify({
        error: "Day not finalized",
        details: "You can only claim prizes for past days"
      }), { status: 400 });
    }

    // ============================================================================
    // VALIDATE INPUT - Rank
    // ============================================================================
    if (rank === undefined || rank === null) {
      console.error("[CLAIM-PRIZE] ❌ Missing rank field");
      return new Response(JSON.stringify({ error: "Missing rank field" }), { status: 400 });
    }

    const claimableRank = parseInt(String(rank), 10);
    if (isNaN(claimableRank) || claimableRank < 1 || claimableRank > 3) {
      console.error("[CLAIM-PRIZE] ❌ Invalid rank format (must be 1, 2, or 3)");
      return new Response(JSON.stringify({ error: "Invalid rank format (must be 1, 2, or 3)" }), { status: 400 });
    }

    console.log(`[CLAIM-PRIZE] 🔍 Validating claim request:`);
    console.log(`   Player: ${normalizedPlayer}`);
    console.log(`   Day: ${claimableDay}`);
    console.log(`   Rank: ${claimableRank}`);

    // ============================================================================
    // CONNECT TO BLOCKCHAIN (READ-ONLY)
    // ============================================================================
    const provider = new ethers.JsonRpcProvider(RPC_URL, CHAIN_ID);
    const PRIZE_POOL_ABI = [
      "function canClaim(uint256 day, address user) view returns (bool)",
      "function claimed(uint256 day, address user) view returns (bool)",
      "function getWinner(uint256 day, uint256 rank) view returns (address)",
      "function totalPlayers(uint256 day) view returns (uint256)",
    ];

    const prizePoolContract = new ethers.Contract(PRIZE_POOL_ADDRESS, PRIZE_POOL_ABI, provider);

    // ============================================================================
    // CHECK IF ALREADY CLAIMED IN DATABASE
    // ============================================================================
    const { data: existingClaim } = await supabaseAdmin
      .from("prizes_claimed")
      .select("*")
      .eq("day", claimableDay)
      .eq("rank", claimableRank)
      .eq("player", normalizedPlayer)
      .maybeSingle();

    if (existingClaim) {
      console.log(`[CLAIM-PRIZE] ⚠️ Found existing claim record in database`);
      
      // Check on-chain status
      const isClaimedOnChain = await prizePoolContract.claimed(claimableDay, normalizedPlayer);
      console.log(`[CLAIM-PRIZE]   On-chain claimed status: ${isClaimedOnChain}`);
      
      if (isClaimedOnChain) {
        console.log(`[CLAIM-PRIZE] ❌ Prize already claimed on-chain`);
        return new Response(JSON.stringify({ 
          error: "Prize already claimed",
          details: "This prize has already been claimed on the blockchain"
        }), { status: 400 });
      }
      
      // Remove stale database record (on-chain says not claimed, but DB has record)
      console.log(`[CLAIM-PRIZE] 🗑️ Removing stale database record (on-chain not claimed)`);
      await supabaseAdmin
        .from("prizes_claimed")
        .delete()
        .eq("day", claimableDay)
        .eq("rank", claimableRank)
        .eq("player", normalizedPlayer);
    }

    // ============================================================================
    // VERIFY ON-CHAIN: canClaim(day, user)
    // ============================================================================
    console.log(`[CLAIM-PRIZE] 🔍 Checking canClaim(${claimableDay}, ${normalizedPlayer}) on contract...`);
    
    try {
      const canClaim = await prizePoolContract.canClaim(claimableDay, normalizedPlayer);
      console.log(`[CLAIM-PRIZE]   canClaim result: ${canClaim}`);
      
      if (!canClaim) {
        // Additional checks to provide better error message
        const isClaimed = await prizePoolContract.claimed(claimableDay, normalizedPlayer);
        
        if (isClaimed) {
          console.log(`[CLAIM-PRIZE] ❌ Prize already claimed on-chain`);
          return new Response(JSON.stringify({ 
            error: "Prize already claimed",
            details: "This prize has already been claimed on the blockchain"
          }), { status: 400 });
        }
        
        // Check if user is actually a winner
        let isWinner = false;
        for (let checkRank = 1; checkRank <= 3; checkRank++) {
          const winner = await prizePoolContract.getWinner(claimableDay, checkRank);
          if (winner.toLowerCase() === normalizedPlayer) {
            isWinner = true;
            break;
          }
        }
        
        if (!isWinner) {
          console.log(`[CLAIM-PRIZE] ❌ Player is not a winner for this day`);
          return new Response(JSON.stringify({ 
            error: "Not a winner",
            details: "You are not a winner for this day"
          }), { status: 400 });
        }
        
        // If we get here, something unexpected happened
        console.log(`[CLAIM-PRIZE] ❌ Cannot claim (unknown reason)`);
        return new Response(JSON.stringify({ 
          error: "Cannot claim prize",
          details: "The contract indicates you cannot claim this prize. Please verify your eligibility."
        }), { status: 400 });
      }
    } catch (contractError: any) {
      console.error(`[CLAIM-PRIZE] ❌ Error checking canClaim:`, contractError);
      return new Response(JSON.stringify({ 
        error: "Contract verification failed",
        details: contractError.message || "Failed to verify claim eligibility on contract"
      }), { status: 500 });
    }

    // ============================================================================
    // REGISTER CLAIM ATTEMPT IN DATABASE
    // ============================================================================
    console.log(`[CLAIM-PRIZE] ✅ All validations passed. Registering claim attempt in database...`);
    
    const { error: insertError } = await supabaseAdmin.from("prizes_claimed").insert({
      day: claimableDay,
      rank: claimableRank,
      player: normalizedPlayer,
      claimed: false, // Will be updated to true after successful contract transaction
      claimed_at: new Date().toISOString(),
    });

    if (insertError) {
      console.error("[CLAIM-PRIZE] ❌ Error inserting claim:", insertError);
      return new Response(JSON.stringify({ 
        error: "Database registration failed",
        details: insertError.message 
      }), { status: 500 });
    }

    console.log(`[CLAIM-PRIZE] ✅ Claim attempt registered in database`);
    console.log(`[CLAIM-PRIZE] ℹ️ Next step: Frontend should call prizePool.claim(${claimableDay}) via wallet`);

    return new Response(JSON.stringify({ 
      success: true,
      day: claimableDay,
      rank: claimableRank,
      player: normalizedPlayer,
      message: "Validation successful. You can now claim the prize by calling prizePool.claim(day) in your wallet.",
      nextStep: "Call prizePool.claim(day) via your connected wallet to complete the claim"
    }), { status: 200 });
  } catch (err: any) {
    console.error("[CLAIM-PRIZE] ❌ Unexpected error:", err);
    return new Response(JSON.stringify({ 
      error: "Unexpected error",
      details: err.message 
    }), {
      status: 500,
    });
  }
}
