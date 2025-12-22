import { JsonRpcProvider, Contract } from "ethers"
import dotenv from "dotenv"
import path from "path"

dotenv.config({ path: path.join(process.cwd(), ".env.local") })

const RPC_URL = process.env.RPC_URL || "https://rpc.testnet.arc.network"
const CHAIN_ID = parseInt(process.env.CHAIN_ID || "5042002")
const PRIZE_POOL_ADDRESS = process.env.NEXT_PUBLIC_PRIZE_POOL_CONTRACT_ADDRESS || "0xeA0df70040E77a821b14770E53aa577A745930ae"

// Try different ABIs to see which functions exist
const ABIS = {
  setDailyWinnersArray: [
    "function setDailyWinnersArray(uint256 date, address[] calldata winners) external",
  ],
  setDailyWinners: [
    "function setDailyWinners(uint256 date, address first, address second, address third) external",
  ],
  getWinner: [
    "function getWinner(uint256 date, uint8 rank) view returns (address)",
  ],
  dailyWinners: [
    "function dailyWinners(uint256 date, uint8 rank) view returns (address)",
  ],
  claimPrize: [
    "function claimPrize(uint256 date, uint8 rank) external",
  ],
  owner: [
    "function owner() view returns (address)",
  ],
}

async function checkContractFunctions() {
  console.log("=".repeat(70))
  console.log("🔍 VERIFICANDO FUNÇÕES DO CONTRATO")
  console.log("=".repeat(70))
  console.log("")
  console.log(`📋 Contrato: ${PRIZE_POOL_ADDRESS}`)
  console.log("")

  try {
    const provider = new JsonRpcProvider(RPC_URL, CHAIN_ID)
    
    // Check if contract exists
    const code = await provider.getCode(PRIZE_POOL_ADDRESS)
    if (code === "0x") {
      console.log("❌ Nenhum código encontrado neste endereço")
      return
    }
    console.log("✅ Contrato encontrado")
    console.log("")

    // Test each function
    const results: { [key: string]: boolean } = {}

    for (const [name, abi] of Object.entries(ABIS)) {
      try {
        const contract = new Contract(PRIZE_POOL_ADDRESS, abi, provider)
        
        if (name === "owner") {
          const owner = await contract.owner()
          console.log(`✅ ${name}: ${owner}`)
          results[name] = true
        } else if (name === "getWinner" || name === "dailyWinners") {
          // Try to call with a test day and rank
          const testDay = 20000
          const testRank = 1
          try {
            if (name === "getWinner") {
              await contract.getWinner(testDay, testRank)
            } else {
              await contract.dailyWinners(testDay, testRank)
            }
            console.log(`✅ ${name}: Função existe`)
            results[name] = true
          } catch (error: any) {
            if (error.message?.includes("missing revert data") || error.code === "CALL_EXCEPTION") {
              console.log(`❌ ${name}: Função não existe ou erro ao chamar`)
              results[name] = false
            } else {
              // If it's a different error (like "no winner"), the function exists
              console.log(`✅ ${name}: Função existe (erro esperado: ${error.message?.substring(0, 50)})`)
              results[name] = true
            }
          }
        } else {
          // For write functions, just check if they exist by encoding
          const iface = new (await import("ethers")).Interface(abi)
          const functionFragment = iface.getFunction(name)
          if (functionFragment) {
            console.log(`✅ ${name}: Função encontrada na ABI`)
            results[name] = true
          } else {
            console.log(`❌ ${name}: Função não encontrada na ABI`)
            results[name] = false
          }
        }
      } catch (error: any) {
        console.log(`❌ ${name}: ${error.message?.substring(0, 50)}`)
        results[name] = false
      }
    }

    console.log("")
    console.log("=".repeat(70))
    console.log("📊 RESUMO")
    console.log("=".repeat(70))
    console.log("")
    
    for (const [name, exists] of Object.entries(results)) {
      console.log(`${exists ? "✅" : "❌"} ${name}: ${exists ? "Disponível" : "Não disponível"}`)
    }

  } catch (error: any) {
    console.error("❌ Erro:", error.message)
  }
}

checkContractFunctions().catch(console.error)



