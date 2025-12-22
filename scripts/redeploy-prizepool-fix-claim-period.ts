import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import solc from "solc";
import dotenv from "dotenv";

dotenv.config();

const RPC_URL = process.env.ARC_RPC_URL || process.env.RPC_URL || "https://rpc.testnet.arc.network";
const OWNER_PRIVATE_KEY = process.env.OWNER_PRIVATE_KEY!;
const USDC_ADDRESS = "0x3600000000000000000000000000000000000000"; // USDC oficial Arc Testnet

if (!OWNER_PRIVATE_KEY) {
  throw new Error("OWNER_PRIVATE_KEY não configurado no .env.local");
}

// PrizePool Solidity com correção do claimPeriod
const prizePoolSol = `
pragma solidity ^0.8.20;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract PrizePool {
    IERC20 public usdcToken;
    address public owner;

    uint256 public constant CLAIM_PERIOD = 7 days;
    uint256[3] public prizes = [20e6, 10e6, 5e6];

    mapping(uint256 => mapping(uint8 => address)) public dailyWinners;
    mapping(uint256 => mapping(uint8 => bool)) public claimed;

    constructor(address _usdc) {
        usdcToken = IERC20(_usdc);
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyWinner(uint256 day, uint8 rank) {
        require(dailyWinners[day][rank] == msg.sender, "Not winner");
        _;
    }

    modifier claimPeriod(uint256 day) {
        // day is days since epoch, convert to timestamp (seconds) before adding CLAIM_PERIOD
        require(block.timestamp <= (day * 1 days) + CLAIM_PERIOD, "Claim expired");
        _;
    }

    function setDailyWinners(uint256 day, address[3] calldata winners) external onlyOwner {
        for (uint8 i = 0; i < 3; i++) {
            dailyWinners[day][i+1] = winners[i];
            claimed[day][i+1] = false;
        }
    }

    function claimPrize(uint256 day, uint8 rank) external onlyWinner(day, rank) claimPeriod(day) {
        require(!claimed[day][rank], "Already claimed");
        uint256 prize = prizes[rank-1];
        require(usdcToken.balanceOf(address(this)) >= prize, "Insufficient balance");
        claimed[day][rank] = true;
        usdcToken.transfer(msg.sender, prize);
    }

    function withdraw(uint256 amount) external onlyOwner {
        usdcToken.transfer(owner, amount);
    }

    function getWinner(uint256 day, uint8 rank) external view returns (address) {
        return dailyWinners[day][rank];
    }

    function prizesClaimed(uint256 day, uint8 rank) external view returns (bool) {
        return claimed[day][rank];
    }
}
`;

function compileContract(source: string, contractName: string) {
  const input = {
    language: "Solidity",
    sources: {
      "PrizePool.sol": { content: source }
    },
    settings: {
      outputSelection: {
        "*": {
          "*": ["abi", "evm.bytecode"]
        }
      },
      optimizer: {
        enabled: true,
        runs: 200
      },
      evmVersion: "cancun"
    }
  };
  
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  
  if (output.errors) {
    const errors = output.errors.filter((e: any) => e.severity === "error");
    if (errors.length > 0) {
      console.error("❌ Compilation errors:");
      errors.forEach((error: any) => console.error(error.formattedMessage));
      throw new Error("Compilation failed");
    }
  }
  
  const contract = output.contracts["PrizePool.sol"][contractName];
  if (!contract) {
    throw new Error(`Contract ${contractName} not found in compilation output`);
  }
  
  return {
    abi: contract.abi,
    bytecode: contract.evm.bytecode.object
  };
}

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(OWNER_PRIVATE_KEY, provider);

  console.log("📌 Redeployando PrizePool com correção do claimPeriod...");
  console.log("🔑 Wallet:", wallet.address);
  console.log("💵 USDC:", USDC_ADDRESS);
  
  // Compilar contrato
  const { abi, bytecode } = compileContract(prizePoolSol, "PrizePool");

  const factory = new ethers.ContractFactory(abi, bytecode, wallet);
  const prizePool = await factory.deploy(USDC_ADDRESS);
  await prizePool.waitForDeployment();

  const contractAddress = await prizePool.getAddress();
  console.log("✅ PrizePool deployed at:", contractAddress);
  console.log("🔗 Explorer: https://testnet.arcscan.app/address/" + contractAddress);

  // Salvar deployment info
  const deploymentInfo = {
    address: contractAddress,
    abi: abi,
    deployedAt: new Date().toISOString(),
    fix: "claimPeriod modifier now correctly converts day to timestamp"
  };

  fs.writeFileSync(
    path.join(process.cwd(), "PrizePoolFixed.json"),
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log("\n📝 Deployment info saved to PrizePoolFixed.json");
  console.log("\n⚠️ IMPORTANTE: Atualize NEXT_PUBLIC_PRIZE_POOL_CONTRACT_ADDRESS no .env.local para:", contractAddress);
}

main().catch((err) => {
  console.error("❌ Erro:", err);
  process.exit(1);
});




