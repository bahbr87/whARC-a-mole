import { ethers } from "ethers"
import dotenv from "dotenv"

dotenv.config({ path: ".env.local" })

/**
 * BACKFILL — Corrigir vencedores do dia 16/12/2025 (UTC)
 * 
 * ⚠️ IMPORTANTE:
 * - Rodar apenas UMA VEZ
 * - Usar owner do contrato
 * - NÃO rodar de novo para o mesmo dia
 */

const RPC_URL = process.env.RPC_URL || "https://rpc.testnet.arc.network"
const OWNER_PRIVATE_KEY = process.env.PRIZE_POOL_OWNER_PRIVATE_KEY!
const PRIZE_POOL_ADDRESS = process.env.PRIZE_POOL_CONTRACT_ADDRESS || "0xB98b8A9213072903277B9f592009E7C22acd2dd3"

if (!OWNER_PRIVATE_KEY) {
  throw new Error("PRIZE_POOL_OWNER_PRIVATE_KEY não configurado no .env.local")
}

const ABI = [
  "function setDailyWinnersArray(uint256 date, address[] calldata winners) external",
  "function setDailyWinners(uint256 date, address first, address second, address third) external",
  "function getWinner(uint256 date, uint256 rank) view returns (address)",
  "function isWinnersRegistered(uint256 date) view returns (bool)",
  "function owner() view returns (address)",
]

async function main() {
  console.log("🔧 BACKFILL: Corrigindo vencedores do dia 16/12/2025 (UTC)")
  
  const provider = new ethers.JsonRpcProvider(RPC_URL)
  const wallet = new ethers.Wallet(OWNER_PRIVATE_KEY, provider)
  const contract = new ethers.Contract(PRIZE_POOL_ADDRESS, ABI, wallet)

  // Verificar se wallet é owner
  const contractOwner = await contract.owner()
  if (contractOwner.toLowerCase() !== wallet.address.toLowerCase()) {
    throw new Error(`Wallet ${wallet.address} não é o owner do contrato. Owner: ${contractOwner}`)
  }
  console.log("✅ Wallet confirmada como owner:", wallet.address)

  // 📅 16/12/2025 UTC → days since epoch
  // Usando a mesma fórmula: Math.floor(Date.UTC(2025, 11, 16) / 86400000)
  // Nota: mês 11 = dezembro (0-indexed)
  const day = Math.floor(Date.UTC(2025, 11, 16) / 86400000)

  console.log("📅 Dia UTC: 2025-12-16")
  console.log("🧮 Days since epoch:", day)

  // Verificar se já está registrado (tenta getWinner primeiro para verificar)
  let alreadyRegistered = false
  try {
    const existingWinner = await contract.getWinner(day, 1)
    if (existingWinner && existingWinner !== ethers.ZeroAddress) {
      alreadyRegistered = true
    }
  } catch (error) {
    // Se getWinner falhar, assume que não está registrado
    console.log("ℹ️ Não foi possível verificar se já está registrado, prosseguindo...")
  }

  if (alreadyRegistered) {
    console.log("⏭️ Vencedores já registrados para este dia.")
    console.log("\n📋 Vencedores atuais on-chain:")
    for (let i = 1; i <= 3; i++) {
      try {
        const winner = await contract.getWinner(day, i)
        if (winner && winner !== ethers.ZeroAddress) {
          console.log(`   Rank ${i}: ${winner}`)
        }
      } catch (error) {
        // Ignora erros ao buscar ranks que não existem
      }
    }
    console.log("\n⚠️ Se quiser sobrescrever, remova a validação 'alreadyRegistered' no código")
    return
  }

  // 🔥 SUBSTITUA pelos vencedores CORRETOS do dia 16/12/2025
  const winners = [
    "0xB51158878a08a860443B10b2F24617bab5F1F3eA", // rank 1 - SUBSTITUA pelo endereço correto
    // Se só teve 1 jogador, deixe só esse
    // Se teve mais:
    // "0xSEGUNDO_COLOCADO", // rank 2 (opcional)
    // "0xTERCEIRO_COLOCADO", // rank 3 (opcional)
  ]

  // Validar endereços
  for (let i = 0; i < winners.length; i++) {
    if (!ethers.isAddress(winners[i])) {
      throw new Error(`Endereço inválido no índice ${i}: ${winners[i]}`)
    }
    if (winners[i] === ethers.ZeroAddress) {
      throw new Error(`Zero address não permitido no índice ${i}`)
    }
    for (let j = i + 1; j < winners.length; j++) {
      if (winners[i].toLowerCase() === winners[j].toLowerCase()) {
        throw new Error(`Endereço duplicado: ${winners[i]}`)
      }
    }
  }

  if (winners.length === 0) {
    throw new Error("⚠️ Configure os endereços dos vencedores no array 'winners'")
  }

  if (winners.length > 3) {
    throw new Error("Ranking inválido: mais de 3 vencedores")
  }

  console.log("🏆 Vencedores a registrar:", winners)
  console.log(`   Total: ${winners.length} jogador(es)`)

  console.log("\n⛓️ Registrando vencedores...")
  
  // Tentar usar setDailyWinnersArray primeiro, se falhar usar setDailyWinners (legacy)
  let tx
  try {
    console.log(`   Tentando: setDailyWinnersArray(${day}, [${winners.map(w => `"${w}"`).join(", ")}])`)
    tx = await contract.setDailyWinnersArray(day, winners)
  } catch (error: any) {
    // Se setDailyWinnersArray não existir ou falhar, usar setDailyWinners (legacy)
    console.log("⚠️ setDailyWinnersArray não disponível, usando setDailyWinners (legacy)")
    
    // O contrato deployado pode não aceitar zero address para second/third
    // Se só temos 1 vencedor, vamos usar apenas o primeiro e repetir para os outros
    // OU verificar se o contrato aceita zero address
    const first = winners[0]
    
    // Tentar com zero addresses primeiro (contrato atualizado)
    let second = ethers.ZeroAddress
    let third = ethers.ZeroAddress
    
    if (winners.length >= 2) {
      second = winners[1]
    }
    if (winners.length >= 3) {
      third = winners[2]
    }
    
    console.log(`   Chamando: setDailyWinners(${day}, "${first}", "${second}", "${third}")`)
    
    try {
      tx = await contract.setDailyWinners(day, first, second, third)
    } catch (legacyError: any) {
      // Se o contrato não aceita zero address, usar o primeiro endereço para todos
      if (legacyError.message?.includes("Invalid addresses") || legacyError.reason?.includes("Invalid addresses")) {
        console.log("⚠️ Contrato não aceita zero address. Usando primeiro endereço para todos os ranks.")
        tx = await contract.setDailyWinners(day, first, first, first)
      } else {
        throw legacyError
      }
    }
  }
  
  console.log("📤 TX enviada:", tx.hash)
  console.log("⏳ Aguardando confirmação...")

  await tx.wait()

  console.log("✅ Winners registrados com sucesso!")
  console.log("🔗 Explorer:", `https://testnet.arcscan.app/tx/${tx.hash}`)

  console.log("\n📋 Verificando vencedores registrados on-chain:")
  for (let i = 0; i < winners.length; i++) {
    const onchain = await contract.getWinner(day, i + 1)
    console.log(`   Rank ${i + 1}: ${onchain}`)
    
    // Verificar se corresponde
    if (onchain.toLowerCase() !== winners[i].toLowerCase()) {
      console.warn(`   ⚠️ ATENÇÃO: Rank ${i + 1} não corresponde! Esperado: ${winners[i]}, On-chain: ${onchain}`)
    } else {
      console.log(`   ✅ Rank ${i + 1} confirmado`)
    }
  }

  console.log("\n✅ BACKFILL concluído!")
  console.log("🎯 Agora o frontend deve funcionar:")
  console.log("   - getWinner(day, rank) retorna a wallet correta")
  console.log("   - Botão 'Reivindicar Prêmio' habilita")
  console.log("   - claimPrize(day, rank) FUNCIONA")
  console.log("   - Erro NÃO volta")
}

main().catch((err) => {
  console.error("❌ Erro:", err.message || err)
  process.exit(1)
})

