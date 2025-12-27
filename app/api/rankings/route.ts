import { NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import { getDayId } from "@/utils/day"
import { ensureRankingsLoaded, getRankingsFromCache, addRankingToCache, replaceRankingsCache, type RankingEntry } from "@/lib/rankings-cache"
import { supabaseAdmin } from "@/lib/supabase"
import { getContractInstance } from "@/lib/contract"

// File-based storage for persistence
const RANKINGS_FILE = path.join(process.cwd(), "data", "rankings.json")

// Save rankings to file
// Note: In Vercel, filesystem is read-only except /tmp
// This function will fail silently in read-only environments
async function saveRankings(rankings: RankingEntry[]): Promise<void> {
  try {
    await fs.writeFile(RANKINGS_FILE, JSON.stringify(rankings, null, 2), "utf-8")
  } catch (error: any) {
    // In Vercel, filesystem is read-only, so this will fail
    // Log warning but don't throw - allow the request to succeed
    if (error.code === "EACCES" || error.code === "EROFS" || error.code === "ENOENT") {
      console.warn("⚠️ Cannot save rankings file (read-only filesystem in Vercel):", error.message)
      // Don't throw - allow request to succeed even if file can't be written
      return
    }
    console.error("Error saving rankings:", error)
    // Only throw for unexpected errors
    throw error
  }
}

// GET /api/rankings - Get ranking for a day
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const dayParam = url.searchParams.get('day')
    
    if (!dayParam) return NextResponse.json({ error: "Missing day parameter" }, { status: 400 })

    const day = parseInt(dayParam, 10)
    if (isNaN(day)) return NextResponse.json({ error: "Invalid day parameter" }, { status: 400 })

    const { data, error } = await supabaseAdmin
      .from("matches")
      .select("player, points, golden_moles, errors")
      .eq("day", day)
      .order("points", { ascending: false })
      .order("golden_moles", { ascending: false })
      .order("errors", { ascending: true })

    if (error) return NextResponse.json({ error: "Database error" }, { status: 500 })
    return NextResponse.json({ ranking: data || [] }, { status: 200 })

  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 })
  }
}

// POST /api/rankings - Add a new ranking entry OR claim prize
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { player, score, goldenMoles, errors, timestamp, day, rank } = body

    // Se receber day, rank e player sem score, é um claim
    if (day !== undefined && rank !== undefined && player && score === undefined) {
      // Processar como claim
      // 1️⃣ Verifica top 3 do dia
      const { data: topPlayers, error } = await supabaseAdmin
        .from("matches")
        .select("player, points, golden_moles, errors")
        .eq("day", day)
        .order("points", { ascending: false })
        .order("golden_moles", { ascending: false })
        .order("errors", { ascending: true })
        .limit(3)

      if (error) {
        console.error("[RANKINGS] Error fetching top players:", error)
        return NextResponse.json({ error: "Database error" }, { status: 500 })
      }

      if (!topPlayers || topPlayers.length === 0) {
        return NextResponse.json({ error: "No matches found for this day" }, { status: 404 })
      }

      const winner = topPlayers[rank - 1]?.player?.toLowerCase()
      if (!winner || winner !== player.toLowerCase()) {
        return NextResponse.json({ error: "Not authorized" }, { status: 403 })
      }

      // 2️⃣ Verifica se já foi reivindicado
      const { data: claimedData, error: claimedError } = await supabaseAdmin
        .from("prizes_claimed")
        .select("*")
        .eq("day", day)
        .eq("rank", rank)
        .eq("player", player.toLowerCase())

      if (claimedError) {
        console.error("[RANKINGS] Error checking claims:", claimedError)
        return NextResponse.json({ error: "Database error" }, { status: 500 })
      }

      if (claimedData && claimedData.length > 0) {
        return NextResponse.json({ error: "Prize already claimed" }, { status: 400 })
      }

      // 3️⃣ Registra claim no Supabase
      const { error: insertError } = await supabaseAdmin.from("prizes_claimed").insert({
        day,
        rank,
        player: player.toLowerCase(),
        claimed: true,
        claimed_at: new Date().toISOString()
      })

      if (insertError) {
        console.error("[RANKINGS] Error inserting claim:", insertError)
        return NextResponse.json({ error: "Failed to register claim" }, { status: 500 })
      }

      // 4️⃣ (Opcional) Registra no contrato
      try {
        const contract = getContractInstance()
        if (contract) {
          await contract.claimPrize(day, rank, player)
        }
      } catch (contractErr) {
        console.error("[RANKINGS] Contract call failed:", contractErr)
        // Não falha o request se o contrato falhar - o claim já foi registrado no Supabase
      }

      return NextResponse.json({ success: true }, { status: 200 })
    }

    // Caso contrário, processar como ranking normal
    await ensureRankingsLoaded()

    if (!player || score === undefined || goldenMoles === undefined || errors === undefined || !timestamp) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Calculate day using getDayId if not provided
    const calculatedDay = day !== undefined ? day : getDayId(new Date(timestamp))

    const newEntry: RankingEntry = {
      player,
      score,
      goldenMoles,
      errors,
      timestamp,
    }

    // Ensure we have latest data before adding
    await ensureRankingsLoaded()
    const rankingsStorage = getRankingsFromCache()
    
    // Add to shared cache (this makes it immediately available in /api/getDailyRanking)
    addRankingToCache(newEntry)
    
    // Note: Match is saved to Supabase via /api/saveMatch (called from frontend)
    
    // Try to save to file (will fail silently in Vercel, but that's OK - we have in-memory cache)
    const updatedRankings = getRankingsFromCache()
    await saveRankings(updatedRankings)
    
    const finalRankings = getRankingsFromCache()
    console.log(`✅ Saved ranking: Player ${player.substring(0, 10)}... Score: ${score} Day: ${calculatedDay} Timestamp: ${new Date(timestamp).toISOString()}`)
    console.log(`   Total rankings in storage: ${finalRankings.length}`)

    return NextResponse.json({ success: true, entry: newEntry, day: calculatedDay }, { status: 201 })
  } catch (error) {
    console.error("Error saving ranking:", error)
    return NextResponse.json({ error: "Failed to save ranking" }, { status: 500 })
  }
}

// DELETE /api/rankings - Clear old rankings (for day reset)
export async function DELETE(request: NextRequest) {
  try {
    await ensureRankingsLoaded()
    let rankingsStorage = getRankingsFromCache()
    
    const searchParams = request.nextUrl.searchParams
    const beforeTimestamp = searchParams.get("beforeTimestamp")
    const clearAll = searchParams.get("clearAll") === "true"

    if (clearAll) {
      // Clear all rankings (for testing/cleanup)
      replaceRankingsCache([])
      await saveRankings([])
      return NextResponse.json({ success: true, message: "All rankings cleared", count: 0 })
    }

    if (beforeTimestamp) {
      const before = parseInt(beforeTimestamp)
      const filtered = rankingsStorage.filter((entry) => entry.timestamp >= before)
      replaceRankingsCache(filtered)
      await saveRankings(filtered)
      return NextResponse.json({ success: true, count: filtered.length })
    } else {
      replaceRankingsCache([])
      await saveRankings([])
      return NextResponse.json({ success: true, count: 0 })
    }
  } catch (error) {
    console.error("Error clearing rankings:", error)
    return NextResponse.json({ error: "Failed to clear rankings" }, { status: 500 })
  }
}

