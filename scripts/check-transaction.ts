import "dotenv/config"
import { ethers } from "ethers"

const RPC = process.env.ARC_RPC_URL || "https://rpc.testnet.arc.network"
const TX_HASH = "0xdafd7f44b4d09eff6b3d3ec0a3c2c82b5c13d04b3c10463f10d569741c444fff"

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC)

  console.log("🔍 Verificando transação...")
  console.log("📋 Hash:", TX_HASH)
  console.log("🌐 RPC:", RPC, "\n")

  try {
    const tx = await provider.getTransaction(TX_HASH)
    
    if (!tx) {
      console.log("❌ Transação não encontrada")
      return
    }

    console.log("📤 Transação encontrada:")
    console.log("   From:", tx.from)
    console.log("   To:", tx.to)
    console.log("   Value:", ethers.formatEther(tx.value), "ETH")
    console.log("   Gas Limit:", tx.gasLimit.toString())
    console.log("   Gas Price:", tx.gasPrice?.toString(), "wei")
    console.log("   Nonce:", tx.nonce)
    console.log("   Data:", tx.data.substring(0, 66) + "...")

    const receipt = await provider.getTransactionReceipt(TX_HASH)
    
    if (receipt) {
      console.log("\n✅ Receipt:")
      console.log("   Status:", receipt.status === 1 ? "✅ Sucesso" : "❌ Falhou")
      console.log("   Block Number:", receipt.blockNumber)
      console.log("   Block Hash:", receipt.blockHash)
      console.log("   Gas Used:", receipt.gasUsed.toString())
      console.log("   Effective Gas Price:", receipt.gasPrice?.toString(), "wei")
      console.log("   Transaction Index:", receipt.index)
      console.log("   Logs:", receipt.logs.length, "eventos")
      
      if (receipt.logs.length > 0) {
        console.log("\n📋 Eventos:")
        receipt.logs.forEach((log, i) => {
          console.log(`   ${i + 1}. Address: ${log.address}`)
          console.log(`      Topics: ${log.topics.length}`)
          console.log(`      Data: ${log.data.substring(0, 66)}...`)
        })
      }
    }

    console.log("\n🔗 Explorer:")
    console.log(`   https://testnet.arcscan.app/tx/${TX_HASH}`)

  } catch (error: any) {
    console.error("❌ Erro ao verificar transação:", error.message)
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Erro:", error)
    process.exit(1)
  })




