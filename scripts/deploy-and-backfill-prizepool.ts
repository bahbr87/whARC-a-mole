import { ethers, Contract, Wallet, ContractFactory } from "ethers";
import fs from "fs";
import dotenv from "dotenv";
import solc from "solc";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

// --- CONFIGURAÇÃO ---
const RPC_URL = process.env.ARC_RPC_URL || process.env.RPC_URL || "https://rpc.testnet.arc.network";
const OWNER_PRIVATE_KEY = process.env.OWNER_PRIVATE_KEY || process.env.PRIZE_POOL_OWNER_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY;
const USDC_ADDRESS = process.env.USDC_ADDRESS || "0x37225a0bC4bc9f2dAA06F535E7B8BC7AB03636c4"; // USDC da Arc testnet
const RANKINGS_FILE = "./data/rankings.json"; // arquivo JSON com rankings diários

if (!OWNER_PRIVATE_KEY) {
  throw new Error("OWNER_PRIVATE_KEY, PRIZE_POOL_OWNER_PRIVATE_KEY ou DEPLOYER_PRIVATE_KEY não configurado");
}

// --- INICIALIZAÇÃO ---
const provider = new ethers.JsonRpcProvider(RPC_URL);
const ownerWallet = new ethers.Wallet(OWNER_PRIVATE_KEY, provider);

// --- CÓDIGO DO PRIZEPOOL ---
const prizePoolSource = `
pragma solidity ^0.8.20;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
}

contract PrizePool {
    IERC20 public immutable usdc;
    address public owner;

    uint256[3] public prizes = [20e6, 10e6, 5e6]; // USDC: 6 decimais
    mapping(uint256 => mapping(uint8 => address)) public dailyWinners;
    mapping(uint256 => mapping(uint8 => bool)) public claimed;

    constructor(address _usdc) {
        usdc = IERC20(_usdc);
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
        require(block.timestamp <= day + 7 days, "Claim expired");
        _;
    }

    function setDailyWinnersArray(uint256 day, address[3] calldata winners) external onlyOwner {
        for (uint8 i = 0; i < 3; i++) {
            dailyWinners[day][i+1] = winners[i];
            claimed[day][i+1] = false;
        }
    }

    function claimPrize(uint256 day, uint8 rank) external onlyWinner(day, rank) claimPeriod(day) {
        require(!claimed[day][rank], "Already claimed");
        claimed[day][rank] = true;
        require(usdc.transfer(msg.sender, prizes[rank-1]), "USDC transfer failed");
    }

    function backfillWinners(uint256 day, address[3] calldata winners) external onlyOwner {
        for (uint8 i = 0; i < 3; i++) {
            dailyWinners[day][i+1] = winners[i];
            claimed[day][i+1] = false;
        }
    }

    function getWinner(uint256 day, uint8 rank) external view returns (address) {
        return dailyWinners[day][rank];
    }

    function prizesClaimed(uint256 day, uint8 rank) external view returns (bool) {
        return claimed[day][rank];
    }
}
`;

// --- FUNÇÃO AUXILIAR: dias desde epoch ---
function getDaysSinceEpochUTC(date: Date) {
  const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const epoch = new Date(Date.UTC(1970, 0, 1));
  return Math.floor((utcDate.getTime() - epoch.getTime()) / (1000 * 60 * 60 * 24));
}

// --- FUNÇÃO PRINCIPAL ---
async function main() {
  console.log("🚀 Deploying PrizePool...");
  
  // Compilar contrato
  console.log("📦 Compilando PrizePool...");
  const input = {
    language: "Solidity",
    sources: { "PrizePool.sol": { content: prizePoolSource } },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "cancun",
      outputSelection: { "*": { "*": ["abi", "evm.bytecode"] } }
    }
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  
  if (output.errors) {
    const errors = output.errors.filter((e: any) => e.severity === "error");
    if (errors.length > 0) {
      console.error("❌ Compilation errors:");
      errors.forEach((error: any) => console.error(error.formattedMessage));
      process.exit(1);
    }
  }

  const contractFile = output.contracts["PrizePool.sol"]["PrizePool"];
  if (!contractFile) {
    throw new Error("Failed to compile PrizePool contract");
  }

  const abi = contractFile.abi;
  const bytecode = contractFile.evm.bytecode.object;

  const factory = new ethers.ContractFactory(abi, bytecode, ownerWallet);
  const prizePool = await factory.deploy(USDC_ADDRESS);
  await prizePool.waitForDeployment();
  
  const contractAddress = await prizePool.getAddress();
  
  console.log("✅ PrizePool deployado!");
  console.log("Endereço:", contractAddress);
  console.log("Explorer: https://testnet.arcscan.app/address/" + contractAddress);

  // Salvar deployment info
  const deploymentInfo = {
    address: contractAddress,
    abi: abi,
    deployedAt: new Date().toISOString(),
    deployer: ownerWallet.address,
    usdcAddress: USDC_ADDRESS
  };
  fs.writeFileSync("./PrizePoolNew.json", JSON.stringify(deploymentInfo, null, 2));
  console.log("💾 Deployment info salvo em PrizePoolNew.json");

  // --- PUXAR RANKINGS ---
  if (!fs.existsSync(RANKINGS_FILE)) {
    console.warn(`⚠️ Arquivo de rankings não encontrado: ${RANKINGS_FILE}`);
    console.log("Pulando registro de vencedores. Você pode registrar manualmente depois.");
    return;
  }

  const rankingsData = JSON.parse(fs.readFileSync(RANKINGS_FILE, "utf-8"));
  const today = new Date();
  const dayStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 0, 0, 0));
  const dayEnd = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 23, 59, 59));

  const dayRankings = rankingsData
    .filter((r: any) => r.timestamp >= dayStart.getTime() && r.timestamp <= dayEnd.getTime())
    .sort((a: any, b: any) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.goldenMoles !== a.goldenMoles) return b.goldenMoles - a.goldenMoles;
      if (a.errors !== b.errors) return a.errors - b.errors;
      return a.timestamp - b.timestamp;
    });

  // Agrupar por player e somar scores
  const playerMap = new Map<string, any>();
  dayRankings.forEach((r: any) => {
    const existing = playerMap.get(r.player);
    if (existing) {
      existing.score += r.score;
      existing.goldenMoles += r.goldenMoles;
      existing.errors += r.errors;
    } else {
      playerMap.set(r.player, { ...r });
    }
  });

  const sortedPlayers = Array.from(playerMap.values())
    .sort((a: any, b: any) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.goldenMoles !== a.goldenMoles) return b.goldenMoles - a.goldenMoles;
      if (a.errors !== b.errors) return a.errors - b.errors;
      return a.timestamp - b.timestamp;
    });

  const top3 = sortedPlayers.slice(0, 3).map((r: any) => r.player);

  if (top3.length === 0) {
    console.log("⚠️ Nenhum jogador para hoje, não será registrado vencedor.");
    return;
  }

  // Preencher com o primeiro se necessário (para ter sempre 3)
  while (top3.length < 3 && top3.length > 0) {
    top3.push(top3[0]);
  }

  const day = getDaysSinceEpochUTC(today);
  console.log(`📅 Registrando vencedores do dia ${today.toISOString().split("T")[0]} (day=${day}):`);
  top3.forEach((addr, idx) => {
    console.log(`   ${idx + 1}º lugar: ${addr}`);
  });

  const tx = await prizePool.setDailyWinnersArray(day, top3 as [string, string, string]);
  console.log("📤 Transação enviada, aguardando confirmação...");
  console.log("   TX Hash:", tx.hash);
  await tx.wait();
  console.log("✅ Vencedores registrados com sucesso!");
  console.log("🔗 Explorer: https://testnet.arcscan.app/tx/" + tx.hash);
}

main()
  .then(() => console.log("🎯 Script concluído"))
  .catch(e => {
    console.error("❌ Erro:", e);
    process.exit(1);
  });
