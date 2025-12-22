import { Wallet, JsonRpcProvider, ContractFactory } from "ethers"
import * as fs from "fs"
import * as path from "path"
import solc from "solc"
import dotenv from "dotenv"

dotenv.config({ path: path.join(process.cwd(), ".env.local") })

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY
const RPC_URL = "https://rpc.testnet.arc.network" // Arc Testnet RPC
const CHAIN_ID = 5042002 // Arc Testnet Chain ID

if (!DEPLOYER_PRIVATE_KEY) {
  console.error("❌ DEPLOYER_PRIVATE_KEY not found in .env.local")
  process.exit(1)
}

// Simple ERC20 ABI (minimal for transfer)
const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
]

async function main() {
  console.log("=".repeat(60))
  console.log("DEPLOYING CONTRACTS TO ARC TESTNET (Direct Ethers.js)")
  console.log("=".repeat(60))
  console.log("RPC URL:", RPC_URL)
  console.log("Chain ID:", CHAIN_ID)

  // Connect to Arc Network
  const provider = new JsonRpcProvider(RPC_URL, CHAIN_ID)
  const wallet = new Wallet(DEPLOYER_PRIVATE_KEY, provider)

  console.log("\n📝 Deployer Address:", wallet.address)

  // Check balance (USDC for gas)
  try {
    const balance = await provider.getBalance(wallet.address)
    console.log("💰 Balance:", balance.toString(), "USDC (for gas)")
    
    if (balance < 1000000n) { // Less than 1 USDC (6 decimals)
      console.error("\n❌ Deployer wallet has insufficient USDC for gas!")
      console.error("Please fund the wallet with some USDC for gas fees (e.g., 10 USDC)")
      console.error("Address:", wallet.address)
      console.error("You can get testnet USDC from Circle Faucet: https://faucet.circle.com")
      process.exit(1)
    }
  } catch (error) {
    console.warn("Could not check balance, but continuing...", error.message)
  }

  // 1. Compile Contracts
  console.log("\n📦 Compiling contracts...")
  
  const contractsPath = path.join(process.cwd(), "contracts")
  const nodeModulesPath = path.join(process.cwd(), "node_modules")
  
  // Read contract files
  const mockUSDCPath = path.join(contractsPath, "MockUSDC.sol")
  const prizePoolPath = path.join(contractsPath, "PrizePool.sol")
  const gameCreditsPath = path.join(contractsPath, "GameCredits.sol")
  const metaTransactionProcessorPath = path.join(contractsPath, "MetaTransactionProcessor.sol")
  
  // Read OpenZeppelin contracts
  const openzeppelinPath = path.join(nodeModulesPath, "@openzeppelin", "contracts")
  
  function readFileIfExists(filePath) {
    try {
      return fs.readFileSync(filePath, "utf8")
    } catch (error) {
      return null
    }
  }

  const solidityFiles = {
    "MockUSDC.sol": fs.readFileSync(mockUSDCPath, "utf8"),
    "PrizePool.sol": fs.readFileSync(prizePoolPath, "utf8"),
    "GameCredits.sol": fs.readFileSync(gameCreditsPath, "utf8"),
    "MetaTransactionProcessor.sol": fs.readFileSync(metaTransactionProcessorPath, "utf8"),
  }

  // Add OpenZeppelin contracts (including all dependencies)
  // Function to recursively find and add dependencies
  function addContractWithDependencies(contractPath, visited = new Set()) {
    if (visited.has(contractPath)) return
    visited.add(contractPath)

    const fullPath = path.join(openzeppelinPath, contractPath)
    const content = readFileIfExists(fullPath)
    
    if (!content) {
      console.warn(`⚠️  Warning: Could not find ${contractPath}`)
      return
    }

    solidityFiles[`@openzeppelin/contracts/${contractPath}`] = content

    // Extract imports from the file - handle both relative and absolute paths
    const importRegexes = [
      /import\s+[^"']*["'](@openzeppelin\/contracts\/[^"']+)["']/g,
      /import\s+[^"']*["'](\.\.\/[^"']+)["']/g,
      /import\s+[^"']*["'](\.\/[^"']+)["']/g,
    ]

    for (const regex of importRegexes) {
      let match
      while ((match = regex.exec(content)) !== null) {
        let importPath = match[1]
        
        // Handle relative paths
        if (importPath.startsWith("../") || importPath.startsWith("./")) {
          const currentDir = path.dirname(contractPath)
          importPath = path.join(currentDir, importPath).replace(/\\/g, "/")
          // Normalize path
          const parts = importPath.split("/")
          const normalized = []
          for (const part of parts) {
            if (part === "..") {
              normalized.pop()
            } else if (part !== "." && part !== "") {
              normalized.push(part)
            }
          }
          importPath = normalized.join("/")
        } else if (importPath.startsWith("@openzeppelin/contracts/")) {
          importPath = importPath.replace("@openzeppelin/contracts/", "")
        }
        
        if (importPath && !importPath.startsWith("@")) {
          addContractWithDependencies(importPath, visited)
        }
      }
    }
  }

  // Start with the contracts we need
  const initialContracts = [
    "token/ERC20/ERC20.sol",
    "token/ERC20/IERC20.sol",
    "token/ERC20/extensions/IERC20Metadata.sol",
    "access/Ownable.sol",
    "utils/ReentrancyGuard.sol",
    "utils/Context.sol",
    "utils/cryptography/ECDSA.sol",
    "utils/cryptography/EIP712.sol",
  ]

  for (const contractPath of initialContracts) {
    addContractWithDependencies(contractPath)
  }

  const input = {
    language: "Solidity",
    sources: Object.fromEntries(
      Object.entries(solidityFiles).map(([key, value]) => [key, { content: value }])
    ),
    settings: {
      outputSelection: {
        "*": {
          "*": ["abi", "evm.bytecode"],
        },
      },
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  }

  const output = JSON.parse(solc.compile(JSON.stringify(input)))

  if (output.errors) {
    const errors = output.errors.filter((err) => err.severity === "error")
    if (errors.length > 0) {
      console.error("\n❌ Compilation errors:")
      errors.forEach((err) => {
        console.error(err.formattedMessage || err.message)
      })
      process.exit(1)
    }
  }

  const MockUSDC = output.contracts["MockUSDC.sol"]["MockUSDC"]
  const PrizePool = output.contracts["PrizePool.sol"]["PrizePool"]
  const GameCredits = output.contracts["GameCredits.sol"]["GameCredits"]
  const MetaTransactionProcessor = output.contracts["MetaTransactionProcessor.sol"]["MetaTransactionProcessor"]

  if (!MockUSDC || !PrizePool || !GameCredits || !MetaTransactionProcessor) {
    console.error("❌ Failed to compile contracts")
    console.error("Available contracts:", Object.keys(output.contracts))
    if (!MockUSDC) console.error("Missing: MockUSDC")
    if (!PrizePool) console.error("Missing: PrizePool")
    if (!GameCredits) console.error("Missing: GameCredits")
    if (!MetaTransactionProcessor) console.error("Missing: MetaTransactionProcessor")
    process.exit(1)
  }

  console.log("✅ Contracts compiled successfully")

  // 2. Deploy MockUSDC
  console.log("\n📦 Deploying MockUSDC...")
  const MockUSDCFactory = new ContractFactory(MockUSDC.abi, MockUSDC.evm.bytecode.object, wallet)
  const mockUSDCContract = await MockUSDCFactory.deploy()
  await mockUSDCContract.waitForDeployment()
  const mockUSDCAddress = await mockUSDCContract.getAddress()
  console.log("✅ MockUSDC deployed to:", mockUSDCAddress)
  console.log("   Explorer:", `https://testnet.arcscan.app/address/${mockUSDCAddress}`)

  // 3. Deploy PrizePool
  console.log("\n📦 Deploying PrizePool...")
  const PrizePoolFactory = new ContractFactory(PrizePool.abi, PrizePool.evm.bytecode.object, wallet)
  const prizePoolContract = await PrizePoolFactory.deploy(mockUSDCAddress)
  await prizePoolContract.waitForDeployment()
  const prizePoolAddress = await prizePoolContract.getAddress()
  console.log("✅ PrizePool deployed to:", prizePoolAddress)
  console.log("   Explorer:", `https://testnet.arcscan.app/address/${prizePoolAddress}`)

  // 4. Deploy GameCredits
  console.log("\n📦 Deploying GameCredits...")
  const GameCreditsFactory = new ContractFactory(GameCredits.abi, GameCredits.evm.bytecode.object, wallet)
  const gameCreditsContract = await GameCreditsFactory.deploy(mockUSDCAddress)
  await gameCreditsContract.waitForDeployment()
  const gameCreditsAddress = await gameCreditsContract.getAddress()
  console.log("✅ GameCredits deployed to:", gameCreditsAddress)
  console.log("   Explorer:", `https://testnet.arcscan.app/address/${gameCreditsAddress}`)

  // 5. Deploy MetaTransactionProcessor
  console.log("\n📦 Deploying MetaTransactionProcessor...")
  const MetaTransactionProcessorFactory = new ContractFactory(MetaTransactionProcessor.abi, MetaTransactionProcessor.evm.bytecode.object, wallet)
  // Relayer will be set to deployer for now, can be changed later
  const metaTransactionProcessorContract = await MetaTransactionProcessorFactory.deploy(gameCreditsAddress, wallet.address)
  await metaTransactionProcessorContract.waitForDeployment()
  const metaTransactionProcessorAddress = await metaTransactionProcessorContract.getAddress()
  console.log("✅ MetaTransactionProcessor deployed to:", metaTransactionProcessorAddress)
  console.log("   Explorer:", `https://testnet.arcscan.app/address/${metaTransactionProcessorAddress}`)

  // 6. Authorize MetaTransactionProcessor in GameCredits
  console.log("\n🔐 Authorizing MetaTransactionProcessor in GameCredits...")
  const authorizeTx = await gameCreditsContract.authorizeConsumer(metaTransactionProcessorAddress)
  await authorizeTx.wait()
  console.log("✅ MetaTransactionProcessor authorized in GameCredits")

  // 4. Update configuration files
  console.log("\n📝 Updating configuration files...")
  
  const deploymentInfo = {
    MockUSDC: mockUSDCAddress,
    PrizePool: prizePoolAddress,
    GameCredits: gameCreditsAddress,
    MetaTransactionProcessor: metaTransactionProcessorAddress,
    Deployer: wallet.address,
    Relayer: wallet.address, // Can be changed later
    Network: "Arc Testnet",
    ChainId: CHAIN_ID,
    Timestamp: new Date().toISOString(),
  }

  // Update lib/arc-config.ts
  const arcConfigPath = path.join(process.cwd(), "lib", "arc-config.ts")
  let arcConfigContent = fs.readFileSync(arcConfigPath, "utf8")
  arcConfigContent = arcConfigContent.replace(
    /export const USDC_CONTRACT_ADDRESS = "0x[0-9a-fA-F]{40}"/,
    `export const USDC_CONTRACT_ADDRESS = "${mockUSDCAddress}"`
  )
  fs.writeFileSync(arcConfigPath, arcConfigContent)
  console.log("✅ Updated lib/arc-config.ts with MockUSDC address")

  // Update .env.local
  const envLocalPath = path.join(process.cwd(), ".env.local")
  let envLocalContent = ""
  try {
    envLocalContent = fs.readFileSync(envLocalPath, "utf8")
  } catch (error) {
    // File doesn't exist, create it
  }

  // Update or add USDC_CONTRACT_ADDRESS
  if (envLocalContent.includes("USDC_CONTRACT_ADDRESS")) {
    envLocalContent = envLocalContent.replace(
      /USDC_CONTRACT_ADDRESS=0x[0-9a-fA-F]{40}/,
      `USDC_CONTRACT_ADDRESS=${mockUSDCAddress}`
    )
  } else {
    envLocalContent += `\nUSDC_CONTRACT_ADDRESS=${mockUSDCAddress}\n`
  }

  // Update or add PRIZE_POOL_CONTRACT_ADDRESS
  if (envLocalContent.includes("PRIZE_POOL_CONTRACT_ADDRESS")) {
    envLocalContent = envLocalContent.replace(
      /PRIZE_POOL_CONTRACT_ADDRESS=0x[0-9a-fA-F]{40}/,
      `PRIZE_POOL_CONTRACT_ADDRESS=${prizePoolAddress}`
    )
  } else {
    envLocalContent += `PRIZE_POOL_CONTRACT_ADDRESS=${prizePoolAddress}\n`
  }

  // Update or add GAME_CREDITS_ADDRESS
  if (envLocalContent.includes("GAME_CREDITS_ADDRESS")) {
    envLocalContent = envLocalContent.replace(
      /GAME_CREDITS_ADDRESS=0x[0-9a-fA-F]{40}/,
      `GAME_CREDITS_ADDRESS=${gameCreditsAddress}`
    )
  } else {
    envLocalContent += `GAME_CREDITS_ADDRESS=${gameCreditsAddress}\n`
  }

  // Update or add NEXT_PUBLIC_GAME_CREDITS_ADDRESS
  if (envLocalContent.includes("NEXT_PUBLIC_GAME_CREDITS_ADDRESS")) {
    envLocalContent = envLocalContent.replace(
      /NEXT_PUBLIC_GAME_CREDITS_ADDRESS=0x[0-9a-fA-F]{40}/,
      `NEXT_PUBLIC_GAME_CREDITS_ADDRESS=${gameCreditsAddress}`
    )
  } else {
    envLocalContent += `NEXT_PUBLIC_GAME_CREDITS_ADDRESS=${gameCreditsAddress}\n`
  }

  // Update or add META_TRANSACTION_ADDRESS
  if (envLocalContent.includes("META_TRANSACTION_ADDRESS")) {
    envLocalContent = envLocalContent.replace(
      /META_TRANSACTION_ADDRESS=0x[0-9a-fA-F]{40}/,
      `META_TRANSACTION_ADDRESS=${metaTransactionProcessorAddress}`
    )
  } else {
    envLocalContent += `META_TRANSACTION_ADDRESS=${metaTransactionProcessorAddress}\n`
  }

  // Update or add NEXT_PUBLIC_META_TRANSACTION_ADDRESS
  if (envLocalContent.includes("NEXT_PUBLIC_META_TRANSACTION_ADDRESS")) {
    envLocalContent = envLocalContent.replace(
      /NEXT_PUBLIC_META_TRANSACTION_ADDRESS=0x[0-9a-fA-F]{40}/,
      `NEXT_PUBLIC_META_TRANSACTION_ADDRESS=${metaTransactionProcessorAddress}`
    )
  } else {
    envLocalContent += `NEXT_PUBLIC_META_TRANSACTION_ADDRESS=${metaTransactionProcessorAddress}\n`
  }

  // Add RELAYER_PRIVATE_KEY if not exists (use deployer for now)
  if (!envLocalContent.includes("RELAYER_PRIVATE_KEY")) {
    envLocalContent += `RELAYER_PRIVATE_KEY=${DEPLOYER_PRIVATE_KEY}\n`
    console.log("⚠️  Using deployer private key as relayer. Change this in production!")
  }

  fs.writeFileSync(envLocalPath, envLocalContent)
  console.log("✅ Updated .env.local with contract addresses")

  // Save deployment info to a JSON file
  const deploymentJsonPath = path.join(process.cwd(), "deployment.json")
  fs.writeFileSync(deploymentJsonPath, JSON.stringify(deploymentInfo, null, 2))
  console.log("✅ Deployment info saved to deployment.json")

  console.log("\n" + "=".repeat(60))
  console.log("✅ DEPLOYMENT COMPLETE!")
  console.log("=".repeat(60))
  console.log("\n📋 Contract Addresses:")
  console.log("   MockUSDC:", mockUSDCAddress)
  console.log("   PrizePool:", prizePoolAddress)
  console.log("   GameCredits:", gameCreditsAddress)
  console.log("   MetaTransactionProcessor:", metaTransactionProcessorAddress)
  console.log("\n🔗 View on Explorer:")
  console.log("   MockUSDC:", `https://testnet.arcscan.app/address/${mockUSDCAddress}`)
  console.log("   PrizePool:", `https://testnet.arcscan.app/address/${prizePoolAddress}`)
  console.log("   GameCredits:", `https://testnet.arcscan.app/address/${gameCreditsAddress}`)
  console.log("   MetaTransactionProcessor:", `https://testnet.arcscan.app/address/${metaTransactionProcessorAddress}`)
  console.log("\n💡 Next Steps:")
  console.log("   1. Fund PrizePool with USDC for prizes")
  console.log("   2. Fund relayer wallet with USDC for gas fees")
  console.log("   3. Test the claim functionality")
  console.log("   4. Test credit purchase and click processing")
  console.log("   5. Update your frontend to use these addresses")
  console.log("\n⚠️  IMPORTANT:")
  console.log("   - Relayer private key is set to deployer key (change in production!)")
  console.log("   - Relayer wallet needs USDC for gas fees")
  console.log("=".repeat(60))
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:")
    console.error(error)
    process.exit(1)
  })
