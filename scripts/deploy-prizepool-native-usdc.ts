import { ethers } from "ethers"
import * as dotenv from "dotenv"
import * as fs from "fs"
import * as path from "path"
import { fileURLToPath } from "url"
import solc from "solc"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config()

/**
 * CONFIGURAÇÃO
 * Coloque no seu .env.local:
 *
 * ARC_RPC_URL=https://rpc.testnet.arc.network
 * OWNER_PRIVATE_KEY=0xSUA_PRIVATE_KEY
 */

const RPC_URL = process.env.ARC_RPC_URL!

const PRIVATE_KEY = process.env.OWNER_PRIVATE_KEY!

if (!RPC_URL || !PRIVATE_KEY) {
  throw new Error("❌ ARC_RPC_URL ou OWNER_PRIVATE_KEY não configurados")
}

const provider = new ethers.JsonRpcProvider(RPC_URL)
const wallet = new ethers.Wallet(PRIVATE_KEY, provider)

async function main() {
  console.log("🚀 Deployando PrizePool com USDC NATIVO da Arc Testnet")
  console.log("👤 Deployer:", wallet.address)

  const PrizePoolSource = `
  // SPDX-License-Identifier: MIT
  pragma solidity ^0.8.20;

  contract PrizePool {
      address public owner;

      constructor() {
          owner = msg.sender;
      }

      modifier onlyOwner() {
          require(msg.sender == owner, "only owner");
          _;
      }

      // Aceita USDC NATIVO (saldo da rede)
      receive() external payable {}
      function deposit() external payable {}

      function payWinner(address winner, uint256 amount) external onlyOwner {
          require(address(this).balance >= amount, "insufficient balance");
          (bool ok, ) = winner.call{value: amount}("");
          require(ok, "transfer failed");
      }

      function withdraw(uint256 amount) external onlyOwner {
          require(address(this).balance >= amount, "insufficient balance");
          (bool ok, ) = owner.call{value: amount}("");
          require(ok, "withdraw failed");
      }

      function balance() external view returns (uint256) {
          return address(this).balance;
      }
  }
  `

  // Compilar o contrato usando solc
  console.log("📦 Compilando PrizePool...")
  const input = {
    language: "Solidity",
    sources: {
      "PrizePool.sol": {
        content: PrizePoolSource,
      },
    },
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: "cancun",
      outputSelection: {
        "*": {
          "*": ["abi", "evm.bytecode"],
        },
      },
    },
  }

  const output = JSON.parse(solc.compile(JSON.stringify(input)))

  if (output.errors) {
    const errors = output.errors.filter((e: any) => e.severity === "error")
    if (errors.length > 0) {
      console.error("❌ Compilation errors:")
      errors.forEach((error: any) => console.error(error.formattedMessage))
      process.exit(1)
    }
  }

  const PrizePool = output.contracts["PrizePool.sol"]["PrizePool"]

  if (!PrizePool) {
    console.error("❌ PrizePool contract not found in compilation output")
    process.exit(1)
  }

  console.log("✅ PrizePool compiled successfully")
  console.log("")

  // Deploy
  const factory = new ethers.ContractFactory(
    PrizePool.abi,
    PrizePool.evm.bytecode.object,
    wallet
  )

  const contract = await factory.deploy()
  await contract.waitForDeployment()

  const address = await contract.getAddress()

  console.log("✅ PRIZEPOOL DEPLOYADO COM SUCESSO")
  console.log("🏦 Endereço:", address)
  console.log("🔗 Explorer: https://testnet.arcscan.app/address/" + address)
  console.log("")
  console.log("👉 AGORA VOCÊ PODE:")
  console.log("- Enviar USDC direto do faucet")
  console.log("- Usar MetaMask normalmente")
  console.log("- Ver saldo com balance()")
  console.log("- Pagar prêmios sem erro")
}

main().catch((err) => {
  console.error("❌ Erro no deploy:", err)
  process.exit(1)
})

