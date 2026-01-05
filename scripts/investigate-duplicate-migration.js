import { ethers } from "ethers";

const RPC_URL = "https://rpc.testnet.arc.network";
const OLD_CONTRACT = "0xB6EF59882778d0A245202F1482f20f02ad82bd87";
const NEW_CONTRACT = "0x41Afb27763416f555207c9B0bB04F08E665b4AFd";
const PLAYER = "0xB51158878a08a860443B10b2F24617bab5F1F3eA";

const OLD_ABI = [
  "function credits(address) view returns (uint256)",
];

const NEW_ABI = [
  "function credits(address) view returns (uint256)",
  "event CreditsMigrated(address indexed player, uint256 amount)",
];

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);

  console.log("=".repeat(80));
  console.log("🔍 INVESTIGANDO MIGRAÇÃO DUPLICADA");
  console.log("=".repeat(80));
  console.log("Jogador:", PLAYER);
  console.log("Contrato Antigo:", OLD_CONTRACT);
  console.log("Contrato Novo:", NEW_CONTRACT);
  console.log("=".repeat(80));

  const oldContract = new ethers.Contract(OLD_CONTRACT, OLD_ABI, provider);
  const newContract = new ethers.Contract(NEW_CONTRACT, NEW_ABI, provider);

  // 1. Verificar saldo no contrato antigo
  console.log("\n📦 Verificando saldo no contrato ANTIGO...");
  const oldBalance = await oldContract.credits(PLAYER);
  console.log(`   Saldo: ${oldBalance.toString()} créditos`);

  // 2. Verificar saldo no contrato novo
  console.log("\n✨ Verificando saldo no contrato NOVO...");
  const newBalance = await newContract.credits(PLAYER);
  console.log(`   Saldo: ${newBalance.toString()} créditos`);

  // 3. Buscar todos os eventos de migração para este jogador
  console.log("\n📋 Buscando eventos de migração...");
  const filter = newContract.filters.CreditsMigrated(PLAYER);
  
  // Buscar desde o deploy do contrato
  const currentBlock = await provider.getBlockNumber();
  const deployBlock = 19926612; // Aproximadamente quando o contrato foi deployado
  
  console.log(`   Buscando eventos do bloco ${deployBlock} até ${currentBlock}...`);
  
  // Buscar em chunks de 5000 blocos para evitar limite do RPC
  const CHUNK_SIZE = 5000;
  const events = [];
  let fromBlock = deployBlock;
  let toBlock = Math.min(fromBlock + CHUNK_SIZE, currentBlock);
  
  while (fromBlock <= currentBlock) {
    try {
      const chunkEvents = await newContract.queryFilter(filter, fromBlock, toBlock);
      events.push(...chunkEvents);
      fromBlock = toBlock + 1;
      toBlock = Math.min(fromBlock + CHUNK_SIZE, currentBlock);
    } catch (error) {
      console.error(`   Erro ao buscar blocos ${fromBlock}-${toBlock}:`, error.message);
      // Tentar chunk menor
      if (CHUNK_SIZE > 1000) {
        toBlock = Math.min(fromBlock + 1000, currentBlock);
        continue;
      }
      throw error;
    }
  }
  
  console.log(`\n📊 Total de eventos de migração encontrados: ${events.length}`);
  
  if (events.length > 0) {
    console.log("\n📝 Detalhes das migrações:");
    let totalMigrated = 0n;
    
    events.forEach((event, index) => {
      const amount = event.args.amount;
      const blockNumber = event.blockNumber;
      const txHash = event.transactionHash;
      totalMigrated += amount;
      
      console.log(`\n   Migração #${index + 1}:`);
      console.log(`   - Quantidade: ${amount.toString()} créditos`);
      console.log(`   - Bloco: ${blockNumber}`);
      console.log(`   - Transação: ${txHash}`);
      console.log(`   - Explorer: https://testnet.arcscan.app/tx/${txHash}`);
    });
    
    console.log(`\n💰 Total migrado (soma dos eventos): ${totalMigrated.toString()} créditos`);
    console.log(`💰 Saldo atual no novo contrato: ${newBalance.toString()} créditos`);
    
    if (totalMigrated === newBalance) {
      console.log("\n✅ A soma dos eventos corresponde ao saldo atual!");
    } else {
      console.log("\n⚠️  DISCREPÂNCIA: A soma dos eventos NÃO corresponde ao saldo atual!");
      console.log(`   Diferença: ${newBalance - totalMigrated} créditos`);
    }
    
    if (events.length > 1) {
      console.log("\n⚠️  ATENÇÃO: Foram encontradas MÚLTIPLAS migrações para este jogador!");
      console.log("   Isso confirma que houve migração duplicada.");
    }
  } else {
    console.log("\n❌ Nenhum evento de migração encontrado para este jogador.");
    console.log("   Isso é estranho, pois o jogador tem saldo no novo contrato.");
  }

  // 4. Comparar com o saldo original
  console.log("\n" + "=".repeat(80));
  console.log("📊 RESUMO");
  console.log("=".repeat(80));
  console.log(`Saldo no contrato antigo: ${oldBalance.toString()} créditos`);
  console.log(`Saldo no contrato novo: ${newBalance.toString()} créditos`);
  console.log(`Diferença: ${newBalance - oldBalance} créditos`);
  
  if (newBalance > oldBalance) {
    const excess = newBalance - oldBalance;
    console.log(`\n⚠️  O jogador tem ${excess.toString()} créditos A MAIS no novo contrato!`);
    console.log("   Isso indica migração duplicada ou créditos de outra fonte.");
  } else if (newBalance === oldBalance) {
    console.log("\n✅ Os saldos correspondem perfeitamente.");
  } else {
    console.log(`\n⚠️  O jogador tem ${(oldBalance - newBalance).toString()} créditos A MENOS no novo contrato.`);
  }
  
  console.log("=".repeat(80));
}

main().catch((error) => {
  console.error("❌ Erro:", error);
  process.exit(1);
});

