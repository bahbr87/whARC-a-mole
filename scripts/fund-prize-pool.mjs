import { Wallet, JsonRpcProvider, Contract } from "ethers"
import * as fs from "fs"
import * as path from "path"
import dotenv from "dotenv"

dotenv.config({ path: path.join(process.cwd(), ".env.local") })

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY
const USDC_CONTRACT_ADDRESS = process.env.USDC_CONTRACT_ADDRESS || "0x6f177b7aE3A3e4E6F2621EFe49922eEd9B9E57C3"
const PRIZE_POOL_CONTRACT_ADDRESS = process.env.PRIZE_POOL_CONTRACT_ADDRESS || "0x877A3129378e6528009fAD82fEd82445A8805F9F"
const RPC_URL = "https://rpc.testnet.arc.network"
const CHAIN_ID = 5042002

if (!DEPLOYER_PRIVATE_KEY) {
  console.error("❌ DEPLOYER_PRIVATE_KEY not found in .env.local")
  process.exit(1)
}

// ERC20 ABI
const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
]

async function main() {
  console.log("=".repeat(60))
  console.log("FUNDING PRIZE POOL WITH USDC")
  console.log("=".repeat(60))
  console.log("RPC URL:", RPC_URL)
  console.log("Chain ID:", CHAIN_ID)

  // Connect to Arc Network
  const provider = new JsonRpcProvider(RPC_URL, CHAIN_ID)
  const wallet = new Wallet(DEPLOYER_PRIVATE_KEY, provider)

  console.log("\n📝 Deployer Address:", wallet.address)
  console.log("💰 USDC Contract:", USDC_CONTRACT_ADDRESS)
  console.log("🏆 PrizePool Contract:", PRIZE_POOL_CONTRACT_ADDRESS)

  // Connect to MockUSDC contract
  const usdcContract = new Contract(USDC_CONTRACT_ADDRESS, ERC20_ABI, wallet)

  // Check deployer's USDC balance
  const deployerBalance = await usdcContract.balanceOf(wallet.address)
  const decimals = await usdcContract.decimals()
  const symbol = await usdcContract.symbol()
  const decimalsBigInt = BigInt(decimals)
  const decimalsDivisor = 10n ** decimalsBigInt

  console.log(`\n💰 Deployer USDC Balance: ${deployerBalance.toString()} (${Number(deployerBalance) / Number(decimalsDivisor)} ${symbol})`)

  // Check PrizePool's current balance
  const prizePoolBalance = await usdcContract.balanceOf(PRIZE_POOL_CONTRACT_ADDRESS)
  console.log(`🏆 PrizePool USDC Balance: ${prizePoolBalance.toString()} (${Number(prizePoolBalance) / Number(decimalsDivisor)} ${symbol})`)

  // Calculate how much to transfer
  // Transfer enough for many days of prizes (e.g., 1000 USDC = 1000 / 35 = ~28 days)
  const amountToTransfer = 1000n * decimalsDivisor // 1000 USDC
  const amountToTransferFormatted = Number(amountToTransfer) / Number(decimalsDivisor)

  console.log(`\n📤 Transferring ${amountToTransferFormatted} ${symbol} to PrizePool...`)

  if (deployerBalance < amountToTransfer) {
    console.error(`\n❌ Insufficient balance!`)
    console.error(`   Deployer has: ${Number(deployerBalance) / Number(decimalsDivisor)} ${symbol}`)
    console.error(`   Need: ${amountToTransferFormatted} ${symbol}`)
    process.exit(1)
  }

  // Transfer USDC to PrizePool
  try {
    const tx = await usdcContract.transfer(PRIZE_POOL_CONTRACT_ADDRESS, amountToTransfer)
    console.log(`   Transaction hash: ${tx.hash}`)
    console.log(`   Waiting for confirmation...`)
    
    await tx.wait()
    
    console.log(`✅ Successfully transferred ${amountToTransferFormatted} ${symbol} to PrizePool!`)
    
    // Check new balances
    const newDeployerBalance = await usdcContract.balanceOf(wallet.address)
    const newPrizePoolBalance = await usdcContract.balanceOf(PRIZE_POOL_CONTRACT_ADDRESS)
    
    console.log(`\n💰 New Deployer Balance: ${Number(newDeployerBalance) / Number(decimalsDivisor)} ${symbol}`)
    console.log(`🏆 New PrizePool Balance: ${Number(newPrizePoolBalance) / Number(decimalsDivisor)} ${symbol}`)
    
    // Calculate how many days of prizes this covers
    const dailyPrizeTotal = 35n * decimalsDivisor // 20 + 10 + 5 = 35 USDC per day
    const daysCovered = Number(newPrizePoolBalance) / Number(dailyPrizeTotal)
    console.log(`\n📅 This covers approximately ${Math.floor(daysCovered)} days of prizes (35 USDC per day)`)
    
    console.log("\n" + "=".repeat(60))
    console.log("✅ PRIZE POOL FUNDED SUCCESSFULLY!")
    console.log("=".repeat(60))
    console.log("\n💡 The PrizePool contract can now pay prizes to winners!")
    console.log("   Winners can claim their prizes using the claimPrize function.")
    
  } catch (error) {
    console.error("\n❌ Error transferring USDC:")
    console.error(error)
    process.exit(1)
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Script failed:")
    console.error(error)
    process.exit(1)
  })

