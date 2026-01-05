const hre = require("hardhat");

async function main() {
  console.log("=".repeat(60));
  console.log("DEPLOYING GAMECREDITS CONTRACT");
  console.log("=".repeat(60));
  
  // Official Arc Testnet USDC address
  const USDC_ADDRESS = "0x3600000000000000000000000000000000000000";
  
  console.log("\n📋 Configuration:");
  console.log("   USDC Address:", USDC_ADDRESS);
  console.log("   Network: Arc Testnet");
  console.log("   Chain ID: 5042002");
  
  const [deployer] = await hre.ethers.getSigners();
  console.log("\n👤 Deploying with account:", deployer.address);
  
  // Check balance
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  const balanceFormatted = Number(balance) / 1_000_000_000_000_000_000; // 18 decimais
  console.log("💰 Balance:", balanceFormatted.toFixed(6), "USDC (for gas)");
  
  if (balance === 0n) {
    console.error("\n❌ Deployer wallet has no USDC for gas!");
    console.error("Please fund the wallet with USDC for gas fees");
    process.exit(1);
  }
  
  console.log("\n📦 Deploying GameCredits...");
  const GameCredits = await hre.ethers.getContractFactory("GameCredits");
  
  const contract = await GameCredits.deploy(USDC_ADDRESS);
  await contract.waitForDeployment();
  
  const contractAddress = await contract.getAddress();
  
  console.log("\n" + "=".repeat(60));
  console.log("✅ DEPLOYMENT SUCCESSFUL!");
  console.log("=".repeat(60));
  console.log("GameCredits deployed at:", contractAddress);
  console.log("Explorer:", `https://testnet.arcscan.app/address/${contractAddress}`);
  console.log("\n📋 Contract Details:");
  
  // Verify CREDIT_PRICE
  const creditPrice = await contract.CREDIT_PRICE();
  const creditPriceUSDC = Number(creditPrice) / 1_000_000;
  console.log("   CREDIT_PRICE:", creditPrice.toString(), `(${creditPriceUSDC} USDC)`);
  
  const clickCost = await contract.CLICK_COST();
  const clickCostUSDC = Number(clickCost) / 1_000_000;
  console.log("   CLICK_COST:", clickCost.toString(), `(${clickCostUSDC} USDC)`);
  
  console.log("\n⚠️  IMPORTANT: Update .env.local with:");
  console.log(`   NEXT_PUBLIC_GAME_CREDITS_ADDRESS=${contractAddress}`);
  console.log(`   GAME_CREDITS_ADDRESS=${contractAddress}`);
  console.log("=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });

