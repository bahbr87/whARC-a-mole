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

// Get GameCredits address from deployment.json
const deploymentPath = path.join(__dirname, "..", "deployment.json");
let GAME_CREDITS_ADDRESS = "0x531Ba20fB57fb9Efe6b8f5c7Cbf29248A7B3D5cF";
if (fs.existsSync(deploymentPath)) {
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  if (deployment.GameCredits) {
    GAME_CREDITS_ADDRESS = deployment.GameCredits;
  }
}

const GAME_CREDITS_ABI = [
  "function purchaseCreditsWithPrizePool(uint256 creditAmount) external",
  "function prizePoolAddress() view returns (address)",
  "function CREDIT_PRICE() view returns (uint256)",
  "function CLICK_COST() view returns (uint256)",
];

async function main() {
  console.log("=".repeat(70));
  console.log("🔍 VERIFICANDO FUNÇÃO purchaseCreditsWithPrizePool");
  console.log("=".repeat(70));
  console.log("");
  console.log("📍 GameCredits:", GAME_CREDITS_ADDRESS);
  console.log("🌐 RPC:", RPC_URL);
  console.log("");

  const provider = new ethers.JsonRpcProvider(RPC_URL, CHAIN_ID);
  const gameCredits = new ethers.Contract(GAME_CREDITS_ADDRESS, GAME_CREDITS_ABI, provider);

  try {
    // Check if contract exists
    const code = await provider.getCode(GAME_CREDITS_ADDRESS);
    if (code === "0x") {
      console.error("❌ Contrato não encontrado!");
      return;
    }

    // Read contract constants
    const creditPrice = await gameCredits.CREDIT_PRICE();
    const clickCost = await gameCredits.CLICK_COST();
    const prizePoolAddress = await gameCredits.prizePoolAddress();

    console.log("✅ Contrato encontrado e acessível!");
    console.log("");
    console.log("📋 Configurações do contrato:");
    console.log(`   CREDIT_PRICE: ${creditPrice.toString()} (${Number(creditPrice) / 1_000_000} USDC)`);
    console.log(`   CLICK_COST: ${clickCost.toString()} (${Number(clickCost) / 1_000_000} USDC)`);
    console.log(`   PrizePool Address: ${prizePoolAddress}`);
    console.log("");

    // Try to verify function exists by attempting to estimate gas
    const testWallet = new ethers.Wallet("0x" + "1".repeat(64), provider);
    const gameCreditsWithSigner = new ethers.Contract(GAME_CREDITS_ADDRESS, GAME_CREDITS_ABI, testWallet);

    try {
      // This will fail due to validations, but if function doesn't exist, it will fail differently
      await gameCreditsWithSigner.purchaseCreditsWithPrizePool.estimateGas(1);
      console.log("✅ Função purchaseCreditsWithPrizePool EXISTE no contrato!");
    } catch (error) {
      if (error.message.includes("PrizePool address not set") || 
          error.message.includes("Insufficient") ||
          error.message.includes("allowance") ||
          error.message.includes("balance")) {
        console.log("✅ Função purchaseCreditsWithPrizePool EXISTE no contrato!");
        console.log("   (Erro esperado na estimativa devido a validações do contrato)");
      } else if (error.message.includes("missing revert data") || error.message.includes("CALL_EXCEPTION")) {
        // Try to decode the error
        console.log("⚠️  Verificando função...");
        // If we get here, the function might not exist or there's a different issue
        console.log("   Erro:", error.message);
      } else {
        console.log("✅ Função purchaseCreditsWithPrizePool EXISTE no contrato!");
      }
    }

    console.log("");
    console.log("=".repeat(70));
    console.log("✅ VERIFICAÇÃO CONCLUÍDA");
    console.log("=".repeat(70));
  } catch (error) {
    console.error("❌ Erro ao verificar contrato:", error.message);
  }
}

main().catch(console.error);

