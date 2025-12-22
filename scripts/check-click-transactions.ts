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

async function checkClickTransactions(playerAddress: string, minutes: number = 10) {
  console.log("=".repeat(70));
  console.log("🔍 VERIFICANDO TRANSAÇÕES DE CLIQUE");
  console.log("=".repeat(70));
  console.log("");

  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(GAME_CREDITS_ADDRESS, GAME_CREDITS_ABI, provider);

    // Calcular o timestamp de início (últimos N minutos)
    const now = Math.floor(Date.now() / 1000);
    const startTime = now - (minutes * 60);
    const fromBlock = await provider.getBlockNumber() - 1000; // Últimos ~1000 blocos

    console.log(`📊 Verificando transações dos últimos ${minutes} minutos`);
    console.log(`👤 Endereço do jogador: ${playerAddress}`);
    console.log(`📅 De: ${new Date(startTime * 1000).toLocaleString()}`);
    console.log(`📅 Até: ${new Date(now * 1000).toLocaleString()}`);
    console.log(`🔢 Bloco inicial: ${fromBlock}`);
    console.log("");

    // Filtrar eventos CreditsConsumed para este jogador
    const filter = contract.filters.CreditsConsumed(playerAddress);
    const events = await contract.queryFilter(filter, fromBlock, "latest");

    console.log(`📋 Total de eventos encontrados: ${events.length}`);
    console.log("");

    if (events.length === 0) {
      console.log("⚠️  Nenhuma transação de clique encontrada nos últimos blocos");
      console.log("");
      console.log("💡 Possíveis causas:");
      console.log("   1. Nenhum clique foi feito recentemente");
      console.log("   2. Os cliques não estão sendo processados on-chain");
      console.log("   3. O relayer não está configurado corretamente");
      console.log("");
      return;
    }

    // Filtrar eventos por timestamp (se disponível)
    const recentEvents = events.filter(async (event) => {
      try {
        const block = await event.getBlock();
        return block.timestamp >= startTime;
      } catch {
        return true; // Incluir se não conseguir verificar
      }
    });

    console.log(`✅ Eventos recentes encontrados: ${recentEvents.length}`);
    console.log("");

    // Verificar cada evento
    for (let i = 0; i < Math.min(recentEvents.length, 20); i++) {
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
const minutes = parseInt(process.argv[3] || "10");

if (!playerAddress) {
  console.error("❌ Uso: npx tsx scripts/check-click-transactions.ts <endereço_do_jogador> [minutos]");
  console.error("   Exemplo: npx tsx scripts/check-click-transactions.ts 0xB51158878a08a860443B10b2F24617bab5F1F3eA 10");
  process.exit(1);
}

checkClickTransactions(playerAddress, minutes).catch(console.error);




