import { JsonRpcProvider, Contract, Interface } from "ethers"
import dotenv from "dotenv"
import path from "path"

dotenv.config({ path: path.join(process.cwd(), ".env.local") })

const RPC_URL = process.env.RPC_URL || "https://rpc.testnet.arc.network"
const PRIZE_POOL_ADDRESS = "0xeA0df70040E77a821b14770E53aa577A745930ae"

// ABI comum para verificar funções de transferência
const COMMON_ABI = [
  // Funções de transferência direta
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) external returns (bool)",
  
  // Funções de distribuição
  "function distributePrize(address winner, uint256 amount) external",
  "function distributePrizesBatch(address[] calldata winners, uint256[] calldata amounts) external",
  
  // Funções de withdraw/emergency
  "function withdraw(uint256 amount) external",
  "function emergencyWithdraw() external",
  "function withdrawAll() external",
  "function withdrawUSDC(uint256 amount) external",
  "function withdrawToken(address token, uint256 amount) external",
  
  // Funções de owner
  "function owner() view returns (address)",
  "function renounceOwnership() external",
  "function transferOwnership(address newOwner) external",
  
  // Funções de USDC/ERC20
  "function usdc() view returns (address)",
  "function getPrizePoolBalance() view returns (uint256)",
]

async function analyzeDeployedContract() {
  console.log("=".repeat(70))
  console.log("🔍 ANÁLISE DO CONTRATO DEPLOYADO")
  console.log("=".repeat(70))
  console.log("")
  console.log(`📍 Endereço: ${PRIZE_POOL_ADDRESS}`)
  console.log("")

  try {
    const provider = new JsonRpcProvider(RPC_URL)
    
    // Verificar se contrato existe
    const code = await provider.getCode(PRIZE_POOL_ADDRESS)
    if (code === "0x" || code === "0x0" || code.length <= 2) {
      console.log("❌ Nenhum código encontrado neste endereço")
      return
    }
    console.log(`✅ Contrato encontrado (${code.length} caracteres)`)
    console.log("")

    // Tentar verificar owner
    try {
      const ownerContract = new Contract(PRIZE_POOL_ADDRESS, ["function owner() view returns (address)"], provider)
      const owner = await ownerContract.owner()
      console.log(`👤 Owner do contrato: ${owner}`)
    } catch (error) {
      console.log("⚠️ Não foi possível obter owner (função pode não existir)")
    }
    console.log("")

    // Verificar funções de transferência
    console.log("🔍 VERIFICANDO FUNÇÕES DE TRANSFERÊNCIA DE ERC20:")
    console.log("-".repeat(70))

    const transferFunctions = [
      { name: "distributePrize", sig: "function distributePrize(address winner, uint256 amount) external", restricted: "onlyOwner" },
      { name: "distributePrizesBatch", sig: "function distributePrizesBatch(address[] calldata winners, uint256[] calldata amounts) external", restricted: "onlyOwner" },
      { name: "withdraw", sig: "function withdraw(uint256 amount) external", restricted: "unknown" },
      { name: "emergencyWithdraw", sig: "function emergencyWithdraw() external", restricted: "onlyOwner" },
      { name: "withdrawAll", sig: "function withdrawAll() external", restricted: "unknown" },
      { name: "withdrawUSDC", sig: "function withdrawUSDC(uint256 amount) external", restricted: "unknown" },
      { name: "withdrawToken", sig: "function withdrawToken(address token, uint256 amount) external", restricted: "unknown" },
    ]

    const results: Array<{
      name: string
      sig: string
      exists: boolean
      restricted: string
      canCall: string
    }> = []

    for (const func of transferFunctions) {
      try {
        const contract = new Contract(PRIZE_POOL_ADDRESS, [func.sig], provider)
        const iface = new Interface([func.sig])
        const functionFragment = iface.getFunction(func.name)
        
        if (functionFragment) {
          // Tentar verificar se é onlyOwner testando com uma chamada que falharia se não for owner
          // Mas primeiro vamos apenas verificar se a função existe
          results.push({
            name: func.name,
            sig: func.sig,
            exists: true,
            restricted: func.restricted,
            canCall: func.restricted === "onlyOwner" ? "Apenas owner" : "Verificar no contrato"
          })
        }
      } catch (error: any) {
        // Função não existe ou não pode ser chamada
        results.push({
          name: func.name,
          sig: func.sig,
          exists: false,
          restricted: func.restricted,
          canCall: "N/A"
        })
      }
    }

    // Verificar usando estimateGas para funções que podem existir
    console.log("📋 Testando existência de funções via estimateGas:")
    console.log("")
    
    for (const func of transferFunctions) {
      try {
        const contract = new Contract(PRIZE_POOL_ADDRESS, [func.sig], provider)
        
        // Tentar estimar gas (isso falha se a função não existir)
        let exists = false
        try {
          if (func.name === "distributePrize") {
            // Test address
            await contract.distributePrize.estimateGas("0x0000000000000000000000000000000000000001", 1)
          } else if (func.name === "distributePrizesBatch") {
            await contract.distributePrizesBatch.estimateGas(["0x0000000000000000000000000000000000000001"], [1])
          } else if (func.name === "emergencyWithdraw") {
            await contract.emergencyWithdraw.estimateGas()
          } else if (func.name === "withdraw") {
            await contract.withdraw.estimateGas(1)
          } else if (func.name === "withdrawUSDC") {
            await contract.withdrawUSDC.estimateGas(1)
          } else if (func.name === "withdrawToken") {
            await contract.withdrawToken.estimateGas("0x0000000000000000000000000000000000000000", 1)
          }
          exists = true
        } catch (estimateError: any) {
          // Se o erro for "missing revert data" ou "function does not exist", a função não existe
          if (estimateError.code === "CALL_EXCEPTION" && 
              (estimateError.message?.includes("missing revert data") || 
               estimateError.message?.includes("function does not exist"))) {
            exists = false
          } else {
            // Outro erro (pode ser que a função existe mas falhou na validação)
            exists = true
          }
        }

        if (exists) {
          console.log(`✅ ${func.name}`)
          console.log(`   Assinatura: ${func.sig}`)
          console.log(`   Restrição: ${func.restricted}`)
          console.log(`   Quem pode chamar: ${func.restricted === "onlyOwner" ? "Apenas owner" : "Verificar no contrato"}`)
          console.log("")
        }
      } catch (error: any) {
        // Função não existe
      }
    }

    // Verificar funções do contrato atual (PrizePool.sol)
    console.log("")
    console.log("=".repeat(70))
    console.log("📋 FUNÇÕES DO CONTRATO ATUAL (PrizePool.sol):")
    console.log("=".repeat(70))
    console.log("")
    console.log("✅ emergencyWithdraw()")
    console.log("   Assinatura: function emergencyWithdraw() external onlyOwner nonReentrant")
    console.log("   Quem pode chamar: Apenas owner")
    console.log("   O que faz: Transfere todo o saldo USDC do contrato para o owner")
    console.log("")

  } catch (error: any) {
    console.error("❌ Erro:", error.message)
    console.error(error)
  }
}

analyzeDeployedContract().catch(console.error)



