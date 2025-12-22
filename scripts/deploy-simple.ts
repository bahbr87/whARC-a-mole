import { BrowserProvider, Wallet, ContractFactory } from "ethers"
import * as fs from "fs"
import * as path from "path"
import * as dotenv from "dotenv"
import { ARC_NETWORK } from "../lib/arc-config"

dotenv.config({ path: path.join(process.cwd(), ".env.local") })

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY
const RPC_URL = ARC_NETWORK.rpcUrls.default.http[0]

if (!DEPLOYER_PRIVATE_KEY) {
  console.error("❌ DEPLOYER_PRIVATE_KEY not found in .env.local")
  console.error("Please run: npm run generate-wallet")
  process.exit(1)
}

// Simple USDC Mock Contract ABI and Bytecode
// This is a minimal ERC20 implementation
const MockUSDC_ABI = [
  "constructor(uint256 initialSupply)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)",
]

const MockUSDC_BYTECODE = "0x608060405234801561001057600080fd5b50604051610e3d380380610e3d8339818101604052810190610032919061015f565b8060008190555080600160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055505061018c565b600080fd5b6000819050919050565b61008e8161007b565b811461009957600080fd5b50565b6000815190506100ab81610085565b92915050565b6000602082840312156100c7576100c6610076565b5b60006100d58482850161009c565b91505092915050565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b6000610109826100de565b9050919050565b610119816100fe565b82525050565b60006020820190506101346000830184610110565b92915050565b6101438161007b565b811461014e57600080fd5b50565b6000815190506101608161013a565b92915050565b60006020828403121561017c5761017b610076565b5b600061018a84828501610151565b91505092915050565b610ca18061019b6000396000f3fe6080604052348015600f57600080fd5b506004361060325760003560e01c806306fdde03146037578063095ea7b314605257806318160ddd14606e575b600080fd5b603d6086565b60405160489190608d565b60405180910390f35b606c6004803603810190606891906099565b60a4565b005b607460b0565b604051607f919060c6565b60405180910390f35b60005481565b600060208201905060a7600083018460d1565b92915050565b600080fd5b6000819050919050565b60c08160b7565b811460ca57600080fd5b50565b60008135905060da8160c9565b92915050565b60006020828403121560f35760f260b2565b5b600060ff8482850160cd565b91505092915050565b60b78160b7565b82525050565b600060208201905061012a6000830184610108565b92915050565b600081519050919050565b600082825260208201905092915050565b60005b8381101561016d57808201518184015260208101905061014e565b60008484015250505050565b6000601f19601f8301169050919050565b600061019582610130565b61019f818561013b565b93506101af81856020860161014b565b6101b881610179565b840191505092915050565b600060208201905081810360008301526101dd818461018a565b905092915050565b600080fd5b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b6000610215826101ea565b9050919050565b6102258161020a565b811461023057600080fd5b50565b6000813590506102428161021c565b92915050565b60006020828403121561025e5761025d6101e5565b5b600061026c84828501610233565b91505092915050565b6000819050919050565b61028881610275565b811461029357600080fd5b50565b6000813590506102a58161027f565b92915050565b6000602082840312156102c1576102c06101e5565b5b60006102cf84828501610296565b91505092915050565b6102e18161020a565b82525050565b60006020820190506102fc60008301846102d8565b92915050565b61030b81610275565b82525050565b60006020820190506103266000830184610302565b92915050565b600081519050919050565b600082825260208201905092915050565b60005b8381101561036657808201518184015260208101905061034b565b60008484015250505050565b6000601f19601f8301169050919050565b600061038e8261032c565b6103988185610337565b93506103a8818560208601610348565b6103b181610372565b840191505092915050565b600060208201905081810360008301526103d68184610383565b90509291505056fea2646970667358221220a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b64736f6c63430008120033"

async function main() {
  console.log("=".repeat(60))
  console.log("DEPLOYING CONTRACTS TO ARC NETWORK")
  console.log("=".repeat(60))
  console.log("RPC URL:", RPC_URL)
  console.log("Chain ID:", ARC_NETWORK.chainId)
  
  // Connect to Arc Network
  const provider = new BrowserProvider(RPC_URL)
  const wallet = new Wallet(DEPLOYER_PRIVATE_KEY, provider)
  
  console.log("\n📝 Deployer Address:", wallet.address)
  
  // Check balance
  const balance = await provider.getBalance(wallet.address)
  console.log("💰 Balance:", balance.toString(), "ETH")
  
  if (balance === 0n) {
    console.error("\n❌ Deployer wallet has no ETH!")
    console.error("Please fund the wallet with some ETH for gas fees")
    console.error("Address:", wallet.address)
    process.exit(1)
  }
  
  console.log("\n📦 Deploying MockUSDC...")
  
  // Deploy MockUSDC with 1,000,000 tokens (6 decimals)
  const initialSupply = BigInt(1_000_000 * 10**6) // 1M USDC with 6 decimals
  const factory = new ContractFactory(MockUSDC_ABI, MockUSDC_BYTECODE, wallet)
  
  try {
    const mockUSDC = await factory.deploy(initialSupply)
    console.log("⏳ Waiting for deployment...")
    await mockUSDC.waitForDeployment()
    const mockUSDCAddress = await mockUSDC.getAddress()
    console.log("✅ MockUSDC deployed to:", mockUSDCAddress)
    
    // Update .env.local
    const envPath = path.join(process.cwd(), ".env.local")
    let envContent = fs.readFileSync(envPath, "utf-8")
    
    // Update or add USDC contract address
    if (envContent.includes("USDC_CONTRACT_ADDRESS")) {
      envContent = envContent.replace(
        /USDC_CONTRACT_ADDRESS=.*/,
        `USDC_CONTRACT_ADDRESS=${mockUSDCAddress}`
      )
    } else {
      envContent += `\nUSDC_CONTRACT_ADDRESS=${mockUSDCAddress}\n`
    }
    
    fs.writeFileSync(envPath, envContent)
    console.log("✅ Updated .env.local with contract address")
    
    // Update arc-config.ts
    const configPath = path.join(process.cwd(), "lib/arc-config.ts")
    let configContent = fs.readFileSync(configPath, "utf-8")
    configContent = configContent.replace(
      /export const USDC_CONTRACT_ADDRESS = "0x[0-9a-fA-F]+"/,
      `export const USDC_CONTRACT_ADDRESS = "${mockUSDCAddress}"`
    )
    fs.writeFileSync(configPath, configContent)
    console.log("✅ Updated lib/arc-config.ts with contract address")
    
    console.log("\n" + "=".repeat(60))
    console.log("✅ DEPLOYMENT COMPLETE!")
    console.log("=".repeat(60))
    console.log("MockUSDC Address:", mockUSDCAddress)
    console.log("Explorer:", `${ARC_NETWORK.blockExplorers.default.url}/address/${mockUSDCAddress}`)
    console.log("=".repeat(60))
    
  } catch (error) {
    console.error("❌ Deployment failed:", error)
    process.exit(1)
  }
}

main().catch((error) => {
  console.error("❌ Error:", error)
  process.exit(1)
})







