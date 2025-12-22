import { ethers } from "ethers";
import * as dotenv from "dotenv";
import { promises as fs } from "fs";
import path from "path";

dotenv.config({ path: ".env.local" });

const RPC_URL = process.env.RPC_URL || process.env.ARC_RPC_URL || "https://rpc.testnet.arc.network";
const OWNER_PRIVATE_KEY = process.env.PRIZE_POOL_OWNER_PRIVATE_KEY || process.env.OWNER_PRIVATE_KEY!;
// Force use of the correct PrizePool address (fixed claimPeriod)
const PRIZE_POOL_ADDRESS = "0xeA0df70040E77a821b14770E53aa577A745930ae";

if (!OWNER_PRIVATE_KEY) {
  throw new Error("PRIZE_POOL_OWNER_PRIVATE_KEY ou OWNER_PRIVATE_KEY não configurado no .env.local");
}

const PRIZE_POOL_ABI = [
  "function setDailyWinners(uint256 day, address[3] calldata winners) external",
  "function getWinner(uint256 day, uint8 rank) view returns (address)",
  "function owner() view returns (address)",
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
  console.log("🚀 Registrando vencedores para 18/12/2025");

  const targetDate = new Date("2025-12-18T00:00:00Z");
  const day = getDaysSinceEpochUTC(targetDate);

  console.log("📅 Data UTC:", targetDate.toISOString().split("T")[0]);
  console.log("🧮 Days since epoch:", day);

  // Load rankings
  const rankingsPath = path.join(process.cwd(), "data", "rankings.json");
  const rankingsData = JSON.parse(await fs.readFile(rankingsPath, "utf8"));

  // Filter rankings for 18/12/2025
  const dayStart = Date.UTC(2025, 11, 18, 0, 0, 0, 0);
  const dayEnd = Date.UTC(2025, 11, 18, 23, 59, 59, 999);
  const dayRankings = rankingsData.filter((r: any) => r.timestamp >= dayStart && r.timestamp <= dayEnd);

  console.log(`📊 Rankings encontrados para 18/12/2025: ${dayRankings.length}`);

  if (dayRankings.length === 0) {
    console.log("⚠️ Nenhum ranking encontrado para este dia");
    return;
  }

  // Aggregate scores by player
  const players: Record<string, { player: string; score: number; goldenMoles: number; errors: number }> = {};
  dayRankings.forEach((r: any) => {
    if (!players[r.player]) {
      players[r.player] = { player: r.player, score: 0, goldenMoles: 0, errors: 0 };
    }
    players[r.player].score += r.score;
    players[r.player].goldenMoles += r.goldenMoles;
    players[r.player].errors += r.errors;
  });

  // Sort by score, goldenMoles, errors
  const sorted = Object.values(players).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.goldenMoles !== a.goldenMoles) return b.goldenMoles - a.goldenMoles;
    return a.errors - b.errors;
  });

  console.log("\n🏆 Top jogadores:");
  sorted.slice(0, 3).forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.player} - Score: ${p.score}, Golden: ${p.goldenMoles}, Errors: ${p.errors}`);
  });

  const winners = sorted.slice(0, 3).map(p => p.player);

  if (winners.length === 0) {
    console.log("⚠️ Nenhum vencedor encontrado");
    return;
  }

  // Connect to contract
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(OWNER_PRIVATE_KEY, provider);
  const prizePool = new ethers.Contract(PRIZE_POOL_ADDRESS, PRIZE_POOL_ABI, wallet);

  console.log("\n🔑 Wallet:", wallet.address);

  // Verify owner
  const contractOwner = await prizePool.owner();
  if (contractOwner.toLowerCase() !== wallet.address.toLowerCase()) {
    throw new Error(`Wallet ${wallet.address} não é o owner do contrato. Owner: ${contractOwner}`);
  }
  console.log("✅ Wallet confirmada como owner");

  // Check if already registered
  const winner1 = await prizePool.getWinner(day, 1);
  if (winner1 !== ethers.ZeroAddress) {
    console.log("ℹ️ Vencedores já registrados para este dia:");
    console.log(`   1º: ${winner1}`);
    const winner2 = await prizePool.getWinner(day, 2);
    if (winner2 !== ethers.ZeroAddress) {
      console.log(`   2º: ${winner2}`);
    }
    const winner3 = await prizePool.getWinner(day, 3);
    if (winner3 !== ethers.ZeroAddress) {
      console.log(`   3º: ${winner3}`);
    }
    return;
  }

  // Register winners - pad to 3 addresses
  const winnersArray: string[] = [];
  winnersArray.push(winners[0] || ethers.ZeroAddress);
  winnersArray.push(winners[1] || ethers.ZeroAddress);
  winnersArray.push(winners[2] || ethers.ZeroAddress);

  console.log("\n⛓️ Registrando vencedores on-chain...");
  console.log(`   1º: ${winnersArray[0]}`);
  if (winnersArray[1] !== ethers.ZeroAddress) console.log(`   2º: ${winnersArray[1]}`);
  if (winnersArray[2] !== ethers.ZeroAddress) console.log(`   3º: ${winnersArray[2]}`);

  const tx = await prizePool.setDailyWinners(day, winnersArray as [string, string, string]);
  console.log("📤 TX enviada:", tx.hash);
  console.log("⏳ Aguardando confirmação...");

  const receipt = await tx.wait();

  if (!receipt || receipt.status !== 1) {
    throw new Error("Transação falhou");
  }

  console.log("✅ Vencedores registrados com sucesso!");
  console.log("🔗 Explorer:", `https://testnet.arcscan.app/tx/${tx.hash}`);

  // Verify
  console.log("\n📋 Verificando vencedores registrados:");
  const v1 = await prizePool.getWinner(day, 1);
  const v2 = await prizePool.getWinner(day, 2);
  const v3 = await prizePool.getWinner(day, 3);
  console.log(`   1º: ${v1}`);
  if (v2 !== ethers.ZeroAddress) console.log(`   2º: ${v2}`);
  if (v3 !== ethers.ZeroAddress) console.log(`   3º: ${v3}`);
}

main().catch((err) => {
  console.error("❌ Erro:", err);
  process.exit(1);
});

