import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import solc from "solc";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { getDailyRankings, buildDailyWinners } from "./game-backend";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const RPC_URL = process.env.ARC_RPC_URL || process.env.RPC_URL || "https://rpc.testnet.arc.network";
const OWNER_PRIVATE_KEY = process.env.OWNER_PRIVATE_KEY || process.env.PRIZE_POOL_OWNER_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY;
const USDC_ADDRESS = "0x3600000000000000000000000000000000000000"; // USDC oficial Arc Testnet
const PRIZE_AMOUNTS = [20 * 1e6, 10 * 1e6, 5 * 1e6]; // USDC com 6 decimais

if (!OWNER_PRIVATE_KEY) {
  throw new Error("OWNER_PRIVATE_KEY, PRIZE_POOL_OWNER_PRIVATE_KEY ou DEPLOYER_PRIVATE_KEY não configurado");
}

function getDaysSinceEpochUTC(date: Date): number {
  const utc = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const epoch = Date.UTC(1970, 0, 1);
  return Math.floor((utc - epoch) / (1000 * 60 * 60 * 24));
}

// PrizePool Solidity
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
      optimizer: {
        enabled: true,
        runs: 200
      },
      evmVersion: "cancun",
      outputSelection: {
        "*": {
          "*": ["abi", "evm.bytecode"]
        }
      }
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

  console.log("📌 Compilando e deployando PrizePool...");
  
  // Compilar contrato
  const { abi, bytecode } = compileContract(prizePoolSol, "PrizePool");
  
  const factory = new ethers.ContractFactory(abi, bytecode, wallet);
  const prizePool = await factory.deploy(USDC_ADDRESS);
  await prizePool.waitForDeployment();

  const contractAddress = await prizePool.getAddress();
  console.log("✅ PrizePool deployed at:", contractAddress);
  console.log("📍 Explorer: https://testnet.arcscan.app/address/" + contractAddress);

  // Salvar deployment info
  const deploymentInfo = {
    address: contractAddress,
    abi: abi,
    deployedAt: new Date().toISOString(),
    deployer: wallet.address,
    usdcAddress: USDC_ADDRESS
  };
  fs.writeFileSync("./PrizePoolNew.json", JSON.stringify(deploymentInfo, null, 2));
  console.log("💾 Deployment info salvo em PrizePoolNew.json");

  const now = new Date();
  const dayUTC = getDaysSinceEpochUTC(now);

  console.log("📋 Fetching winners from backend...");
  const rankedPlayers = await getDailyRankings(dayUTC);

  if (rankedPlayers.length === 0) {
    console.log("⚠️ Nenhum vencedor encontrado para hoje. Pulando registro.");
    return;
  }

  // Construir vencedores usando a função correta
  const { first, second, third } = buildDailyWinners(rankedPlayers);

  console.log("🏆 Winners:");
  console.log("   1º lugar:", first);
  console.log("   2º lugar:", second);
  console.log("   3º lugar:", third);

  // O contrato aceita 3 parâmetros separados: setDailyWinners(day, first, second, third)
  const txWinners = await prizePool.setDailyWinners(dayUTC, first, second, third);
  console.log("📤 Transação enviada, aguardando confirmação...");
  console.log("   TX Hash:", txWinners.hash);
  await txWinners.wait();
  
  console.log("✅ Winners set! Players can now claim prizes automatically.");
  console.log("🔗 Explorer: https://testnet.arcscan.app/tx/" + txWinners.hash);
}

main().catch(console.error);
