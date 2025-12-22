import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

const RPC_URL = process.env.ARC_RPC_URL || "https://rpc.testnet.arc.network";
const GAME_CREDITS_ADDRESS = "0xB6EF59882778d0A245202F1482f20f02ad82bd87";

// Simular o que o frontend faz
const GAME_CREDITS_ABI = [
  "function credits(address) external view returns (uint256)",
  "function getCredits(address) external view returns (uint256)",
];

// Endereço de teste (substitua pelo seu endereço real)
const TEST_ADDRESS = "0xB51158878a08a860443B10b2F24617bab5F1F3eA";

async function simulateFrontendBehavior() {
  console.log("🔍 Simulando comportamento do frontend...");
  console.log("RPC URL:", RPC_URL);
  console.log("GameCredits Address:", GAME_CREDITS_ADDRESS);
  console.log("Test Address:", TEST_ADDRESS);
  console.log("");

  try {
    // 1. Criar provider (simula BrowserProvider do frontend)
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    console.log("✅ Provider criado");

    // 2. Criar contrato (simula Contract do frontend)
    const contract = new ethers.Contract(GAME_CREDITS_ADDRESS, GAME_CREDITS_ABI, provider);
    console.log("✅ Contrato criado");

    // 3. Tentar chamar credits(address) - mesma lógica do frontend
    console.log("");
    console.log("📞 Chamando contract.credits(", TEST_ADDRESS, ")...");
    
    let balance: bigint;
    try {
      balance = await contract.credits(TEST_ADDRESS);
      console.log("✅ Got balance from credits():", balance.toString());
      console.log("   Type:", typeof balance);
      console.log("   Number:", Number(balance));
    } catch (error: any) {
      console.log("❌ credits() failed:", error.message);
      console.log("   Tentando getCredits()...");
      
      try {
        balance = await contract.getCredits(TEST_ADDRESS);
        console.log("✅ Got balance from getCredits():", balance.toString());
        console.log("   Type:", typeof balance);
        console.log("   Number:", Number(balance));
      } catch (error2: any) {
        console.log("❌ getCredits() também falhou:", error2.message);
        return;
      }
    }

    // 4. Converter para number (mesma lógica do frontend)
    console.log("");
    console.log("🔄 Convertendo bigint para number...");
    const creditBalance = Number(balance);
    console.log("   creditBalance:", creditBalance);
    console.log("   isNaN:", isNaN(creditBalance));
    console.log("   >= 0:", creditBalance >= 0);

    // 5. Validar resultado
    if (isNaN(creditBalance) || creditBalance < 0) {
      console.log("❌ Valor inválido!");
      return;
    }

    console.log("");
    console.log("✅ SUCESSO! Créditos:", creditBalance);
    console.log("   Este valor deveria aparecer no frontend");

    // 6. Verificar se o valor é o esperado
    if (creditBalance > 0) {
      console.log("");
      console.log("🎯 DIAGNÓSTICO:");
      console.log("   - O contrato retorna:", creditBalance, "créditos");
      console.log("   - A conversão bigint -> number funciona");
      console.log("   - O valor é válido");
      console.log("");
      console.log("⚠️  Se o frontend mostra 0, o problema pode ser:");
      console.log("   1. O endereço da wallet no frontend é diferente");
      console.log("   2. O estado React não está sendo atualizado");
      console.log("   3. O useEffect não está sendo executado");
      console.log("   4. Há um problema de timing (estado atualizado antes do resultado)");
    } else {
      console.log("");
      console.log("⚠️  O endereço de teste tem 0 créditos");
      console.log("   Use um endereço que você sabe que tem créditos");
    }

  } catch (error: any) {
    console.error("❌ Erro geral:", error.message);
    console.error("   Stack:", error.stack);
  }
}

// Executar diagnóstico
simulateFrontendBehavior().catch(console.error);




