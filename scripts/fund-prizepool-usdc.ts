import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

const RPC_URL = "https://rpc.testnet.arc.network";
const USDC_ADDRESS = "0x37225a0bC4bc9f2dAA06F535E7B8BC7AB03636c4"; // USDC Arc Testnet
const PRIZE_POOL = "0x99BEb723Ca98BADe13D8962A47CC17520b1d143D"; // seu PrizePool
const PRIVATE_KEY = process.env.OWNER_PRIVATE_KEY!;

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  const usdc = new ethers.Contract(
    USDC_ADDRESS,
    [
      "function transfer(address to, uint256 amount) returns (bool)",
      "function balanceOf(address) view returns (uint256)",
      "function decimals() view returns (uint8)"
    ],
    wallet
  );

  const decimals = await usdc.decimals();
  const amount = ethers.parseUnits("1000", decimals); // 1000 USDC

  console.log("💰 Enviando USDC para PrizePool...");
  const tx = await usdc.transfer(PRIZE_POOL, amount);
  await tx.wait();

  console.log("✅ Enviado com sucesso!");
  console.log("TX:", tx.hash);

  const balance = await usdc.balanceOf(PRIZE_POOL);
  console.log("🏆 Saldo PrizePool:", ethers.formatUnits(balance, decimals), "USDC");
}

main().catch(console.error);




