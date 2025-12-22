import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

const RPC_URL = process.env.ARC_RPC_URL!;
const PRIZE_POOL_ADDRESS = "0xEc5Cb537fecA57E2f7678D29a7622a92ebf2A3A8";

const PRIZE_POOL_ABI = [
  "function getWinner(uint256 day, uint8 rank) view returns (address)",
  "function claimed(uint256 day, uint8 rank) view returns (bool)",
];

function getDaysSinceEpochUTC(date: Date): number {
  const utc = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    0, 0, 0, 0
  );
  return Math.floor(utc / (1000 * 60 * 60 * 24));
}

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const contract = new ethers.Contract(PRIZE_POOL_ADDRESS, PRIZE_POOL_ABI, provider);

  // Get date from command line or use today
  const dateArg = process.argv[2];
  const date = dateArg ? new Date(dateArg) : new Date();
  const day = getDaysSinceEpochUTC(date);

  console.log("🔍 Verificando vencedores on-chain");
  console.log("📅 Data:", date.toISOString().split("T")[0]);
  console.log("🧮 Day (days since epoch):", day);
  console.log("📍 PrizePool:", PRIZE_POOL_ADDRESS);
  console.log("");

  // Get wallet address from command line or use env
  const walletAddress = process.argv[3] || process.env.OWNER_ADDRESS;
  
  if (walletAddress) {
    console.log("👤 Wallet para verificar:", walletAddress);
    console.log("");
  }

  // Check all 3 ranks
  for (let rank = 1; rank <= 3; rank++) {
    try {
      const winner = await contract.getWinner(day, rank);
      const isClaimed = await contract.claimed(day, rank);
      
      console.log(`🏆 Rank ${rank}:`);
      console.log(`   Winner: ${winner}`);
      console.log(`   Claimed: ${isClaimed}`);
      
      if (walletAddress) {
        const match = winner.toLowerCase() === walletAddress.toLowerCase();
        console.log(`   Match com wallet: ${match ? "✅ SIM" : "❌ NÃO"}`);
        if (!match && winner !== ethers.ZeroAddress) {
          console.log(`   ⚠️  Wallet esperado: ${walletAddress}`);
          console.log(`   ⚠️  Winner on-chain: ${winner}`);
        }
      }
      console.log("");
    } catch (error: any) {
      console.log(`❌ Erro ao verificar rank ${rank}:`, error.message);
      console.log("");
    }
  }

  // Also check yesterday in case of timezone issues
  const yesterday = new Date(date);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayDay = getDaysSinceEpochUTC(yesterday);
  
  console.log("📅 Verificando também o dia anterior (possível problema de timezone):");
  console.log("   Data:", yesterday.toISOString().split("T")[0]);
  console.log("   Day:", yesterdayDay);
  console.log("");
  
  for (let rank = 1; rank <= 3; rank++) {
    try {
      const winner = await contract.getWinner(yesterdayDay, rank);
      if (winner !== ethers.ZeroAddress) {
        console.log(`   Rank ${rank}: ${winner}`);
        if (walletAddress && winner.toLowerCase() === walletAddress.toLowerCase()) {
          console.log(`   ✅ ENCONTRADO! Você é o vencedor do dia anterior.`);
        }
      }
    } catch (error: any) {
      // Ignore errors
    }
  }
}

main().catch(console.error);




