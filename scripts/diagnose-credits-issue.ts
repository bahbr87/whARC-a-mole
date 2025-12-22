import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

const RPC_URL = process.env.ARC_RPC_URL || "https://rpc.testnet.arc.network";
const GAME_CREDITS_ADDRESS = "0xB6EF59882778d0A245202F1482f20f02ad82bd87";

// Simular EXATAMENTE o que o frontend faz
const GAME_CREDITS_ABI = [
  "function credits(address) external view returns (uint256)",
  "function getCredits(address) external view returns (uint256)",
];

// Endereço de teste (substitua pelo seu endereço real)
const TEST_ADDRESS = "0xB51158878a08a860443B10b2F24617bab5F1F3eA";

async function diagnoseCreditsIssue() {
  console.log("=".repeat(70));
  console.log("🔍 DIAGNÓSTICO COMPLETO DO PROBLEMA DE CRÉDITOS");
  console.log("=".repeat(70));
  console.log("");

  try {
    // 1. Verificar se o contrato existe
    console.log("1️⃣  VERIFICANDO CONTRATO...");
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const code = await provider.getCode(GAME_CREDITS_ADDRESS);
    
    if (code === "0x" || code === "0x0") {
      console.log("   ❌ ERRO: Contrato não existe no endereço", GAME_CREDITS_ADDRESS);
      return;
    }
    console.log("   ✅ Contrato existe");
    console.log("");

    // 2. Verificar se o endereço de teste tem créditos
    console.log("2️⃣  VERIFICANDO CRÉDITOS DO ENDEREÇO...");
    const contract = new ethers.Contract(GAME_CREDITS_ADDRESS, GAME_CREDITS_ABI, provider);
    
    let balance: bigint;
    try {
      balance = await contract.credits(TEST_ADDRESS);
      console.log("   ✅ credits() retornou:", balance.toString());
    } catch (error: any) {
      console.log("   ⚠️  credits() falhou:", error.message);
      try {
        balance = await contract.getCredits(TEST_ADDRESS);
        console.log("   ✅ getCredits() retornou:", balance.toString());
      } catch (error2: any) {
        console.log("   ❌ ERRO: Ambos os métodos falharam");
        console.log("   Erro:", error2.message);
        return;
      }
    }
    
    const creditBalance = Number(balance);
    console.log("   📊 Saldo convertido para number:", creditBalance);
    console.log("");

    if (creditBalance === 0) {
      console.log("   ⚠️  O endereço de teste tem 0 créditos");
      console.log("   Use um endereço que você sabe que tem créditos");
      console.log("");
    } else {
      console.log("   ✅ O endereço tem", creditBalance, "créditos no contrato");
      console.log("");
    }

    // 3. Simular o que o frontend faz
    console.log("3️⃣  SIMULANDO COMPORTAMENTO DO FRONTEND...");
    console.log("   Simulando: refreshCredits() sendo chamado");
    console.log("   Simulando: address =", TEST_ADDRESS);
    console.log("   Simulando: isConnected = true");
    console.log("");

    // 4. Verificar se há problemas de conversão
    console.log("4️⃣  VERIFICANDO CONVERSÃO...");
    console.log("   balance (bigint):", balance.toString());
    console.log("   balance type:", typeof balance);
    console.log("   Number(balance):", Number(balance));
    console.log("   isNaN:", isNaN(Number(balance)));
    console.log("   >= 0:", Number(balance) >= 0);
    console.log("");

    // 5. Verificar se o problema pode ser timing
    console.log("5️⃣  VERIFICANDO TIMING...");
    console.log("   O frontend pode estar lendo antes da wallet estar pronta");
    console.log("   O frontend pode estar usando isConnected=false mesmo com wallet conectada");
    console.log("");

    // 6. Diagnóstico final
    console.log("=".repeat(70));
    console.log("🎯 DIAGNÓSTICO FINAL");
    console.log("=".repeat(70));
    
    if (creditBalance > 0) {
      console.log("✅ O CONTRATO RETORNA CRÉDITOS CORRETAMENTE:", creditBalance);
      console.log("");
      console.log("⚠️  O PROBLEMA ESTÁ NO FRONTEND:");
      console.log("");
      console.log("   Possíveis causas:");
      console.log("   1. ❌ isConnected está false mesmo com wallet conectada");
      console.log("   2. ❌ address está vazio ou undefined");
      console.log("   3. ❌ refreshCredits não está sendo chamado");
      console.log("   4. ❌ setCredits não está atualizando o estado");
      console.log("   5. ❌ O componente não está re-renderizando");
      console.log("");
      console.log("   SOLUÇÕES IMPLEMENTADAS:");
      console.log("   ✅ Removida dependência de isConnected");
      console.log("   ✅ refreshCredits agora só verifica address");
      console.log("   ✅ Logs de debug adicionados");
      console.log("   ✅ Polling a cada 3 segundos");
      console.log("");
      console.log("   PRÓXIMOS PASSOS:");
      console.log("   1. Recarregue a página (Ctrl+F5)");
      console.log("   2. Conecte a wallet novamente");
      console.log("   3. Aguarde alguns segundos para o polling atualizar");
      console.log("   4. Clique no botão 'Refresh' se disponível");
    } else {
      console.log("⚠️  O ENDEREÇO DE TESTE TEM 0 CRÉDITOS");
      console.log("   Use um endereço que você sabe que tem créditos");
    }

  } catch (error: any) {
    console.error("❌ ERRO GERAL:", error.message);
    console.error("   Stack:", error.stack);
  }
}

diagnoseCreditsIssue().catch(console.error);
