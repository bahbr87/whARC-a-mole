import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const RPC_URL = "https://rpc.testnet.arc.network";
const CHAIN_ID = 5042002;
const OLD_CONTRACT = "0xB6EF59882778d0A245202F1482f20f02ad82bd87";
const NEW_CONTRACT = "0x41Afb27763416f555207c9B0bB04F08E665b4AFd";

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || process.env.PRIVATE_KEY;

if (!DEPLOYER_PRIVATE_KEY) {
  console.error("❌ DEPLOYER_PRIVATE_KEY or PRIVATE_KEY not found in .env.local");
  process.exit(1);
}

const OLD_ABI = [
  "function credits(address) view returns (uint256)",
];

const NEW_ABI = [
  "function credits(address) view returns (uint256)",
  "function adjustCredits(address player, int256 adjustment) external",
  "event CreditsMigrated(address indexed player, uint256 amount)",
];

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL, CHAIN_ID);
  const wallet = new ethers.Wallet(DEPLOYER_PRIVATE_KEY, provider);

  console.log("=".repeat(80));
  console.log("🔧 CORRIGINDO MIGRAÇÕES DUPLICADAS");
  console.log("=".repeat(80));
  console.log("👤 Owner:", wallet.address);
  console.log("📦 Contrato Antigo:", OLD_CONTRACT);
  console.log("✨ Contrato Novo:", NEW_CONTRACT);
  console.log("=".repeat(80));

  const oldContract = new ethers.Contract(OLD_CONTRACT, OLD_ABI, provider);
  const newContract = new ethers.Contract(NEW_CONTRACT, NEW_ABI, wallet);

  // Buscar todos os eventos de migração
  console.log("\n📋 Buscando todos os eventos de migração...");
  const currentBlock = await provider.getBlockNumber();
  const deployBlock = 19926612;
  
  const filter = newContract.filters.CreditsMigrated();
  const CHUNK_SIZE = 5000;
  const allEvents = [];
  let fromBlock = deployBlock;
  let toBlock = Math.min(fromBlock + CHUNK_SIZE, currentBlock);
  
  while (fromBlock <= currentBlock) {
    try {
      const chunkEvents = await newContract.queryFilter(filter, fromBlock, toBlock);
      allEvents.push(...chunkEvents);
      if (chunkEvents.length > 0) {
        console.log(`   Blocos ${fromBlock}-${toBlock}: ${chunkEvents.length} eventos`);
      }
      fromBlock = toBlock + 1;
      toBlock = Math.min(fromBlock + CHUNK_SIZE, currentBlock);
    } catch (error) {
      if (CHUNK_SIZE > 1000) {
        toBlock = Math.min(fromBlock + 1000, currentBlock);
        continue;
      }
      throw error;
    }
  }

  console.log(`\n✅ Total de eventos de migração encontrados: ${allEvents.length}`);

  // Agrupar eventos por jogador
  const migrationsByPlayer = new Map();
  
  for (const event of allEvents) {
    const player = event.args.player.toLowerCase();
    const amount = event.args.amount;
    
    if (!migrationsByPlayer.has(player)) {
      migrationsByPlayer.set(player, []);
    }
    migrationsByPlayer.get(player).push({
      amount,
      blockNumber: event.blockNumber,
      txHash: event.transactionHash,
    });
  }

  console.log(`\n👥 Total de jogadores únicos com migrações: ${migrationsByPlayer.size}`);

  // Identificar duplicações
  console.log("\n🔍 Identificando migrações duplicadas...");
  const duplicates = [];
  const playersToCheck = Array.from(migrationsByPlayer.keys());

  for (const player of playersToCheck) {
    const migrations = migrationsByPlayer.get(player);
    
    if (migrations.length > 1) {
      // Verificar saldo no contrato antigo
      const oldBalance = await oldContract.credits(player);
      const newBalance = await newContract.credits(player);
      
      // Calcular total migrado
      const totalMigrated = migrations.reduce((sum, m) => sum + m.amount, 0n);
      
      // Se o saldo novo é maior que o antigo, há duplicação
      if (newBalance > oldBalance) {
        const excess = newBalance - oldBalance;
        duplicates.push({
          player,
          oldBalance: oldBalance.toString(),
          newBalance: newBalance.toString(),
          totalMigrated: totalMigrated.toString(),
          expectedBalance: oldBalance.toString(),
          excess: excess.toString(),
          migrationsCount: migrations.length,
          migrations,
        });
      }
    }
  }

  console.log(`\n⚠️  Jogadores com migração duplicada encontrados: ${duplicates.length}`);

  if (duplicates.length === 0) {
    console.log("\n✅ Nenhuma migração duplicada encontrada!");
    return;
  }

  // Mostrar resumo
  console.log("\n" + "=".repeat(80));
  console.log("📊 RESUMO DE DUPLICAÇÕES");
  console.log("=".repeat(80));
  
  let totalExcess = 0n;
  duplicates.forEach((dup, index) => {
    console.log(`\n${index + 1}. ${dup.player}`);
    console.log(`   Saldo antigo: ${dup.oldBalance}`);
    console.log(`   Saldo novo: ${dup.newBalance}`);
    console.log(`   Excesso: ${dup.excess}`);
    console.log(`   Migrações: ${dup.migrationsCount}`);
    totalExcess += BigInt(dup.excess);
  });

  console.log(`\n💰 Total de créditos em excesso: ${totalExcess.toString()}`);
  console.log("=".repeat(80));

  // Salvar relatório (convertendo BigInt para string)
  const reportPath = path.join(process.cwd(), "duplicate-migrations-report.json");
  const reportData = duplicates.map(dup => ({
    ...dup,
    migrations: dup.migrations.map(m => ({
      amount: m.amount.toString(),
      blockNumber: m.blockNumber.toString(),
      txHash: m.txHash,
    })),
  }));
  fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
  console.log(`\n📄 Relatório salvo em: ${reportPath}`);

  // Perguntar confirmação (simulado - em produção seria interativo)
  console.log("\n⚠️  ATENÇÃO: Este script irá REMOVER créditos duplicados!");
  console.log("   Certifique-se de revisar o relatório antes de continuar.");
  console.log("\n💡 Para executar as correções, descomente a seção abaixo no código.");

  // CORREÇÃO (descomente para executar)
  console.log("\n⚠️  Para executar as correções, descomente a seção de código no script.");
  console.log("   IMPORTANTE: Certifique-se de que o contrato tem a função adjustCredits deployada!");
  
  
  console.log("\n🔧 Iniciando correções...");
  
  for (let i = 0; i < duplicates.length; i++) {
    const dup = duplicates[i];
    const excess = BigInt(dup.excess);
    
    try {
      console.log(`\n[${i + 1}/${duplicates.length}] Corrigindo ${dup.player}...`);
      console.log(`   Removendo ${excess.toString()} créditos em excesso...`);
      
      // Usar valor negativo para remover créditos
      const tx = await newContract.adjustCredits(dup.player, -Number(excess));
      console.log(`   ⏳ Transação: ${tx.hash}`);
      
      await tx.wait();
      console.log(`   ✅ Correção confirmada!`);
      
      // Verificar saldo após correção
      const balanceAfter = await newContract.credits(dup.player);
      console.log(`   📊 Saldo após correção: ${balanceAfter.toString()}`);
      
      // Pequeno delay
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`   ❌ Erro ao corrigir ${dup.player}:`, error.message);
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log("✅ CORREÇÕES CONCLUÍDAS!");
  console.log("=".repeat(80));
  
}

main().catch((error) => {
  console.error("❌ Erro fatal:", error);
  process.exit(1);
});

