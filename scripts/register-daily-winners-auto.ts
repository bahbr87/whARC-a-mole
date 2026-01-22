import { ethers } from "ethers"

import * as dotenv from "dotenv"

import { supabaseAdmin } from "@/lib/supabase"



dotenv.config({ path: ".env.local" })



/**

 * =======================

 * CONFIG

 * =======================

 */

const RPC_URL =

  process.env.RPC_URL || "https://rpc.testnet.arc.network"



const OWNER_PRIVATE_KEY =

  process.env.PRIZE_POOL_OWNER_PRIVATE_KEY!



const PRIZE_POOL_ADDRESS =

  process.env.PRIZE_POOL_CONTRACT_ADDRESS!



if (!OWNER_PRIVATE_KEY || !PRIZE_POOL_ADDRESS) {

  console.error("❌ Variáveis de ambiente não configuradas")

  process.exit(1)

}



/**

 * ABI CORRETA — NÃO ALTERAR

 */

const PRIZE_POOL_ABI = [

  "function setDailyWinners(uint256 day, address[] winners, uint256 totalPlayers) external",

  "function totalPlayers(uint256 day) view returns (uint256)",

  "function winners(uint256 day, uint256 rank) view returns (address)",

  "function owner() view returns (address)",

]



/**

 * =======================

 * DAY ID UTC

 * =======================

 */

function getDayIdUTC(date: Date): number {

  const utc = Date.UTC(

    date.getUTCFullYear(),

    date.getUTCMonth(),

    date.getUTCDate(),

    0, 0, 0, 0

  )

  return Math.floor(utc / 86_400_000)

}



/**

 * =======================

 * BUSCAR RANKING DO DIA

 * =======================

 */

async function getDailyRanking(day: number): Promise<{

  winners: string[]

  totalPlayers: number

}> {

  const { data, error } = await supabaseAdmin

    .from("matches")

    .select("player, points, golden_moles, errors, timestamp")

    .eq("day", day)



  if (error) {

    throw new Error(`Supabase error: ${error.message}`)

  }



  if (!data || data.length === 0) {

    return { winners: [], totalPlayers: 0 }

  }



  const aggregated = new Map<string, {

    player: string

    score: number

    goldenMoles: number

    errors: number

    timestamp: number

  }>()



  for (const m of data) {

    const player = (m.player || "").toLowerCase()

    if (!player) continue



    const ts = new Date(m.timestamp).getTime()

    if (isNaN(ts)) continue



    const existing = aggregated.get(player)



    if (existing) {

      existing.score += m.points || 0

      existing.goldenMoles += m.golden_moles || 0

      existing.errors += m.errors || 0

    } else {

      aggregated.set(player, {

        player,

        score: m.points || 0,

        goldenMoles: m.golden_moles || 0,

        errors: m.errors || 0,

        timestamp: ts,

      })

    }

  }



  const sorted = [...aggregated.values()].sort((a, b) => {

    if (b.score !== a.score) return b.score - a.score

    if (b.goldenMoles !== a.goldenMoles) return b.goldenMoles - a.goldenMoles

    if (a.errors !== b.errors) return a.errors - b.errors

    return a.timestamp - b.timestamp

  })



  return {

    winners: sorted.slice(0, 3).map(r => r.player),

    totalPlayers: sorted.length,

  }

}



/**

 * =======================

 * SCRIPT PRINCIPAL

 * =======================

 */

async function main() {

  console.log("🚀 Registrando winners dos últimos 30 dias")

  console.log("⏰ Agora:", new Date().toISOString())



  const provider = new ethers.JsonRpcProvider(RPC_URL)

  const wallet = new ethers.Wallet(OWNER_PRIVATE_KEY, provider)



  const prizePool = new ethers.Contract(

    PRIZE_POOL_ADDRESS,

    PRIZE_POOL_ABI,

    wallet

  )



  const owner = await prizePool.owner()

  if (owner.toLowerCase() !== wallet.address.toLowerCase()) {

    throw new Error("❌ Wallet não é owner do contrato")

  }



  const todayDay = getDayIdUTC(new Date())

  const startDay = todayDay - 30

  const lastFinalizableDay = todayDay - 1



  for (let day = startDay; day <= lastFinalizableDay; day++) {

    console.log(`\n📌 Dia ${day}`)



    // Verificar se o dia já está finalizado

    const playersOnChain = await prizePool.totalPlayers(day)

    if (playersOnChain > 0) {

      console.log("ℹ️ Dia já finalizado, pulando")

      continue

    }



    const { winners, totalPlayers } = await getDailyRanking(day)



    if (totalPlayers === 0) {

      console.log("⚠️ Nenhum jogador neste dia, pulando")

      continue

    }



    const normalizedWinners = winners.map(w => w.toLowerCase())



    console.log("🏆 Winners:", normalizedWinners)

    console.log("👥 Total players:", totalPlayers)



    const tx = await prizePool.setDailyWinners(

      day,

      normalizedWinners,

      totalPlayers

    )



    console.log("📤 TX enviada:", tx.hash)

    await tx.wait()



    console.log(`✅ Dia ${day} finalizado`)

  }



  console.log("\n🎉 Script concluído com sucesso")

  process.exit(0)

}



main().catch(err => {

  console.error("❌ Erro fatal:", err)

  process.exit(1)

})
