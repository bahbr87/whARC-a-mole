import { ethers } from "hardhat"
import * as fs from "fs"
import * as path from "path"
import { ARC_NETWORK } from "../lib/arc-config"

async function main() {
  console.log("=".repeat(60))
  console.log("DEPLOYING CONTRACTS TO ARC NETWORK")
  console.log("=".repeat(60))
  console.log("RPC URL:", ARC_NETWORK.rpcUrls.default.http[0])
  console.log("Chain ID:", ARC_NETWORK.chainId)
  
  const [deployer] = await ethers.getSigners()
  console.log("\n📝 Deploying with account:", deployer.address)
  
  const balance = await ethers.provider.getBalance(deployer.address)
  console.log("💰 Account balance:", ethers.formatEther(balance), "ETH")
  
  if (balance === 0n) {
    console.error("\n❌ Deployer wallet has no ETH!")
    console.error("Please fund the wallet with some ETH for gas fees")
    console.error("Address:", deployer.address)
    process.exit(1)
  }
  
  // Deploy MockUSDC
  console.log("\n📦 Deploying MockUSDC...")
  const MockUSDC = await ethers.getContractFactory("MockUSDC")
  const initialSupply = ethers.parseUnits("1000000", 6) // 1M USDC with 6 decimals
  const mockUSDC = await MockUSDC.deploy()
  await mockUSDC.waitForDeployment()
  const mockUSDCAddress = await mockUSDC.getAddress()
  console.log("✅ MockUSDC deployed to:", mockUSDCAddress)
  
  // Deploy PrizePool
  console.log("\n📦 Deploying PrizePool...")
  const PrizePool = await ethers.getContractFactory("PrizePool")
  const prizePool = await PrizePool.deploy(mockUSDCAddress)
  await prizePool.waitForDeployment()
  const prizePoolAddress = await prizePool.getAddress()
  console.log("✅ PrizePool deployed to:", prizePoolAddress)
  
  // Transfer some USDC to PrizePool for prizes
  console.log("\n💰 Funding PrizePool with USDC...")
  const prizeAmount = ethers.parseUnits("1000", 6) // 1000 USDC for prizes
  await mockUSDC.transfer(prizePoolAddress, prizeAmount)
  console.log("✅ Transferred", ethers.formatUnits(prizeAmount, 6), "USDC to PrizePool")
  
  // Update .env.local
  const envPath = path.join(process.cwd(), ".env.local")
  let envContent = fs.readFileSync(envPath, "utf-8")
  
  // Update or add contract addresses
  if (envContent.includes("USDC_CONTRACT_ADDRESS")) {
    envContent = envContent.replace(
      /USDC_CONTRACT_ADDRESS=.*/,
      `USDC_CONTRACT_ADDRESS=${mockUSDCAddress}`
    )
  } else {
    envContent += `\nUSDC_CONTRACT_ADDRESS=${mockUSDCAddress}\n`
  }
  
  if (envContent.includes("PRIZE_POOL_ADDRESS")) {
    envContent = envContent.replace(
      /PRIZE_POOL_ADDRESS=.*/,
      `PRIZE_POOL_ADDRESS=${prizePoolAddress}`
    )
  } else {
    envContent += `\nPRIZE_POOL_ADDRESS=${prizePoolAddress}\n`
  }
  
  fs.writeFileSync(envPath, envContent)
  console.log("✅ Updated .env.local with contract addresses")
  
  // Update arc-config.ts
  const configPath = path.join(process.cwd(), "lib/arc-config.ts")
  let configContent = fs.readFileSync(configPath, "utf-8")
  configContent = configContent.replace(
    /export const USDC_CONTRACT_ADDRESS = "0x[0-9a-fA-F]+"/,
    `export const USDC_CONTRACT_ADDRESS = "${mockUSDCAddress}"`
  )
  fs.writeFileSync(configPath, configContent)
  console.log("✅ Updated lib/arc-config.ts with contract address")
  
  // Save deployment info
  const deploymentInfo = {
    network: "Arc Network",
    chainId: ARC_NETWORK.chainId,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      mockUSDC: mockUSDCAddress,
      prizePool: prizePoolAddress,
    },
    explorer: ARC_NETWORK.blockExplorers.default.url,
  }
  
  fs.writeFileSync(
    path.join(process.cwd(), "deployment.json"),
    JSON.stringify(deploymentInfo, null, 2)
  )
  
  console.log("\n" + "=".repeat(60))
  console.log("✅ DEPLOYMENT COMPLETE!")
  console.log("=".repeat(60))
  console.log("MockUSDC Address:", mockUSDCAddress)
  console.log("PrizePool Address:", prizePoolAddress)
  console.log("Explorer:", `${ARC_NETWORK.blockExplorers.default.url}/address/${mockUSDCAddress}`)
  console.log("=".repeat(60))
  console.log("\n📄 Deployment info saved to deployment.json")
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error)
    process.exit(1)
  })







