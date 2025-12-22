import { ethers } from "ethers";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const RPC_URL = process.env.ARC_RPC_URL!;
const PRIZE_POOL_ADDRESS = "0xEc5Cb537fecA57E2f7678D29a7622a92ebf2A3A8";
const TARGET_SELECTOR = "0xeda9455b";

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  
  // Try to get code at address
  const code = await provider.getCode(PRIZE_POOL_ADDRESS);
  console.log("Contract code length:", code.length);
  
  // Load ABI from PrizePoolNew.json
  const deploymentInfo = JSON.parse(fs.readFileSync("PrizePoolNew.json", "utf8"));
  const abi = deploymentInfo.abi;
  
  console.log("\n📋 Functions in ABI:");
  const iface = new ethers.Interface(abi);
  const functions = abi.filter((f: any) => f.type === "function");
  
  for (const func of functions) {
    try {
      const funcName = func.name;
      const params = func.inputs.map((i: any) => `${i.type}`).join(",");
      const funcStr = `${funcName}(${params})`;
      const frag = iface.getFunction(funcName);
      
      console.log(`  ${funcStr.padEnd(50)} -> ${frag.selector}`);
      
      if (frag.selector === TARGET_SELECTOR) {
        console.log(`  ✅ MATCH! This is the function being called`);
      }
    } catch (e: any) {
      console.log(`  ⚠️  Error parsing ${func.name}:`, e.message);
    }
  }
  
  console.log(`\n🎯 Target selector: ${TARGET_SELECTOR}`);
  
  // Try to call a known function to verify contract works
  console.log("\n🧪 Testing contract calls:");
  try {
    const testContract = new ethers.Contract(
      PRIZE_POOL_ADDRESS,
      ["function owner() view returns (address)"],
      provider
    );
    const owner = await testContract.owner();
    console.log("  ✅ owner():", owner);
  } catch (e: any) {
    console.log("  ❌ owner() failed:", e.message);
  }
  
  try {
    const testContract = new ethers.Contract(
      PRIZE_POOL_ADDRESS,
      ["function getWinner(uint256 day, uint8 rank) view returns (address)"],
      provider
    );
    const winner = await testContract.getWinner(20441, 1);
    console.log("  ✅ getWinner(20441, 1):", winner);
  } catch (e: any) {
    console.log("  ❌ getWinner() failed:", e.message);
  }
}

main().catch(console.error);




