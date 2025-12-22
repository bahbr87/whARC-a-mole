import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

const RPC_URL = process.env.ARC_RPC_URL || "https://rpc.testnet.arc.network";
const PRIZE_POOL = "0xeA0df70040E77a821b14770E53aa577A745930ae";

const PRIZE_POOL_ABI = [
  "function claimed(uint256 day, uint8 rank) view returns (bool)",
  "function getWinner(uint256 day, uint8 rank) view returns (address)",
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
  const contract = new ethers.Contract(PRIZE_POOL, PRIZE_POOL_ABI, provider);

  const date = new Date("2025-12-18");
  const day = getDaysSinceEpochUTC(date);

  console.log("🔍 Verificando status de claim para 18/12/2025");
  console.log("📅 Data:", date.toISOString().split("T")[0]);
  console.log("🧮 Day (days since epoch):", day);
  console.log("");

  for (let rank = 1; rank <= 3; rank++) {
    try {
      const winner = await contract.getWinner(day, rank);
      const isClaimed = await contract.claimed(day, rank);
      
      console.log(`🏆 Rank ${rank}:`);
      console.log(`   Winner: ${winner}`);
      console.log(`   Claimed: ${isClaimed}`);
      console.log("");
    } catch (error: any) {
      console.log(`❌ Erro ao verificar rank ${rank}:`, error.message);
      console.log("");
    }
  }
}

main().catch(console.error);




