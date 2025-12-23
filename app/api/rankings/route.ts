import { NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import { getDayId } from "@/utils/day"
import { ensureRankingsLoaded, getRankingsFromCache, addRankingToCache, replaceRankingsCache, type RankingEntry } from "@/lib/rankings-cache"
import { supabase } from "@/lib/supabase"

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

// GET /api/rankings - Get daily ranking from Supabase
export async function GET() {
  try {
    // Validate Supabase configuration at runtime
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const { data, error } = await supabase
      .from('matches')
      .select('player, points, timestamp')
      .gte('timestamp', todayStart.toISOString())
      .lte('timestamp', todayEnd.toISOString());

    if (error) throw error;

    const rankingMap: Record<string, number> = {};
    data?.forEach(match => {
      const player = match.player.toLowerCase();
      rankingMap[player] = (rankingMap[player] || 0) + match.points;
    });

    const ranking = Object.entries(rankingMap)
      .map(([player, totalPoints]) => ({ player, totalPoints }))
      .sort((a, b) => b.totalPoints - a.totalPoints);

    return NextResponse.json(ranking);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Erro ao gerar ranking' }, { status: 500 });
  }
}

// POST /api/rankings - Add a new ranking entry
export async function POST(request: NextRequest) {
  try {
    await ensureRankingsLoaded()
    
    const body = await request.json()
    const { player, score, goldenMoles, errors, timestamp, day } = body

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

