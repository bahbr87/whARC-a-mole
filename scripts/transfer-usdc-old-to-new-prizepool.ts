import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const RPC_URL = process.env.ARC_RPC_URL || process.env.RPC_URL || "https://rpc.testnet.arc.network";
const PRIVATE_KEY = process.env.OWNER_PRIVATE_KEY!;
const OLD_PRIZE_POOL = "0xEc5Cb537fecA57E2f7678D29a7622a92ebf2A3A8";
const NEW_PRIZE_POOL = "0xeA0df70040E77a821b14770E53aa577A745930ae";
const USDC_ADDRESS = "0x3600000000000000000000000000000000000000";

if (!PRIVATE_KEY) {
  throw new Error("OWNER_PRIVATE_KEY não configurado no .env.local");
}

const USDC_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
];

// ABI do PrizePool antigo - verificar se tem função withdraw
const OLD_PRIZE_POOL_ABI = [
  "function withdraw(uint256 amount) external",
  "function owner() view returns (address)",
  "function balance() view returns (uint256)",
];

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  console.log("👛 Wallet:", wallet.address);
  console.log("🏦 PrizePool Antigo:", OLD_PRIZE_POOL);
  console.log("🏦 PrizePool Novo:", NEW_PRIZE_POOL);
  console.log("💵 USDC:", USDC_ADDRESS);

  const usdc = new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider);
  const decimals = await usdc.decimals();

  // Verificar saldo do PrizePool antigo
  const oldPoolBalance = await usdc.balanceOf(OLD_PRIZE_POOL);
  console.log("\n💰 Saldo do PrizePool Antigo:", ethers.formatUnits(oldPoolBalance, decimals), "USDC");

  if (oldPoolBalance === 0n) {
    console.log("ℹ️ PrizePool antigo não tem saldo. Nada a transferir.");
    return;
  }

  // Verificar saldo do PrizePool novo
  const newPoolBalance = await usdc.balanceOf(NEW_PRIZE_POOL);
  console.log("🏆 Saldo do PrizePool Novo:", ethers.formatUnits(newPoolBalance, decimals), "USDC");

  // Tentar usar função withdraw do contrato antigo
  try {
    const oldPrizePool = new ethers.Contract(OLD_PRIZE_POOL, OLD_PRIZE_POOL_ABI, wallet);
    
    // Verificar se wallet é owner
    const owner = await oldPrizePool.owner();
    console.log("\n👤 Owner do PrizePool Antigo:", owner);
    
    if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
      throw new Error(`Wallet ${wallet.address} não é o owner do PrizePool antigo. Owner: ${owner}`);
    }

    console.log("✅ Wallet confirmada como owner do PrizePool antigo");

    // Tentar fazer withdraw do contrato antigo
    console.log("\n📤 Fazendo withdraw do PrizePool antigo...");
    const withdrawTx = await oldPrizePool.withdraw(oldPoolBalance);
    console.log("⏳ Aguardando confirmação do withdraw...");
    console.log("   TX Hash:", withdrawTx.hash);
    
    await withdrawTx.wait();
    console.log("✅ Withdraw concluído!");

    // Verificar novo saldo da wallet
    const walletBalance = await usdc.balanceOf(wallet.address);
    console.log("💰 Novo saldo da wallet:", ethers.formatUnits(walletBalance, decimals), "USDC");

    // Transferir para o novo PrizePool
    console.log("\n📤 Transferindo USDC para o PrizePool novo...");
    const transferTx = await usdc.connect(wallet).transfer(NEW_PRIZE_POOL, oldPoolBalance);
    console.log("⏳ Aguardando confirmação da transferência...");
    console.log("   TX Hash:", transferTx.hash);
    
    await transferTx.wait();
    console.log("✅ Transferência concluída!");

    // Verificar novos saldos
    const finalOldBalance = await usdc.balanceOf(OLD_PRIZE_POOL);
    const finalNewBalance = await usdc.balanceOf(NEW_PRIZE_POOL);
    
    console.log("\n📊 Saldos finais:");
    console.log("   PrizePool Antigo:", ethers.formatUnits(finalOldBalance, decimals), "USDC");
    console.log("   PrizePool Novo:", ethers.formatUnits(finalNewBalance, decimals), "USDC");
    console.log("\n🔗 Explorer (Withdraw): https://testnet.arcscan.app/tx/" + withdrawTx.hash);
    console.log("🔗 Explorer (Transfer): https://testnet.arcscan.app/tx/" + transferTx.hash);

  } catch (error: any) {
    // Se não tiver função withdraw, tentar transferir diretamente do contrato
    if (error.message.includes("withdraw") || error.message.includes("function")) {
      console.log("\n⚠️ Contrato antigo não tem função withdraw. Tentando transferir diretamente...");
      
      // Criar contrato USDC conectado ao PrizePool antigo (precisa ser owner ou ter allowance)
      // Como não podemos fazer isso diretamente, vamos informar o usuário
      console.log("\n❌ Não é possível transferir diretamente do contrato antigo.");
      console.log("💡 Solução: O contrato antigo precisa ter uma função para transferir USDC.");
      console.log("   Ou você precisa ser o owner e ter uma função withdraw/emergencyWithdraw.");
      throw error;
    }
    throw error;
  }
}

main().catch((err) => {
  console.error("❌ Erro:", err);
  process.exit(1);
});




