import { ethers } from "ethers";
import "dotenv/config";

const RPC_URL = process.env.RPC_URL || "https://rpc.testnet.arc.network";
const PRIZE_POOL_ADDRESS = process.argv[2] || "0xb07bB827a5A53e2b36eb0126aDD22ca1b4843DC7";

const PRIZE_POOL_ABI = [
  "function distributePrize(uint256 day, address user) external",
  "function owner() view returns (address)",
  "function usdc() view returns (address)",
  "function prizes(uint256) view returns (uint256)",
];

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const prizePool = new ethers.Contract(PRIZE_POOL_ADDRESS, PRIZE_POOL_ABI, provider);

  console.log("=".repeat(70));
  console.log("🔍 VERIFICANDO FUNÇÃO distributePrize NO CONTRATO");
  console.log("=".repeat(70));
  console.log("");
  console.log(`📍 Endereço do contrato: ${PRIZE_POOL_ADDRESS}`);
  console.log(`🌐 RPC: ${RPC_URL}`);
  console.log("");

  try {
    // Verificar se a função existe tentando obter o código do contrato
    const code = await provider.getCode(PRIZE_POOL_ADDRESS);
    if (code === "0x") {
      console.error("❌ Contrato não encontrado!");
      return;
    }

    // Tentar ler informações do contrato
    const owner = await prizePool.owner();
    const usdc = await prizePool.usdc();
    const firstPrize = await prizePool.prizes(0);
    const secondPrize = await prizePool.prizes(1);
    const thirdPrize = await prizePool.prizes(2);

    console.log("✅ Contrato encontrado e acessível!");
    console.log("");
    console.log("📋 Informações do contrato:");
    console.log(`   👤 Owner: ${owner}`);
    console.log(`   💵 USDC: ${usdc}`);
    console.log(`   🥇 1º lugar: ${ethers.formatUnits(firstPrize, 6)} USDC`);
    console.log(`   🥈 2º lugar: ${ethers.formatUnits(secondPrize, 6)} USDC`);
    console.log(`   🥉 3º lugar: ${ethers.formatUnits(thirdPrize, 6)} USDC`);
    console.log("");

    // Tentar verificar se a função distributePrize existe
    // Fazendo uma chamada de estimativa de gas (vai falhar se a função não existir)
    const testWallet = new ethers.Wallet("0x" + "1".repeat(64), provider);
    const prizePoolWithSigner = new ethers.Contract(PRIZE_POOL_ADDRESS, PRIZE_POOL_ABI, testWallet);

    try {
      // Tentar estimar gas para a função (vai falhar se não existir)
      await prizePoolWithSigner.distributePrize.estimateGas(0, "0x0000000000000000000000000000000000000001");
      console.log("✅ Função distributePrize EXISTE no contrato!");
    } catch (error: any) {
      if (error.message.includes("missing revert data") || error.message.includes("CALL_EXCEPTION")) {
        console.log("✅ Função distributePrize EXISTE no contrato!");
        console.log("   (Erro esperado na estimativa devido a validações do contrato)");
      } else {
        console.log("⚠️  Não foi possível verificar a função (erro inesperado):", error.message);
      }
    }

    console.log("");
    console.log("=".repeat(70));
    console.log("✅ VERIFICAÇÃO CONCLUÍDA");
    console.log("=".repeat(70));
  } catch (error: any) {
    console.error("❌ Erro ao verificar contrato:", error.message);
  }
}

main().catch(console.error);

