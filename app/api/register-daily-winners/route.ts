import { NextRequest, NextResponse } from "next/server"
import { JsonRpcProvider, Contract, Wallet, isAddress, getAddress } from "ethers"
import { promises as fs } from "fs"
import path from "path"
import { getDayId } from "@/utils/day"
import { supabaseAdmin } from "@/lib/supabase"

// PrizePool ABI - Funções necessárias para registro de vencedores e claims
const PRIZE_POOL_ABI = [
  "function setDailyWinners(uint256 day, address[] calldata _winners, uint256 _totalPlayers) external",
  "function getWinner(uint256 day, uint256 rank) view returns (address)",
  "function totalPlayers(uint256 day) view returns (uint256)",
  "function owner() view returns (address)",
]

// RankingEntry interface
interface RankingEntry {
  player: string
  score: number // points from database
  goldenMoles: number // golden_moles from database
  errors: number
  timestamp: number
}

// Get UTC day start and end
function getUTCDayStart(date: Date): number {
  const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0))
  return utcDate.getTime()
}

function getUTCDayEnd(date: Date): number {
  const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999))
  return utcDate.getTime()
}

// ✅ CORREÇÃO: Buscar rankings do Supabase em vez de arquivo
// O sistema foi migrado para Supabase, então precisamos buscar os dados da tabela matches
async function loadRankings(): Promise<RankingEntry[]> {
  try {
    // Buscar todas as matches do Supabase
    const { data: matches, error } = await supabaseAdmin
      .from("matches")
      .select("player, points, golden_moles, errors, timestamp")
      .order("timestamp", { ascending: true });

    if (error) {
      console.error("[REGISTER-WINNERS] Error fetching matches from Supabase:", error);
      return [];
    }

    if (!matches || matches.length === 0) {
      console.log("[REGISTER-WINNERS] No matches found in Supabase");
      return [];
    }

    // Converter para o formato RankingEntry (usando points como score)
    const rankings: RankingEntry[] = matches.map((match: any) => ({
      player: match.player || "",
      score: match.points || 0, // points do banco vira score
      goldenMoles: match.golden_moles || 0,
      errors: match.errors || 0,
      timestamp: new Date(match.timestamp).getTime(), // Converter ISO string para timestamp
    }));

    console.log(`[REGISTER-WINNERS] Loaded ${rankings.length} matches from Supabase`);
    return rankings;
  } catch (error) {
    console.error("[REGISTER-WINNERS] Error loading rankings:", error);
    return [];
  }
}

// Validate and normalize an address
function validateAddress(address: string | null | undefined, fieldName: string): string {
  if (!address) {
    throw new Error(`${fieldName} is null, undefined, or empty`)
  }
  
  const trimmed = String(address).trim()
  if (!trimmed || trimmed === "0x0000000000000000000000000000000000000000") {
    throw new Error(`${fieldName} is zero address or empty`)
  }
  
  if (!isAddress(trimmed)) {
    throw new Error(`${fieldName} is not a valid Ethereum address: ${trimmed}`)
  }
  
  // Normalize address (checksum)
  return getAddress(trimmed)
}

// Calculate top winners for a specific date (progressive distribution: 1-3 players)
// Returns only valid addresses, never zero address, null, or undefined
function calculateDailyWinners(rankings: RankingEntry[], date: Date): { first: string; second: string | null; third: string | null; totalPlayers: number } | null {
  const dayStart = getUTCDayStart(date)
  const dayEnd = getUTCDayEnd(date)

  // Filter rankings for this specific day
  const dayRankings = rankings
    .filter((entry) => entry.timestamp >= dayStart && entry.timestamp <= dayEnd)
    .reduce((acc, entry) => {
      const existing = acc.get(entry.player)
      if (existing) {
        existing.score += entry.score
        existing.goldenMoles += entry.goldenMoles
        existing.errors += entry.errors
      } else {
        acc.set(entry.player, {
          player: entry.player,
          score: entry.score,
          goldenMoles: entry.goldenMoles,
          errors: entry.errors,
          timestamp: entry.timestamp,
        })
      }
      return acc
    }, new Map<string, RankingEntry>())

  // Sort by score, goldenMoles, errors
  const sorted = Array.from(dayRankings.values()).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (b.goldenMoles !== a.goldenMoles) return b.goldenMoles - a.goldenMoles
    if (a.errors !== b.errors) return a.errors - b.errors
    return a.timestamp - b.timestamp
  })

  const totalPlayers = sorted.length
  
  // At least 1 player required
  if (totalPlayers === 0) {
    return null
  }

  // Progressive distribution: return only valid addresses (never zero address)
  // 1 player → only first
  // 2 players → first and second
  // 3+ players → first, second, and third
  
  // Validate and normalize first place (always required)
  const first = validateAddress(sorted[0].player, "First place address")
  
  // Second place: only if there are at least 2 players
  let second: string | null = null
  if (totalPlayers >= 2) {
    second = validateAddress(sorted[1].player, "Second place address")
  }
  
  // Third place: only if there are at least 3 players
  let third: string | null = null
  if (totalPlayers >= 3) {
    third = validateAddress(sorted[2].player, "Third place address")
  }
  
  return {
    first,
    second,
    third,
    totalPlayers,
  }
}

export async function POST(request: NextRequest) {
  const logs: string[] = []
  const validationFlags: { [key: string]: any } = {}
  
  const addLog = (message: string) => {
    const timestamp = new Date().toISOString()
    const logMessage = `[${timestamp}] ${message}`
    console.log(logMessage)
    logs.push(logMessage)
  }

  try {
    addLog("📥 POST /api/register-daily-winners - Iniciando")
    
    const body = await request.json()
    const { date } = body
    addLog(`📋 Parâmetros recebidos: date=${date}`)

    if (!date) {
      addLog("❌ ERRO: date não fornecido")
      return NextResponse.json(
        { error: "Missing required parameter: date (ISO string)", logs },
        { status: 400 }
      )
    }

    // Get configuration
    const RPC_URL = process.env.RPC_URL || "https://rpc.testnet.arc.network"
    // Use NEXT_PUBLIC_PRIZE_POOL_CONTRACT_ADDRESS if available, otherwise fallback
    const PRIZE_POOL_ADDRESS = process.env.NEXT_PUBLIC_PRIZE_POOL_CONTRACT_ADDRESS || process.env.PRIZE_POOL_CONTRACT_ADDRESS || "0xeA0df70040E77a821b14770E53aa577A745930ae"
    const OWNER_PRIVATE_KEY = process.env.PRIZE_POOL_OWNER_PRIVATE_KEY

    addLog(`⚙️ Configuração: RPC_URL=${RPC_URL}`)
    addLog(`⚙️ Configuração: PRIZE_POOL_ADDRESS=${PRIZE_POOL_ADDRESS}`)
    addLog(`⚙️ Configuração: OWNER_PRIVATE_KEY=${OWNER_PRIVATE_KEY ? "✅ Configurado" : "❌ Não configurado"}`)

    if (!OWNER_PRIVATE_KEY) {
      addLog("❌ ERRO: PRIZE_POOL_OWNER_PRIVATE_KEY não configurado")
      validationFlags.ownerPrivateKeyConfigured = false
      console.error("❌ PRIZE_POOL_OWNER_PRIVATE_KEY not configured in .env.local")
      return NextResponse.json(
        { 
          error: "PrizePool owner private key not configured. Set PRIZE_POOL_OWNER_PRIVATE_KEY in .env.local",
          hint: "Add PRIZE_POOL_OWNER_PRIVATE_KEY=0x... to your .env.local file with the owner's private key",
          validationFlags,
          logs
        },
        { status: 500 }
      )
    }
    validationFlags.ownerPrivateKeyConfigured = true
    
    const wallet = new Wallet(OWNER_PRIVATE_KEY)
    const walletAddress = wallet.address
    addLog(`🔑 Wallet criada: ${walletAddress}`)
    console.log(`🔑 Using owner wallet: ${walletAddress}`)

    // Parse date and calculate days since epoch (UTC)
    addLog("📅 Iniciando parse da data")
    let dateObj: Date
    let daysSinceEpoch: number
    try {
      dateObj = new Date(date)
      addLog(`📅 Date criada: ${dateObj.toISOString()}`)
      
      if (isNaN(dateObj.getTime())) {
        addLog(`❌ ERRO: Data inválida: ${date}`)
        return NextResponse.json(
          { error: `Invalid date format: ${date}. Expected ISO date string (e.g., "2024-12-15")`, logs },
          { status: 400 }
        )
      }
      
      daysSinceEpoch = getDayId(dateObj)
      addLog(`📅 Days since epoch calculado: ${daysSinceEpoch}`)
    } catch (dateError: any) {
      addLog(`❌ ERRO ao calcular data: ${dateError.message}`)
      return NextResponse.json(
        { error: `Date calculation error: ${dateError.message}`, logs },
        { status: 400 }
      )
    }
    
    console.log(`📅 Date: ${dateObj.toISOString().split('T')[0]} (UTC) = ${daysSinceEpoch} days since epoch`)
    addLog(`📅 Data final: ${dateObj.toISOString().split('T')[0]} (UTC) = ${daysSinceEpoch} days since epoch`)

    // Load rankings and calculate winners
    addLog("📊 Carregando rankings do arquivo")
    const rankings = await loadRankings()
    addLog(`📊 Rankings carregados: ${rankings.length} total`)
    console.log(`📊 Loaded ${rankings.length} total rankings from file`)
    
    addLog("🏆 Calculando vencedores do dia")
    let winners: { first: string; second: string | null; third: string | null; totalPlayers: number } | null
    try {
      winners = calculateDailyWinners(rankings, dateObj)
      addLog(`🏆 Vencedores calculados: first=${winners?.first || "null"}, second=${winners?.second || "null"}, third=${winners?.third || "null"}, totalPlayers=${winners?.totalPlayers || 0}`)
    } catch (validationError: any) {
      addLog(`❌ ERRO ao calcular vencedores: ${validationError.message}`)
      console.error(`❌ Address validation error:`, validationError.message)
      return NextResponse.json(
        { 
          error: `Invalid address in rankings: ${validationError.message}`,
          validationFlags,
          logs
        },
        { status: 400 }
      )
    }
    
    console.log(`🏆 Calculated winners for ${dateObj.toISOString().split('T')[0]}:`, {
      first: winners?.first,
      second: winners?.second || "null",
      third: winners?.third || "null",
      totalPlayers: winners?.totalPlayers || 0,
    })

    if (!winners) {
      addLog(`❌ ERRO: Nenhum jogador encontrado para a data`)
      console.warn(`⚠️ No players for date ${dateObj.toISOString().split('T')[0]}`)
      return NextResponse.json(
        { 
          error: `No players found for date ${dateObj.toISOString().split('T')[0]}. At least 1 player is required.`,
          validationFlags,
          logs
        },
        { status: 400 }
      )
    }

    // Build array with ONLY valid addresses (never zero address, never padding to size 3)
    // Array size = exactly min(totalPlayers, 3) - NO PADDING
    addLog("🔍 Iniciando validação de endereços dos vencedores")
    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
    const winnersArray: string[] = []
    
    // Validate and add first place (always required)
    addLog(`✅ VALIDANDO 1º lugar: ${winners.first}`)
    validationFlags.hasFirst = !!winners.first
    validationFlags.firstIsAddress = winners.first ? isAddress(winners.first) : false
    validationFlags.firstIsNotZero = winners.first ? winners.first !== ZERO_ADDRESS : false
    
    if (!winners.first || !isAddress(winners.first) || winners.first === ZERO_ADDRESS) {
      addLog(`❌ ERRO: Endereço do 1º lugar inválido: ${winners.first}`)
      return NextResponse.json(
        { error: `Invalid first place address: ${winners.first}`, validationFlags, logs },
        { status: 400 }
      )
    }
    const normalizedFirst = getAddress(winners.first)
    winnersArray.push(normalizedFirst)
    addLog(`✅ 1º lugar validado e normalizado: ${normalizedFirst}`)
    
    // Add second place ONLY if it exists (not null)
    addLog(`🔍 Verificando 2º lugar: ${winners.second || "null"}`)
    validationFlags.hasSecond = winners.second !== null
    if (winners.second !== null) {
      validationFlags.secondIsAddress = isAddress(winners.second)
      validationFlags.secondIsNotZero = winners.second !== ZERO_ADDRESS
      
      if (!isAddress(winners.second) || winners.second === ZERO_ADDRESS) {
        addLog(`❌ ERRO: Endereço do 2º lugar inválido: ${winners.second}`)
        return NextResponse.json(
          { error: `Invalid second place address: ${winners.second}`, validationFlags, logs },
          { status: 400 }
        )
      }
      const normalizedSecond = getAddress(winners.second)
      winnersArray.push(normalizedSecond)
      addLog(`✅ 2º lugar validado e normalizado: ${normalizedSecond}`)
    } else {
      addLog(`ℹ️ 2º lugar não existe (null)`)
    }
    
    // Add third place ONLY if it exists (not null)
    addLog(`🔍 Verificando 3º lugar: ${winners.third || "null"}`)
    validationFlags.hasThird = winners.third !== null
    if (winners.third !== null) {
      validationFlags.thirdIsAddress = isAddress(winners.third)
      validationFlags.thirdIsNotZero = winners.third !== ZERO_ADDRESS
      
      if (!isAddress(winners.third) || winners.third === ZERO_ADDRESS) {
        addLog(`❌ ERRO: Endereço do 3º lugar inválido: ${winners.third}`)
        return NextResponse.json(
          { error: `Invalid third place address: ${winners.third}`, validationFlags, logs },
          { status: 400 }
        )
      }
      const normalizedThird = getAddress(winners.third)
      winnersArray.push(normalizedThird)
      addLog(`✅ 3º lugar validado e normalizado: ${normalizedThird}`)
    } else {
      addLog(`ℹ️ 3º lugar não existe (null)`)
    }
    
    // Prepare addresses for setDailyWinners (requires exactly 3, padded with zero if needed)
    const first = winnersArray[0] || ZERO_ADDRESS
    const second = winnersArray[1] || ZERO_ADDRESS
    const third = winnersArray[2] || ZERO_ADDRESS
    addLog(`📋 Endereços preparados para setDailyWinners: first=${first}, second=${second}, third=${third}`)
    
    // Final validation: array must contain only valid non-zero addresses
    // Array size must be exactly min(totalPlayers, 3) - NO PADDING
    const expectedSize = Math.min(winners.totalPlayers, 3)
    validationFlags.expectedSize = expectedSize
    validationFlags.actualSize = winnersArray.length
    validationFlags.sizeMatches = winnersArray.length === expectedSize
    
    addLog(`🔍 Validando tamanho do array: esperado=${expectedSize}, atual=${winnersArray.length}`)
    if (winnersArray.length !== expectedSize) {
      addLog(`❌ ERRO: Tamanho do array inválido`)
      return NextResponse.json(
        { error: `Invalid winners array size: expected ${expectedSize} addresses (min(${winners.totalPlayers}, 3)), got ${winnersArray.length}`, validationFlags, logs },
        { status: 400 }
      )
    }
    addLog(`✅ Tamanho do array válido`)
    
    // Validate all addresses in array are non-zero (double check)
    addLog("🔍 Validando todos os endereços no array")
    for (let i = 0; i < winnersArray.length; i++) {
      const isValid = isAddress(winnersArray[i])
      const isNotZero = winnersArray[i] !== ZERO_ADDRESS
      validationFlags[`address${i}_isValid`] = isValid
      validationFlags[`address${i}_isNotZero`] = isNotZero
      
      addLog(`  Endereço ${i}: ${winnersArray[i]} - isValid=${isValid}, isNotZero=${isNotZero}`)
      
      if (!isValid || !isNotZero) {
        addLog(`❌ ERRO: Endereço inválido no índice ${i}: ${winnersArray[i]}`)
        return NextResponse.json(
          { error: `Invalid address at index ${i}: ${winnersArray[i]}`, validationFlags, logs },
          { status: 400 }
        )
      }
    }
    addLog("✅ Todos os endereços validados")
    
    console.log(`✅ Validated ${winnersArray.length} winner address(es) (exactly min(${winners.totalPlayers}, 3)):`)
    winnersArray.forEach((addr, idx) => {
      const rank = idx === 0 ? '1st' : idx === 1 ? '2nd' : '3rd'
      console.log(`  - ${rank} place: ${addr} ✅`)
    })

    // Create provider and connect wallet
    addLog("🌐 Criando provider e conectando wallet")
    const provider = new JsonRpcProvider(RPC_URL)
    const walletWithProvider = wallet.connect(provider)
    addLog(`✅ Provider criado: ${RPC_URL}`)
    addLog(`✅ Wallet conectada ao provider`)

    // Verify contract has code
    addLog(`🔍 Verificando se contrato tem código: ${PRIZE_POOL_ADDRESS}`)
    const contractCode = await provider.getCode(PRIZE_POOL_ADDRESS)
    if (contractCode === "0x" || contractCode === "0x0") {
      addLog(`❌ ERRO: Contrato não tem código neste endereço`)
      validationFlags.contractHasCode = false
      return NextResponse.json(
        { 
          error: `No contract code found at address ${PRIZE_POOL_ADDRESS}`,
          validationFlags,
          logs
        },
        { status: 500 }
      )
    }
    addLog(`✅ Contrato tem código (${contractCode.length} caracteres)`)
    validationFlags.contractHasCode = true

    // Create contract instance (read-only for checks)
    addLog(`📄 Criando instância do contrato (read-only): ${PRIZE_POOL_ADDRESS}`)
    const readContract = new Contract(PRIZE_POOL_ADDRESS, PRIZE_POOL_ABI, provider)
    
    // 1. VERIFY WALLET IS OWNER (before attempting any write operations)
    addLog("🔍 Verificando se wallet é owner do contrato")
    let contractOwner: string
    try {
      contractOwner = await readContract.owner()
      addLog(`📋 Owner do contrato: ${contractOwner}`)
      addLog(`📋 Wallet configurada: ${walletAddress}`)
      validationFlags.contractOwner = contractOwner
      validationFlags.walletAddress = walletAddress
      validationFlags.isOwner = contractOwner.toLowerCase() === walletAddress.toLowerCase()
    } catch (error: any) {
      addLog(`❌ ERRO ao verificar owner: ${error.message}`)
      return NextResponse.json(
        { 
          error: `Failed to get contract owner: ${error.message}`,
          validationFlags,
          logs
        },
        { status: 500 }
      )
    }
    
    if (contractOwner.toLowerCase() !== walletAddress.toLowerCase()) {
      addLog(`❌ ERRO: Wallet não é owner do contrato`)
      console.error(`❌ Wallet ${walletAddress} is not the contract owner. Owner is ${contractOwner}`)
      return NextResponse.json(
        { 
          error: `Wallet ${walletAddress} is not the contract owner. Owner is ${contractOwner}`,
          hint: "Use the owner's private key in PRIZE_POOL_OWNER_PRIVATE_KEY",
          validationFlags,
          logs
        },
        { status: 403 }
      )
    }
    addLog(`✅ Wallet é owner do contrato`)
    console.log(`✅ Verified wallet ${walletAddress} is the contract owner`)

    // 2. CHECK IF WINNERS ARE ALREADY REGISTERED (ANTI-BUG: não registrar se já existir)
    addLog(`🔍 Verificando se vencedores já estão registrados para day=${daysSinceEpoch}`)
    let alreadySet = false
    validationFlags.checkedAlreadyRegistered = true
    
    try {
      // Check totalPlayers[day] - if > 0, day is already finalized
      addLog("📋 Verificando totalPlayers(day)")
      const totalPlayersOnChain = await readContract.totalPlayers(daysSinceEpoch)
      addLog(`✅ totalPlayers(day) retornou: ${totalPlayersOnChain.toString()}`)
      alreadySet = totalPlayersOnChain > BigInt(0)
      validationFlags.totalPlayersOnChain = totalPlayersOnChain.toString()
      validationFlags.alreadySet = alreadySet
    } catch (error: any) {
      // If totalPlayers doesn't exist, check getWinner directly
      addLog(`⚠️ totalPlayers não disponível: ${error.message}`)
      addLog("📋 Tentando getWinner(day, 1) como fallback")
      try {
        const winner1 = await readContract.getWinner(daysSinceEpoch, 1)
        addLog(`✅ getWinner(day, 1) retornou: ${winner1}`)
        alreadySet = winner1 !== "0x0000000000000000000000000000000000000000"
        addLog(`✅ alreadySet calculado: ${alreadySet}`)
        validationFlags.getWinnerExists = true
        validationFlags.getWinnerResult = winner1
      } catch (getWinnerError: any) {
        addLog(`❌ getWinner também falhou: ${getWinnerError.message}`)
        validationFlags.getWinnerExists = false
        addLog(`⚠️ Não foi possível verificar, assumindo não registrado`)
        alreadySet = false
      }
      validationFlags.checkFailed = true
      validationFlags.checkError = error.message
    }
    
    validationFlags.alreadySet = alreadySet
    addLog(`📊 Resultado da verificação: alreadySet=${alreadySet}`)
    
    if (alreadySet) {
      addLog(`ℹ️ Vencedores já estão registrados, retornando vencedores existentes`)
      console.log(`ℹ️ Winners already registered for day ${daysSinceEpoch} (${dateObj.toISOString().split('T')[0]})`)
      
      // Return existing winners
      const existingFirst = await readContract.getWinner(daysSinceEpoch, 1)
      const existingSecond = await readContract.getWinner(daysSinceEpoch, 2)
      const existingThird = await readContract.getWinner(daysSinceEpoch, 3)
      addLog(`📋 Vencedores existentes: first=${existingFirst}, second=${existingSecond}, third=${existingThird}`)
      
      return NextResponse.json(
        { 
          success: true,
          message: `Winners for date ${dateObj.toISOString().split('T')[0]} are already set in the contract`,
          alreadySet: true,
          day: daysSinceEpoch, // ⚠️ Backend é a fonte da verdade do day
          winners: {
            first: existingFirst,
            second: existingSecond,
            third: existingThird,
          },
          validationFlags,
          logs
        },
        { status: 200 }
      )
    }

    // 3. VALIDATE DATE FORMAT (days since epoch must be valid)
    addLog(`🔍 Validando formato da data: daysSinceEpoch=${daysSinceEpoch}`)
    validationFlags.daysSinceEpochIsValid = !isNaN(daysSinceEpoch) && daysSinceEpoch >= 0
    
    if (isNaN(daysSinceEpoch) || daysSinceEpoch < 0) {
      addLog(`❌ ERRO: daysSinceEpoch inválido: ${daysSinceEpoch}`)
      return NextResponse.json(
        { 
          error: `Invalid date format: days since epoch is ${daysSinceEpoch}. Expected non-negative integer.`,
          hint: `Date provided: ${dateObj.toISOString()}, Calculated days: ${daysSinceEpoch}`,
          validationFlags,
          logs
        },
        { status: 400 }
      )
    }
    addLog(`✅ Data validada: ${dateObj.toISOString().split('T')[0]} = ${daysSinceEpoch} days since epoch (UTC)`)
    console.log(`✅ Date validated: ${dateObj.toISOString().split('T')[0]} = ${daysSinceEpoch} days since epoch (UTC)`)

    // Create contract instance with signer for write operations
    addLog(`📄 Criando instância do contrato (write): ${PRIZE_POOL_ADDRESS}`)
    const contract = new Contract(PRIZE_POOL_ADDRESS, PRIZE_POOL_ABI, walletWithProvider)
    addLog(`✅ Contrato criado com signer`)

    // Register winners using dynamic array: sends exactly min(totalPlayers, 3) valid addresses
    // NO PADDING, NO ZERO ADDRESSES, NO FIXED SIZE 3
    addLog(`📝 Preparando registro de ${winnersArray.length} vencedor(es) para date ${daysSinceEpoch} (${dateObj.toISOString().split('T')[0]})`)
    console.log(`📝 Registering ${winnersArray.length} winner(s) for date ${daysSinceEpoch} (${dateObj.toISOString().split('T')[0]}):`)
    winnersArray.forEach((addr, idx) => {
      const rank = idx === 0 ? '1st' : idx === 1 ? '2nd' : '3rd'
      addLog(`  - ${rank} place: ${addr}`)
      console.log(`  - ${rank} place: ${addr}`)
    })
    addLog(`  Total players: ${winners.totalPlayers}, Array size: ${winnersArray.length} (exactly min(${winners.totalPlayers}, 3))`)
    console.log(`  Total players: ${winners.totalPlayers}, Array size: ${winnersArray.length} (exactly min(${winners.totalPlayers}, 3))`)

    // Register winners using setDailyWinners(day, winners[], totalPlayers)
    let tx
    let methodUsed = "setDailyWinners"
    validationFlags.registrationAttempted = true
    
    try {
      addLog(`📝 Chamando setDailyWinners(${daysSinceEpoch}, [${winnersArray.join(", ")}], ${winners.totalPlayers})`)
      console.log(`📝 Registering winners: day=${daysSinceEpoch}, winners=[${winnersArray.join(", ")}], totalPlayers=${winners.totalPlayers}`)
      
      // Estimate gas
      console.log("DAY SENT TO CONTRACT:", daysSinceEpoch)
      console.log("TYPE OF DAY:", typeof daysSinceEpoch)
      addLog("⛽ Estimando gas para setDailyWinners...")
      const gasEstimate = await contract.setDailyWinners.estimateGas(daysSinceEpoch, winnersArray, winners.totalPlayers)
      addLog(`✅ Gas estimate: ${gasEstimate.toString()}`)
      validationFlags.setDailyWinnersExists = true
      validationFlags.setDailyWinnersGasEstimate = gasEstimate.toString()
      
      // Call function with gas buffer
      addLog(`📤 Chamando setDailyWinners com gasLimit=${(gasEstimate * BigInt(120) / BigInt(100)).toString()}`)
      tx = await contract.setDailyWinners(daysSinceEpoch, winnersArray, winners.totalPlayers, {
        gasLimit: gasEstimate * BigInt(120) / BigInt(100) // Add 20% buffer
      })
      
      addLog(`✅ setDailyWinners chamado com sucesso, tx.hash=${tx.hash}`)
      console.log("✅ setDailyWinners chamado com sucesso")
      validationFlags.methodUsed = "setDailyWinners"
      validationFlags.txHash = tx.hash
    } catch (error: any) {
      addLog(`❌ ERRO CRÍTICO ao registrar vencedores: ${error.message}`)
      addLog(`❌ Código do erro: ${error.code}`)
      addLog(`❌ Reason: ${error.reason || "N/A"}`)
      addLog(`❌ Stack: ${error.stack}`)
      console.error("❌ Erro ao registrar vencedores:", error)
      validationFlags.registrationFailed = true
      validationFlags.registrationError = error.message || error.toString()
      validationFlags.registrationErrorCode = error.code
      validationFlags.registrationErrorReason = error.reason
      throw error
    }
    addLog(`⏳ Aguardando confirmação da transação: ${tx.hash}`)
    let receipt
    try {
      receipt = await tx.wait()
      addLog(`✅ Transação confirmada no bloco: ${receipt.blockNumber}`)
      validationFlags.txConfirmed = true
      validationFlags.txBlockNumber = receipt.blockNumber.toString()
      validationFlags.txGasUsed = receipt.gasUsed.toString()
      validationFlags.txStatus = receipt.status
    } catch (waitError: any) {
      addLog(`❌ ERRO ao aguardar confirmação: ${waitError.message}`)
      validationFlags.txWaitFailed = true
      validationFlags.txWaitError = waitError.message || waitError.toString()
      throw waitError
    }

    if (!receipt || receipt.status !== 1) {
      addLog(`❌ ERRO: Transação falhou com status: ${receipt?.status}`)
      validationFlags.txStatus = receipt?.status
      validationFlags.txFailed = true
      return NextResponse.json(
        { error: "Transaction failed", validationFlags, logs },
        { status: 500 }
      )
    }

    console.log(`✅ Winners registered successfully!`)
    console.log(`   Transaction: ${tx.hash}`)
    console.log(`   Explorer: https://testnet.arcscan.app/tx/${tx.hash}`)

    return NextResponse.json({
      success: true,
      message: `Winners registered successfully for date ${dateObj.toISOString().split('T')[0]}`,
      transactionHash: tx.hash,
      explorerUrl: `https://testnet.arcscan.app/tx/${tx.hash}`,
      methodUsed,
              day: daysSinceEpoch, // ⚠️ Backend é a fonte da verdade do day
              date: daysSinceEpoch, // Mantido para compatibilidade
              winners: {
                first: winnersArray[0],
                second: winnersArray.length >= 2 ? winnersArray[1] : null,
                third: winnersArray.length >= 3 ? winnersArray[2] : null,
              },
              totalPlayers: winners.totalPlayers,
      arraySize: winnersArray.length,
      validationFlags,
      logs
    })
  } catch (error: any) {
    const errorLogs = logs.length > 0 ? logs : [`❌ ERRO: ${error.message || error.toString()}`]
    errorLogs.push(`❌ Stack: ${error.stack || "N/A"}`)
    
    console.error("❌ Error registering winners:", error)
    console.error("Error details:", {
      message: error?.message,
      reason: error?.reason,
      code: error?.code,
      data: error?.data,
      stack: error?.stack,
    })
    
    let errorMessage = "Unknown error"
    if (error.reason) {
      errorMessage = error.reason
    } else if (error.message) {
      errorMessage = error.message
    } else if (error.code) {
      errorMessage = `Contract error: ${error.code}`
    }

    // Provide more helpful error messages
    let hint = ""
    if (errorMessage.includes("not configured") || errorMessage.includes("PRIZE_POOL_OWNER_PRIVATE_KEY")) {
      hint = "Configure PRIZE_POOL_OWNER_PRIVATE_KEY in .env.local"
    } else if (errorMessage.includes("not the contract owner") || errorMessage.includes("owner")) {
      hint = "The wallet in PRIZE_POOL_OWNER_PRIVATE_KEY must be the contract owner"
    } else if (errorMessage.includes("Insufficient balance") || errorMessage.includes("balance")) {
      hint = "The contract may not have enough USDC to distribute prizes"
    } else if (errorMessage.includes("already registered") || errorMessage.includes("already set")) {
      hint = "Winners for this day are already registered"
    }

    return NextResponse.json(
      { 
        error: errorMessage,
        hint: hint || "Check server logs for more details",
        details: process.env.NODE_ENV === "development" ? error?.stack : undefined,
        validationFlags: validationFlags || {},
        logs: errorLogs
      },
      { status: 500 }
    )
  }
}

// GET endpoint to check if winners are registered for a date
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get("date")

    if (!dateParam) {
      return NextResponse.json(
        { error: "Missing required parameter: date (ISO string)" },
        { status: 400 }
      )
    }

    const RPC_URL = process.env.RPC_URL || "https://rpc.testnet.arc.network"
    const PRIZE_POOL_ADDRESS = process.env.PRIZE_POOL_CONTRACT_ADDRESS || "0xB98b8A9213072903277B9f592009E7C22acd2dd3"

    const provider = new JsonRpcProvider(RPC_URL)
    const contract = new Contract(PRIZE_POOL_ADDRESS, PRIZE_POOL_ABI, provider)

    const dateObj = new Date(dateParam)
    const daysSinceEpoch = getDayId(dateObj)

    const first = await contract.getWinner(daysSinceEpoch, 1)
    const second = await contract.getWinner(daysSinceEpoch, 2)
    const third = await contract.getWinner(daysSinceEpoch, 3)

    const registered = first && first !== "0x0000000000000000000000000000000000000000"

    return NextResponse.json({
      registered,
      winners: registered ? {
        first,
        second,
        third,
      } : null,
    })
  } catch (error: any) {
    console.error("Error checking winners:", error)
    return NextResponse.json(
      { error: error.message || "Unknown error" },
      { status: 500 }
    )
  }
}

