import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

const RPC_URL = process.env.ARC_RPC_URL || "https://rpc.testnet.arc.network";
const GAME_CREDITS_ADDRESS = "0xB6EF59882778d0A245202F1482f20f02ad82bd87";

// ABI para verificar eventos de consumo de créditos
const GAME_CREDITS_ABI = [
  "event CreditsConsumed(address indexed player, uint256 clickCount, uint256 creditsUsed, uint256 remainingCredits)",
  "function credits(address) external view returns (uint256)",
];

async function checkAllClickTransactions(playerAddress: string) {
  console.log("=".repeat(70));
  console.log("🔍 VERIFICANDO TODAS AS TRANSAÇÕES DE CLIQUE");
  console.log("=".repeat(70));
  console.log("");

  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(GAME_CREDITS_ADDRESS, GAME_CREDITS_ABI, provider);

    console.log(`👤 Endereço do jogador: ${playerAddress}`);
    console.log("");

    // Obter o bloco de deploy do contrato (aproximado)
    // Vamos verificar desde um bloco mais antigo
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 5000); // Últimos ~5000 blocos

    console.log(`📊 Verificando desde o bloco ${fromBlock} até ${currentBlock}`);
    console.log("");

    // Filtrar eventos CreditsConsumed para este jogador
    const filter = contract.filters.CreditsConsumed(playerAddress);
    const events = await contract.queryFilter(filter, fromBlock, "latest");

    console.log(`📋 Total de eventos encontrados: ${events.length}`);
    console.log("");

    if (events.length === 0) {
      console.log("⚠️  Nenhuma transação de clique encontrada");
      console.log("");
      console.log("💡 Isso significa que:");
      console.log("   1. Nenhum clique foi processado on-chain para este endereço");
      console.log("   2. Os cliques podem estar sendo processados localmente (sem blockchain)");
      console.log("   3. O relayer pode não estar configurado ou autorizado");
      console.log("");
      console.log("🔍 Verificando configuração do relayer...");
      const relayerKey = process.env.RELAYER_PRIVATE_KEY;
      if (!relayerKey || relayerKey === "") {
        console.log("   ❌ RELAYER_PRIVATE_KEY não está configurado no .env.local");
        console.log("   💡 Configure RELAYER_PRIVATE_KEY para processar cliques on-chain");
      } else {
        console.log("   ✅ RELAYER_PRIVATE_KEY está configurado");
        console.log("   💡 Verifique se o relayer está autorizado no contrato GameCredits");
      }
      console.log("");
      return;
    }

    console.log(`✅ Encontradas ${events.length} transações`);
    console.log("");

    // Mostrar as últimas 20 transações
    const recentEvents = events.slice(-20).reverse();

    for (let i = 0; i < recentEvents.length; i++) {
      const event = recentEvents[i];
      try {
        const block = await event.getBlock();
        const tx = await event.getTransaction();
        
        console.log(`📦 Transação ${i + 1}:`);
        console.log(`   Hash: ${tx.hash}`);
        console.log(`   Block: ${block.number}`);
        console.log(`   Timestamp: ${new Date(block.timestamp * 1000).toLocaleString()}`);
        console.log(`   Player: ${event.args.player}`);
        console.log(`   Clicks: ${event.args.clickCount.toString()}`);
        console.log(`   Créditos usados: ${event.args.creditsUsed.toString()}`);
        console.log(`   Créditos restantes: ${event.args.remainingCredits.toString()}`);
        console.log(`   Gas usado: ${tx.gasLimit?.toString() || "N/A"}`);
        console.log(`   🔗 Explorer: https://testnet.arcscan.app/tx/${tx.hash}`);
        console.log("");
      } catch (error: any) {
        console.log(`   ⚠️  Erro ao processar evento: ${error.message}`);
        console.log("");
      }
    }

    // Verificar saldo atual
    const currentBalance = await contract.credits(playerAddress);
    console.log(`💰 Saldo atual de créditos: ${currentBalance.toString()}`);
    console.log("");

    console.log("=".repeat(70));
    console.log("✅ VERIFICAÇÃO CONCLUÍDA");
    console.log("=".repeat(70));

  } catch (error: any) {
    console.error("❌ ERRO:", error.message);
    console.error("   Stack:", error.stack);
  }
}

// Obter endereço do jogador como argumento
const playerAddress = process.argv[2];

if (!playerAddress) {
  console.error("❌ Uso: npx tsx scripts/check-all-click-transactions.ts <endereço_do_jogador>");
  console.error("   Exemplo: npx tsx scripts/check-all-click-transactions.ts 0xB51158878a08a860443B10b2F24617bab5F1F3eA");
  process.exit(1);
}

checkAllClickTransactions(playerAddress).catch(console.error);




