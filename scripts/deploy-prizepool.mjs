/**
 * Deploy PrizePool Contract Script
 * 
 * This script deploys the PrizePool contract to Arc Testnet.
 * 
 * Prerequisites:
 * 1. Install dependencies: npm install ethers@^6.0.0
 * 2. Set up your .env.local file with:
 *    - PRIVATE_KEY=your_private_key_here
 *    - (Optional) PRIZE_POOL_OWNER=address_to_set_as_owner
 * 
 * Usage:
 *   node scripts/deploy-prizepool.mjs
 */

import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Arc Testnet Configuration
const ARC_RPC_URL = "https://rpc.testnet.arc.network";
const ARC_CHAIN_ID = 5042002;

// Official Arc Testnet USDC Address
// COLE O ENDEREÇO AQUI (já está correto, mas verifique):
const USDC_ADDRESS = "0x37225a0bC4bc9f2dAA06F535E7B8BC7AB03636c4";

// Load environment variables
import dotenv from "dotenv";
import { resolve } from "path";
dotenv.config({ path: resolve(__dirname, "../.env.local") });

async function main() {
  console.log("🚀 Deploying PrizePool contract to Arc Testnet...\n");

  // Validate environment variables
  if (!process.env.PRIVATE_KEY) {
    throw new Error("❌ PRIVATE_KEY not found in .env.local");
  }

  // Setup provider and wallet
  const provider = new ethers.JsonRpcProvider(ARC_RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  console.log("📋 Deployment Configuration:");
  console.log("   Network: Arc Testnet");
  console.log("   Chain ID:", ARC_CHAIN_ID);
  console.log("   Deployer:", wallet.address);
  console.log("   USDC Address:", USDC_ADDRESS);
  console.log("");

  // Check balance
  const balance = await provider.getBalance(wallet.address);
  console.log("💰 Deployer balance:", ethers.formatEther(balance), "ETH");
  if (balance === 0n) {
    throw new Error("❌ Insufficient balance. Please fund your wallet.");
  }
  console.log("");

  // Determine owner address
  // COLE O ENDEREÇO DO OWNER AQUI (ou deixe vazio para usar o deployer):
  const ownerAddress = process.env.PRIZE_POOL_OWNER || wallet.address;
  console.log("👤 PrizePool Owner:", ownerAddress);
  console.log("");

  // Read and compile contract
  console.log("📖 Reading contract file...");
  const contractPath = path.join(__dirname, "../contracts/PrizePool.sol");
  if (!fs.existsSync(contractPath)) {
    throw new Error(`❌ Contract file not found: ${contractPath}`);
  }

  // For this script, we'll use the compiled ABI and bytecode
  // In a real scenario, you would compile the contract first using Hardhat or Foundry
  console.log("⚠️  Note: This script assumes the contract is already compiled.");
  console.log("   If not compiled, use: npx hardhat compile");
  console.log("");

  // Load compiled contract artifacts
  const artifactsPath = path.join(__dirname, "../artifacts/contracts/PrizePool.sol/PrizePool.json");
  if (!fs.existsSync(artifactsPath)) {
    throw new Error(
      `❌ Compiled contract not found: ${artifactsPath}\n` +
      "   Please compile the contract first: npx hardhat compile"
    );
  }

  const contractArtifact = JSON.parse(fs.readFileSync(artifactsPath, "utf8"));
  const contractFactory = new ethers.ContractFactory(
    contractArtifact.abi,
    contractArtifact.bytecode,
    wallet
  );

  // Deploy contract
  console.log("📦 Deploying PrizePool contract...");
  console.log("   Constructor args:");
  console.log("     - USDC Address:", USDC_ADDRESS);
  console.log("     - Owner Address:", ownerAddress);
  console.log("");

  const contract = await contractFactory.deploy(USDC_ADDRESS, ownerAddress);
  console.log("⏳ Transaction hash:", contract.deploymentTransaction().hash);
  console.log("⏳ Waiting for deployment confirmation...");

  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();

  console.log("");
  console.log("✅ PrizePool deployed successfully!");
  console.log("📍 Contract Address:", contractAddress);
  console.log("");

  // Verify deployment
  console.log("🔍 Verifying deployment...");
  const usdcAddress = await contract.usdc();
  const owner = await contract.owner();
  const balance = await contract.getPrizePoolBalance();

  console.log("   USDC Address (from contract):", usdcAddress);
  console.log("   Owner (from contract):", owner);
  console.log("   Initial Prize Pool Balance:", balance.toString(), "USDC");
  console.log("");

  // Save deployment info
  const deploymentInfo = {
    network: "Arc Testnet",
    chainId: ARC_CHAIN_ID,
    contractName: "PrizePool",
    contractAddress: contractAddress,
    deployer: wallet.address,
    owner: owner,
    usdcAddress: USDC_ADDRESS,
    deploymentTxHash: contract.deploymentTransaction().hash,
    deployedAt: new Date().toISOString(),
  };

  const deploymentPath = path.join(__dirname, "../prizepool-deployment.json");
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("💾 Deployment info saved to:", deploymentPath);
  console.log("");

  // Update arc-config.ts (optional - manual step)
  console.log("📝 Next steps:");
  console.log("   1. Add PRIZE_POOL_ADDRESS to your .env.local:");
  console.log(`      PRIZE_POOL_ADDRESS=${contractAddress}`);
  console.log("");
  console.log("   2. Update lib/arc-config.ts (if needed):");
  console.log(`      export const PRIZE_POOL_ADDRESS = "${contractAddress}"`);
  console.log("");
  console.log("   3. Verify the contract on Arc Testnet explorer:");
  console.log(`      https://testnet.explorer.arc.network/address/${contractAddress}`);
  console.log("");

  console.log("🎉 Deployment complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });




