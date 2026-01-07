import { ethers } from "ethers";
import dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

const RPC_URL = process.env.RPC_URL || "https://rpc.testnet.arc.network";
const CHAIN_ID = 5042002;

// Get GameCredits address from deployment.json (newest deployment)
const deploymentPath = path.join(__dirname, "..", "deployment.json");
let GAME_CREDITS_ADDRESS = "0x531Ba20fB57fb9Efe6b8f5c7Cbf29248A7B3D5cF"; // Newly deployed address
if (fs.existsSync(deploymentPath)) {
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  if (deployment.GameCredits) {
    GAME_CREDITS_ADDRESS = deployment.GameCredits;
  }
}

const PRIZE_POOL_ADDRESS = process.env.NEXT_PUBLIC_PRIZE_POOL_CONTRACT_ADDRESS || "0xb07bB827a5A53e2b36eb0126aDD22ca1b4843DC7";
const OWNER_PRIVATE_KEY = process.env.OWNER_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY || process.env.PRIVATE_KEY;

if (!OWNER_PRIVATE_KEY) {
  console.error("❌ OWNER_PRIVATE_KEY, DEPLOYER_PRIVATE_KEY or PRIVATE_KEY not found in .env.local");
  process.exit(1);
}

const GAME_CREDITS_ABI = [
  "function setPrizePoolAddress(address _prizePoolAddress) external",
  "function prizePoolAddress() view returns (address)",
  "function owner() view returns (address)",
];

async function main() {
  console.log("=".repeat(70));
  console.log("🔧 CONFIGURANDO PRIZEPOOL ADDRESS NO GAMECREDITS");
  console.log("=".repeat(70));
  console.log("");
  console.log("📍 GameCredits:", GAME_CREDITS_ADDRESS);
  console.log("🏆 PrizePool:", PRIZE_POOL_ADDRESS);
  console.log("🌐 RPC:", RPC_URL);
  console.log("");

  const provider = new ethers.JsonRpcProvider(RPC_URL, CHAIN_ID);
  const wallet = new ethers.Wallet(OWNER_PRIVATE_KEY, provider);
  const gameCredits = new ethers.Contract(GAME_CREDITS_ADDRESS, GAME_CREDITS_ABI, wallet);

  // Verify owner
  const owner = await gameCredits.owner();
  console.log("👤 Contract Owner:", owner);
  console.log("👤 Wallet Address:", wallet.address);
  console.log("");

  if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
    console.error("❌ Wallet address does not match contract owner!");
    console.error(`   Expected: ${owner}`);
    console.error(`   Got: ${wallet.address}`);
    process.exit(1);
  }

  // Check current PrizePool address
  try {
    const currentPrizePool = await gameCredits.prizePoolAddress();
    if (currentPrizePool !== "0x0000000000000000000000000000000000000000") {
      console.log("⚠️  Current PrizePool address:", currentPrizePool);
      if (currentPrizePool.toLowerCase() === PRIZE_POOL_ADDRESS.toLowerCase()) {
        console.log("✅ PrizePool address already configured correctly!");
        return;
      }
      console.log("   Will update to:", PRIZE_POOL_ADDRESS);
    } else {
      console.log("ℹ️  PrizePool address not set yet");
    }
  } catch (error) {
    console.log("ℹ️  Could not read current PrizePool address (may not be set)");
  }

  console.log("");
  console.log("📤 Setting PrizePool address...");
  
  const tx = await gameCredits.setPrizePoolAddress(PRIZE_POOL_ADDRESS);
  console.log("⏳ Transaction sent:", tx.hash);
  console.log("   Explorer: https://testnet.arcscan.app/tx/" + tx.hash);
  
  await tx.wait();
  console.log("✅ Transaction confirmed!");
  
  // Verify
  const newPrizePool = await gameCredits.prizePoolAddress();
  console.log("");
  console.log("=".repeat(70));
  console.log("✅ CONFIGURAÇÃO CONCLUÍDA!");
  console.log("=".repeat(70));
  console.log("");
  console.log("📍 PrizePool address configured:", newPrizePool);
  console.log("");
  
  if (newPrizePool.toLowerCase() === PRIZE_POOL_ADDRESS.toLowerCase()) {
    console.log("✅ PrizePool address configured successfully!");
  } else {
    console.error("❌ PrizePool address mismatch!");
    console.error(`   Expected: ${PRIZE_POOL_ADDRESS}`);
    console.error(`   Got: ${newPrizePool}`);
  }
  console.log("");
}

main().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});
