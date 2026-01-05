import { supabaseAdmin } from "@/lib/supabase";
import { getContractInstance } from "@/lib/contract";
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
    const { player } = await req.json();

    if (!player) {
      return new Response(
        JSON.stringify({
          error: "Missing player field",
        }),
        { status: 400 }
      );
    }

    const normalizedPlayer = player.toLowerCase();

    // ============================================================================
    // CONFIGURATION
    // ============================================================================
    const RPC_URL = process.env.RPC_URL || process.env.ARC_RPC_URL || "https://rpc.testnet.arc.network";
    const CHAIN_ID = 5042002;
    const PRIZE_POOL_ADDRESS = process.env.NEXT_PUBLIC_PRIZE_POOL_CONTRACT_ADDRESS || process.env.PRIZE_POOL_CONTRACT_ADDRESS;
    const OWNER_PRIVATE_KEY = process.env.OWNER_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY || process.env.PRIVATE_KEY;

    if (!PRIZE_POOL_ADDRESS) {
      console.error("[CLAIM-PRIZE] ❌ PRIZE_POOL_ADDRESS not configured");
      return new Response(JSON.stringify({ error: "PrizePool contract not configured" }), { status: 500 });
    }

    if (!OWNER_PRIVATE_KEY) {
      console.error("[CLAIM-PRIZE] ❌ OWNER_PRIVATE_KEY not configured");
      return new Response(JSON.stringify({ error: "Owner private key not configured" }), { status: 500 });
    }

    // ============================================================================
    // CONNECT TO BLOCKCHAIN
    // ============================================================================
    const provider = new ethers.JsonRpcProvider(RPC_URL, CHAIN_ID);
    const wallet = new ethers.Wallet(OWNER_PRIVATE_KEY, provider);

    console.log(`[CLAIM-PRIZE] 🔗 Connected to Arc Network`);
    console.log(`[CLAIM-PRIZE] 👤 Owner address: ${wallet.address}`);
    console.log(`[CLAIM-PRIZE] 🏆 PrizePool: ${PRIZE_POOL_ADDRESS}`);
    console.log(`[CLAIM-PRIZE] 🎮 Player: ${normalizedPlayer}`);

    // ============================================================================
    // CHECK IF PLAYER CAN CLAIM PRIZE
    // ============================================================================
    const PRIZE_POOL_ABI = [
      "function canClaim(uint256 day, address user) view returns (bool)",
      "function getWinner(uint256 day, uint256 rank) view returns (address)",
      "function getPrizeForRank(uint256 rank, uint256 players) view returns (uint256)",
      "function totalPlayers(uint256 day) view returns (uint256)",
      "function claimed(uint256 day, address user) view returns (bool)",
      "function usdc() view returns (address)",
    ];

    const prizePoolContract = new ethers.Contract(PRIZE_POOL_ADDRESS, PRIZE_POOL_ABI, provider);

    // Find which day and rank the player can claim
    // We'll check recent days (last 30 days)
    const currentDay = Math.floor(Date.now() / 86400000);
    let claimableDay: number | null = null;
    let claimableRank: number | null = null;
    let prizeAmount: bigint = BigInt(0);

    console.log(`[CLAIM-PRIZE] 🔍 Checking last 30 days for claimable prizes...`);

    for (let day = currentDay; day >= currentDay - 30; day--) {
      // Check if already claimed
      const alreadyClaimed = await prizePoolContract.claimed(day, normalizedPlayer);
      if (alreadyClaimed) {
        continue;
      }

      // Check each rank (1, 2, 3)
      for (let rank = 1; rank <= 3; rank++) {
        const winner = await prizePoolContract.getWinner(day, rank);
        if (winner.toLowerCase() === normalizedPlayer) {
          const totalPlayers = await prizePoolContract.totalPlayers(day);
          if (totalPlayers > BigInt(0)) {
            const prize = await prizePoolContract.getPrizeForRank(rank, totalPlayers);
            if (prize > BigInt(0)) {
              claimableDay = day;
              claimableRank = rank;
              prizeAmount = prize;
              console.log(`[CLAIM-PRIZE] ✅ Found claimable prize: day=${day}, rank=${rank}, amount=${prize.toString()}`);
              break;
            }
          }
        }
      }
      if (claimableDay !== null) break;
    }

    if (claimableDay === null || claimableRank === null || prizeAmount === BigInt(0)) {
      console.log(`[CLAIM-PRIZE] ❌ No claimable prize found for player ${normalizedPlayer}`);
      return new Response(JSON.stringify({ error: "No claimable prize found" }), { status: 404 });
    }

    // Check if already claimed in database
    const { data: alreadyClaimedInDb } = await supabaseAdmin
      .from("prizes_claimed")
      .select("*")
      .eq("day", claimableDay)
      .eq("rank", claimableRank)
      .eq("player", normalizedPlayer);

    if (alreadyClaimedInDb && alreadyClaimedInDb.length > 0) {
      console.log(`[CLAIM-PRIZE] ⚠️ Prize already claimed in database for day=${claimableDay}, rank=${claimableRank}`);
      // Still allow if contract says it's not claimed (in case of database inconsistency)
      const isClaimedOnChain = await prizePoolContract.claimed(claimableDay, normalizedPlayer);
      if (isClaimedOnChain) {
        return new Response(JSON.stringify({ error: "Prize already claimed" }), { status: 400 });
      }
      // Remove stale database record
      await supabaseAdmin
        .from("prizes_claimed")
        .delete()
        .eq("day", claimableDay)
        .eq("rank", claimableRank)
        .eq("player", normalizedPlayer);
      console.log(`[CLAIM-PRIZE] 🗑️ Removed stale database record`);
    }

    // ============================================================================
    // GET USDC CONTRACT ADDRESS
    // ============================================================================
    const usdcAddress = await prizePoolContract.usdc();
    console.log(`[CLAIM-PRIZE] 💰 USDC contract: ${usdcAddress}`);

    // ============================================================================
    // TRANSFER USDC FROM PRIZEPOOL TO PLAYER
    // ============================================================================
    const ERC20_ABI = [
      "function balanceOf(address account) view returns (uint256)",
    ];

    const usdcContract = new ethers.Contract(usdcAddress, ERC20_ABI, provider);

    // Check PrizePool balance
    const prizePoolBalance = await usdcContract.balanceOf(PRIZE_POOL_ADDRESS);
    console.log(`[CLAIM-PRIZE] 💰 PrizePool USDC balance: ${prizePoolBalance.toString()}`);

    if (prizePoolBalance < prizeAmount) {
      console.error(`[CLAIM-PRIZE] ❌ Insufficient balance in PrizePool. Required: ${prizeAmount.toString()}, Available: ${prizePoolBalance.toString()}`);
      return new Response(JSON.stringify({ error: "Insufficient balance in PrizePool" }), { status: 500 });
    }

    // Use PrizePool's distributePrize function to transfer directly from PrizePool to player
    const PRIZE_POOL_DISTRIBUTE_ABI = [
      "function distributePrize(uint256 day, address user) external",
    ];
    
    const prizePoolWithSigner = new ethers.Contract(PRIZE_POOL_ADDRESS, PRIZE_POOL_DISTRIBUTE_ABI, wallet);
    
    console.log(`[CLAIM-PRIZE] 📤 Distributing prize from PrizePool to player ${normalizedPlayer}...`);
    console.log(`[CLAIM-PRIZE]    Day: ${claimableDay}, Rank: ${claimableRank}, Amount: ${prizeAmount.toString()}`);
    
    const distributeTx = await prizePoolWithSigner.distributePrize(claimableDay, normalizedPlayer);
    console.log(`[CLAIM-PRIZE] ⏳ Transaction sent: ${distributeTx.hash}`);

    // Wait for transaction confirmation
    const receipt = await distributeTx.wait();
    console.log(`[CLAIM-PRIZE] ✅ Transaction confirmed in block ${receipt.blockNumber}`);
    console.log(`[CLAIM-PRIZE] ✅ Prize transferred from PrizePool to player ${normalizedPlayer}`);

    // ============================================================================
    // REGISTER CLAIM IN DATABASE (only after successful transfer)
    // ============================================================================
    const { error: insertError } = await supabaseAdmin.from("prizes_claimed").insert({
      day: claimableDay,
      rank: claimableRank,
      player: normalizedPlayer,
      claimed: true,
      claimed_at: new Date().toISOString(),
    });

    if (insertError) {
      console.error("[CLAIM-PRIZE] ❌ Error inserting claim:", insertError);
      // Transaction already succeeded, so we log but don't fail
      console.warn("[CLAIM-PRIZE] ⚠️ Prize transferred but database registration failed");
    } else {
      console.log(`[CLAIM-PRIZE] ✅ Claim registered in database for day=${claimableDay}, rank=${claimableRank}, player=${normalizedPlayer}`);
    }

    return new Response(JSON.stringify({ 
      success: true,
      day: claimableDay,
      rank: claimableRank,
      amount: prizeAmount.toString(),
      transactionHash: distributeTx.hash,
      message: "Prize transferred successfully from PrizePool"
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
