import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

const RPC_URL = process.env.ARC_RPC_URL || "https://rpc.testnet.arc.network";
const GAME_CREDITS_ADDRESS = "0xB6EF59882778d0A245202F1482f20f02ad82bd87";

const GAME_CREDITS_ABI = [
  "function credits(address) external view returns (uint256)",
  "function getCredits(address) external view returns (uint256)",
];

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const contract = new ethers.Contract(GAME_CREDITS_ADDRESS, GAME_CREDITS_ABI, provider);

  // Test with a known address that has credits
  const testAddress = "0xB51158878a08a860443B10b2F24617bab5F1F3eA";

  console.log("🔍 Testing credits fetch...");
  console.log("Contract address:", GAME_CREDITS_ADDRESS);
  console.log("Test address:", testAddress);
  console.log("");

  try {
    // Check contract code
    const code = await provider.getCode(GAME_CREDITS_ADDRESS);
    console.log("Contract code exists:", code !== "0x" && code !== "0x0");
    console.log("");

    // Try credits() function
    try {
      const balance1 = await contract.credits(testAddress);
      console.log("✅ credits() result:", balance1.toString());
      console.log("   Type:", typeof balance1);
      console.log("   Number:", Number(balance1));
    } catch (error: any) {
      console.log("❌ credits() error:", error.message);
    }

    console.log("");

    // Try getCredits() function
    try {
      const balance2 = await contract.getCredits(testAddress);
      console.log("✅ getCredits() result:", balance2.toString());
      console.log("   Type:", typeof balance2);
      console.log("   Number:", Number(balance2));
    } catch (error: any) {
      console.log("❌ getCredits() error:", error.message);
    }
  } catch (error: any) {
    console.error("❌ Error:", error.message);
  }
}

main().catch(console.error);




