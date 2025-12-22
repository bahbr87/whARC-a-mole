import { NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import { registerDailyWinners } from "@/lib/register-daily-winners"
// Note: getDayId is available but we use day from URL directly, not recalculating

export interface RankingEntry {
  player: string
  score: number
  goldenMoles: number
  errors: number
  timestamp: number
}

// File-based storage for persistence
const RANKINGS_FILE = path.join(process.cwd(), "data", "rankings.json")

// Load rankings from file
async function loadRankings(): Promise<RankingEntry[]> {
  try {
    await fs.mkdir(path.dirname(RANKINGS_FILE), { recursive: true })
    const data = await fs.readFile(RANKINGS_FILE, "utf-8")
    const parsed = JSON.parse(data)
    
    if (!Array.isArray(parsed)) {
      return []
    }
    
    return parsed
  } catch (error: any) {
    if (error.code === "ENOENT") {
      return []
    }
    console.error("Error loading rankings:", error)
    return []
  }
}

// GET /api/daily-results?day=XXXX - Get ranking for a specific day
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const dayParam = searchParams.get("day")
    
    if (!dayParam) {
      return NextResponse.json(
        { error: "day parameter is required" },
        { status: 400 }
      )
    }
    
    const day = parseInt(dayParam)
    if (isNaN(day)) {
      return NextResponse.json(
        { error: "day must be a valid number" },
        { status: 400 }
      )
    }
    
    // Use day from URL directly - convert to timestamp range for filtering
    // day is days since epoch, convert to timestamp: day * 86400000
    const dayStartTimestamp = day * 86400000
    const dayEndTimestamp = dayStartTimestamp + 86400000 - 1 // End of day (23:59:59.999)
    
    // Load rankings from file
    const allRankings = await loadRankings()
    
    // Filter rankings for this specific day
    const dayRankings = allRankings
      .filter((entry) => entry.timestamp >= dayStartTimestamp && entry.timestamp <= dayEndTimestamp)
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
    
    // Return ranking in the format: { address, score }
    const ranking = sorted.map((entry) => ({
      address: entry.player,
      score: entry.score,
      goldenMoles: entry.goldenMoles,
      errors: entry.errors,
    }))
    
    // ✅ AUTOMATIC REGISTRATION: Register winners automatically if not already registered
    let winnersRegistered = false
    try {
      if (sorted.length > 0) {
        console.log(`🔄 [AUTO-REGISTER] Attempting to register winners for day ${day}...`)
        const result = await registerDailyWinners(day)
        
        if (result.success) {
          winnersRegistered = true
          if (result.alreadyRegistered) {
            console.log(`✅ [AUTO-REGISTER] Day ${day} already registered`)
          } else {
            console.log(`✅ [AUTO-REGISTER] Winners registered for day ${day}:`, result.winners)
          }
        } else {
          console.error(`❌ [AUTO-REGISTER] Failed to register winners for day ${day}:`, result.error)
          // Continue anyway - return ranking even if registration fails
        }
      }
    } catch (error: any) {
      console.error(`⚠️ [AUTO-REGISTER] Error registering winners for day ${day}:`, error.message)
      // Continue anyway - return ranking even if registration fails
    }
    
    return NextResponse.json({
      day,
      ranking,
      winnersRegistered,
    })
  } catch (error) {
    console.error("Error fetching daily results:", error)
    return NextResponse.json(
      { error: "Failed to fetch daily results" },
      { status: 500 }
    )
  }
}

