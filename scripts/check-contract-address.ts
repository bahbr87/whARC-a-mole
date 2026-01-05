import { ethers } from "ethers"

const ADDRESS = "0x548eE0ACBF88fBc5f30CFD4Ee1324282EAf9814D"
const RPC = "https://rpc.testnet.arc.network"

const GAME_CREDITS_ABI = [
  "function CREDIT_PRICE() view returns (uint256)",
  "function CLICK_COST() view returns (uint256)",
  "function migrationEnabled() view returns (bool)",
  "function credits(address player) view returns (uint256)",
]

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC)
  
  console.log("🔍 Verificando endereço:", ADDRESS)
  console.log("🌐 RPC:", RPC, "\n")

  try {
    // Verificar se é um contrato
    const code = await provider.getCode(ADDRESS)
    if (code === "0x") {
      console.log("❌ Este endereço não é um contrato (EOA - Externally Owned Account)")
      
      // Verificar saldo
      const balance = await provider.getBalance(ADDRESS)
      const balanceFormatted = Number(balance) / 1_000_000_000_000_000_000
      console.log(`💰 Saldo: ${balanceFormatted.toFixed(6)} USDC (para gas)`)
      return
    }

    console.log("✅ É um contrato deployado\n")

    // Tentar verificar se é GameCredits
    try {
      const contract = new ethers.Contract(ADDRESS, GAME_CREDITS_ABI, provider)
      
      const creditPrice = await contract.CREDIT_PRICE()
      const clickCost = await contract.CLICK_COST()
      const migrationEnabled = await contract.migrationEnabled()
      
      console.log("📋 Informações do Contrato GameCredits:")
      console.log(`   CREDIT_PRICE: ${creditPrice.toString()} (${Number(creditPrice) / 1_000_000} USDC)`)
      console.log(`   CLICK_COST: ${clickCost.toString()} (${Number(clickCost) / 1_000_000} USDC)`)
      console.log(`   migrationEnabled: ${migrationEnabled ? "✅ ATIVADO" : "❌ DESATIVADO"}`)
      
      console.log("\n🔗 Explorer:", `https://testnet.arcscan.app/address/${ADDRESS}`)
    } catch (error: any) {
      console.log("⚠️  Não é um contrato GameCredits ou ABI não compatível")
      console.log("   Erro:", error.message)
    }

    // Verificar saldo do contrato
    const balance = await provider.getBalance(ADDRESS)
    const balanceFormatted = Number(balance) / 1_000_000_000_000_000_000
    console.log(`\n💰 Saldo do contrato: ${balanceFormatted.toFixed(6)} USDC (para gas)`)

  } catch (error: any) {
    console.error("❌ Erro:", error.message)
  }
}

main()

