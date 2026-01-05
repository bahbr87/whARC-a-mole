import { ethers } from "ethers";
import dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const RPC_URL = "https://rpc.testnet.arc.network";
const CHAIN_ID = 5042002;
const NEW_CONTRACT = "0x41Afb27763416f555207c9B0bB04F08E665b4AFd";

const ABI = [
  "function credits(address) view returns (uint256)",
  "function adjustCredits(address player, int256 adjustment) external",
];

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL, CHAIN_ID);
  const contract = new ethers.Contract(NEW_CONTRACT, ABI, provider);

  console.log("Verificando se a função adjustCredits existe no contrato...");
  console.log("Contrato:", NEW_CONTRACT);
  console.log("");

  try {
    // Tentar ler o código do contrato para verificar se a função existe
    const code = await provider.getCode(NEW_CONTRACT);
    if (code === "0x") {
      console.log("❌ Contrato não encontrado!");
      return;
    }

    // Tentar fazer uma chamada estática (estimateGas) para verificar se a função existe
    // Usar um endereço de teste e valor 0
    const testAddress = "0x0000000000000000000000000000000000000001";
    const testWallet = new ethers.Wallet("0x" + "1".repeat(64), provider);
    const contractWithSigner = new ethers.Contract(NEW_CONTRACT, ABI, testWallet);

    try {
      // Tentar estimar gas para a função (isso falhará se a função não existir)
      await contractWithSigner.adjustCredits.estimateGas(testAddress, 0);
      console.log("✅ A função adjustCredits EXISTE no contrato!");
    } catch (error) {
      if (error.message.includes("missing revert data") || error.message.includes("CALL_EXCEPTION")) {
        console.log("❌ A função adjustCredits NÃO EXISTE no contrato deployado!");
        console.log("   É necessário fazer o redeploy do contrato com a função adjustCredits.");
      } else {
        console.log("⚠️  Erro ao verificar:", error.message);
      }
    }
  } catch (error) {
    console.error("❌ Erro:", error.message);
  }
}

main().catch(console.error);

