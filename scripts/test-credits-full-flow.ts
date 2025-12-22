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

// Endereço de teste (substitua pelo seu endereço real se necessário)
const TEST_ADDRESS = "0xB51158878a08a860443B10b2F24617bab5F1F3eA";

async function simulateFullFrontendFlow() {
  console.log("=".repeat(60));
  console.log("🔍 SIMULAÇÃO COMPLETA DO COMPORTAMENTO DO FRONTEND");
  console.log("=".repeat(60));
  console.log("");

  // Simular: useEffect no useGameCredits quando address muda
  console.log("1️⃣  SIMULANDO: useEffect no useGameCredits");
  console.log("   Address:", TEST_ADDRESS);
  console.log("   isConnected: true");
  console.log("");

  // Simular: refreshCredits sendo chamado
  console.log("2️⃣  SIMULANDO: refreshCredits() sendo chamado");
  console.log("   GAME_CREDITS_ADDRESS:", GAME_CREDITS_ADDRESS);
  console.log("");

  try {
    // Simular: Criar provider (BrowserProvider do frontend)
    console.log("3️⃣  SIMULANDO: Criando BrowserProvider...");
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    console.log("   ✅ Provider criado");
    console.log("");

    // Simular: Criar contrato
    console.log("4️⃣  SIMULANDO: Criando Contract...");
    const contract = new ethers.Contract(GAME_CREDITS_ADDRESS, GAME_CREDITS_ABI, provider);
    console.log("   ✅ Contrato criado");
    console.log("");

    // Simular: Validar endereço
    console.log("5️⃣  SIMULANDO: Validando endereço...");
    if (!TEST_ADDRESS || TEST_ADDRESS === "0x0000000000000000000000000000000000000000") {
      console.log("   ❌ Endereço inválido!");
      return;
    }
    console.log("   ✅ Endereço válido:", TEST_ADDRESS);
    console.log("   Address type:", typeof TEST_ADDRESS, "length:", TEST_ADDRESS.length);
    console.log("");

    // Simular: Chamar contract.credits(address)
    console.log("6️⃣  SIMULANDO: Chamando contract.credits(", TEST_ADDRESS, ")...");
    
    let balance: bigint;
    try {
      balance = await contract.credits(TEST_ADDRESS);
      console.log("   ✅ Got balance from credits():", balance.toString());
      console.log("   Type:", typeof balance);
      console.log("   Number:", Number(balance));
    } catch (error: any) {
      console.log("   ⚠️  credits() failed, trying getCredits():", error.message);
      try {
        balance = await contract.getCredits(TEST_ADDRESS);
        console.log("   ✅ Got balance from getCredits():", balance.toString());
        console.log("   Type:", typeof balance);
        console.log("   Number:", Number(balance));
      } catch (error2: any) {
        console.log("   ❌ Both methods failed:", error2.message);
        return;
      }
    }
    console.log("");

    // Simular: Converter bigint para number
    console.log("7️⃣  SIMULANDO: Convertendo bigint para number...");
    const creditBalance = Number(balance);
    console.log("   creditBalance:", creditBalance);
    console.log("   isNaN:", isNaN(creditBalance));
    console.log("   >= 0:", creditBalance >= 0);
    console.log("");

    // Simular: Validar resultado
    console.log("8️⃣  SIMULANDO: Validando resultado...");
    if (isNaN(creditBalance) || creditBalance < 0) {
      console.log("   ❌ Valor inválido!");
      return;
    }
    console.log("   ✅ Valor válido");
    console.log("");

    // Simular: Atualizar estado React
    console.log("9️⃣  SIMULANDO: Atualizando estado React...");
    console.log("   ✅ Setting credits to:", creditBalance, "from balance:", balance.toString());
    console.log("   🔄 About to call setCredits with:", creditBalance);
    console.log("   ✅ setCredits called with:", creditBalance);
    console.log("");

    // Simular: Verificar estado após 100ms
    console.log("🔟 SIMULANDO: Verificando estado após 100ms...");
    await new Promise(resolve => setTimeout(resolve, 100));
    console.log("   🔍 State verification after 100ms - credits should be:", creditBalance);
    console.log("");

    // Resultado final
    console.log("=".repeat(60));
    console.log("✅ RESULTADO FINAL");
    console.log("=".repeat(60));
    console.log("   Créditos obtidos do contrato:", creditBalance);
    console.log("   Este valor DEVERIA aparecer no frontend");
    console.log("");

    if (creditBalance > 0) {
      console.log("🎯 DIAGNÓSTICO:");
      console.log("   ✅ O contrato retorna:", creditBalance, "créditos");
      console.log("   ✅ A conversão bigint -> number funciona");
      console.log("   ✅ O valor é válido");
      console.log("");
      console.log("⚠️  Se o frontend mostra 0, verifique:");
      console.log("   1. O endereço da wallet no frontend é:", TEST_ADDRESS);
      console.log("   2. O useEffect está sendo executado (verifique logs no navegador)");
      console.log("   3. O refreshCredits está sendo chamado");
      console.log("   4. O setCredits está sendo chamado com o valor correto");
      console.log("   5. O componente está re-renderizando após setCredits");
    } else {
      console.log("⚠️  O endereço de teste tem 0 créditos");
      console.log("   Use um endereço que você sabe que tem créditos");
    }

  } catch (error: any) {
    console.error("❌ Erro geral:", error.message);
    console.error("   Stack:", error.stack);
  }
}

// Executar simulação
simulateFullFrontendFlow().catch(console.error);




