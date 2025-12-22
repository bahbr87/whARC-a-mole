import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

const RPC_URL = process.env.ARC_RPC_URL!;
const PRIVATE_KEY = process.env.OWNER_PRIVATE_KEY!; // use a wallet que está tentando dar claim
const PRIZEPOOL = "0xEc5Cb537fecA57E2f7678D29a7622a92ebf2A3A8"; // PrizePool mais recente
const USDC = "0x3600000000000000000000000000000000000000"; // USDC oficial ARC

const DAY = 20441; // dia que você está tentando claimar
const RANK = 1;    // 1, 2 ou 3

const PRIZEPOOL_ABI = [
  "function dailyWinners(uint256 day, uint8 rank) view returns (address)",
  "function getWinner(uint256 day, uint8 rank) view returns (address)",
  "function claimed(uint256 day, uint8 rank) view returns (bool)",
  "function claimPrize(uint256 day, uint8 rank) external",
  "function prizesClaimed(uint256 day, uint8 rank) view returns (bool)",
];

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address,uint256) returns (bool)",
];

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const signer = new ethers.Wallet(PRIVATE_KEY, provider);

  const prizePool = new ethers.Contract(PRIZEPOOL, PRIZEPOOL_ABI, signer);
  const usdc = new ethers.Contract(USDC, ERC20_ABI, provider);

  const signerAddress = await signer.getAddress();
  console.log("👤 Signer:", signerAddress);

  let winner;
  try {
    winner = await prizePool.getWinner(DAY, RANK);
  } catch {
    winner = await prizePool.dailyWinners(DAY, RANK);
  }
  console.log("🏆 Winner on-chain:", winner);

  let alreadyClaimed;
  try {
    alreadyClaimed = await prizePool.claimed(DAY, RANK);
  } catch {
    alreadyClaimed = await prizePool.prizesClaimed(DAY, RANK);
  }
  console.log("📌 Already claimed:", alreadyClaimed);

  const poolBalance = await usdc.balanceOf(PRIZEPOOL);
  console.log("💰 PrizePool USDC balance:", Number(poolBalance) / 1e6);

  console.log("\n🧪 Simulating claim (callStatic)...");
  try {
    await prizePool.claimPrize.staticCall(DAY, RANK);
    console.log("✅ callStatic SUCCESS → claimPrize SHOULD work");
  } catch (e: any) {
    console.log("❌ callStatic FAILED");
    console.log("Reason:", e.shortMessage || e.message);
    if (e.reason) {
      console.log("Revert reason:", e.reason);
    }
  }

  console.log("\n🧪 Testing raw USDC transfer from PrizePool...");
  try {
    await usdc.transfer.staticCall(signerAddress, 1);
    console.log("✅ USDC transfer callStatic OK");
  } catch (e: any) {
    console.log("❌ USDC transfer FAILED");
    console.log("Reason:", e.shortMessage || e.message);
  }
}

main().catch(console.error);

