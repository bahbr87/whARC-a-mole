import { ethers } from "ethers";

const OLD_CONTRACT = "0xB6EF59882778d0A245202F1482f20f02ad82bd87";
const RPC_URL = "https://rpc.testnet.arc.network";
const CHAIN_ID = 5042002;

const ABI = [
  "event CreditsPurchased(address indexed player, uint256 amount, uint256 creditsReceived, uint256 totalCost)",
  "function credits(address player) view returns (uint256)"
];

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL, CHAIN_ID);

  const contract = new ethers.Contract(
    OLD_CONTRACT,
    ABI,
    provider
  );

  console.log("🔍 Searching purchases...");

  // Get current block number
  const currentBlock = await provider.getBlockNumber();
  console.log(`📍 Current block: ${currentBlock}`);

  const filter = contract.filters.CreditsPurchased();
  
  // Query in chunks of 5000 blocks to avoid RPC limits
  const CHUNK_SIZE = 5000;
  const events = [];
  let fromBlock = 0;
  let toBlock = Math.min(fromBlock + CHUNK_SIZE, currentBlock);

  while (fromBlock <= currentBlock) {
    try {
      console.log(`🔍 Querying blocks ${fromBlock} to ${toBlock}...`);
      const chunkEvents = await contract.queryFilter(filter, fromBlock, toBlock);
      events.push(...chunkEvents);
      console.log(`   Found ${chunkEvents.length} events in this chunk`);
      
      fromBlock = toBlock + 1;
      toBlock = Math.min(fromBlock + CHUNK_SIZE, currentBlock);
    } catch (error) {
      console.error(`❌ Error querying blocks ${fromBlock}-${toBlock}:`, error.message);
      // Try smaller chunk if error
      if (CHUNK_SIZE > 1000) {
        toBlock = Math.min(fromBlock + 1000, currentBlock);
        continue;
      }
      throw error;
    }
  }

  console.log(`📦 Found ${events.length} total purchases`);

  const players = new Set();

  for (const e of events) {
    players.add(e.args.player);
  }

  console.log(`👥 Unique players: ${players.size}`);

  const results = [];

  for (const player of players) {
    const balance = await contract.credits(player);

    if (balance > 0n) {
      results.push({
        player,
        balance: BigInt(balance.toString())
      });
    }
  }

  // 1. Ordenar por saldo (maior primeiro)
  results.sort((a, b) => {
    if (b.balance > a.balance) return 1;
    if (b.balance < a.balance) return -1;
    return 0;
  });

  // 2. Calcular total geral
  const totalCredits = results.reduce((sum, item) => sum + item.balance, 0n);

  // 3. Contar jogadores que serão migrados
  const playersToMigrate = results.length;

  console.log("\n" + "=".repeat(80));
  console.log("📊 RESUMO");
  console.log("=".repeat(80));
  console.log(`💰 Total de créditos: ${totalCredits.toString()}`);
  console.log(`👥 Jogadores a migrar: ${playersToMigrate}`);
  console.log("=".repeat(80));

  console.log("\n💾 Saldos ordenados (maior para menor):");
  console.log("-".repeat(80));
  console.log("Rank | Endereço                                    | Créditos");
  console.log("-".repeat(80));
  
  results.forEach((item, index) => {
    const rank = (index + 1).toString().padStart(4);
    const address = item.player.padEnd(42);
    const balance = item.balance.toString().padStart(12);
    console.log(`${rank} | ${address} | ${balance}`);
  });

  console.log("-".repeat(80));
  console.log(`\n✅ Total: ${totalCredits.toString()} créditos em ${playersToMigrate} jogadores`);
}

main().catch(console.error);

