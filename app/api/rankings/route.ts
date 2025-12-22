import { NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import { getDayId } from "@/utils/day"

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
    
    // Validate that it's an array
    if (!Array.isArray(parsed)) {
      console.warn("⚠️  Rankings file is not an array, resetting to empty array")
      await fs.writeFile(RANKINGS_FILE, "[]", "utf-8")
      return []
    }
    
    return parsed
  } catch (error: any) {
    // File doesn't exist or is invalid, return empty array
    if (error.code === "ENOENT") {
      console.log("📝 Rankings file doesn't exist yet, starting with empty array")
      // Create empty file
      await fs.writeFile(RANKINGS_FILE, "[]", "utf-8")
      return []
    }
    console.error("❌ Error loading rankings:", error)
    // If file is corrupted, try to backup and reset
    try {
      const backupPath = `${RANKINGS_FILE}.backup.${Date.now()}`
      await fs.copyFile(RANKINGS_FILE, backupPath)
      console.log(`💾 Backed up corrupted file to ${backupPath}`)
      await fs.writeFile(RANKINGS_FILE, "[]", "utf-8")
    } catch (backupError) {
      console.error("Failed to backup corrupted file:", backupError)
    }
    return []
  }
}

// Save rankings to file
async function saveRankings(rankings: RankingEntry[]): Promise<void> {
  try {
    await fs.mkdir(path.dirname(RANKINGS_FILE), { recursive: true })
    await fs.writeFile(RANKINGS_FILE, JSON.stringify(rankings, null, 2), "utf-8")
  } catch (error) {
    console.error("Error saving rankings:", error)
    throw error
  }
}

// Cache rankings in memory for performance, but persist to file
// IMPORTANT: Always reload from file on each request to handle server restarts
let rankingsStorage: RankingEntry[] = []
let rankingsLoaded = false
let lastLoadTime = 0
const RELOAD_INTERVAL = 5000 // Reload from file every 5 seconds to handle external changes

// Initialize rankings on first access
async function ensureRankingsLoaded() {
  const now = Date.now()
  // Reload from file if never loaded, or if it's been more than RELOAD_INTERVAL since last load
  // This ensures we don't lose data if server restarts
  if (!rankingsLoaded || (now - lastLoadTime) > RELOAD_INTERVAL) {
    rankingsStorage = await loadRankings()
    rankingsLoaded = true
    lastLoadTime = now
    console.log(`📊 Loaded ${rankingsStorage.length} rankings from file`)
  }
}

// GET /api/rankings - Get rankings for a specific date range
export async function GET(request: NextRequest) {
  try {
    await ensureRankingsLoaded()
    
    const searchParams = request.nextUrl.searchParams
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")

    let filteredRankings = [...rankingsStorage]

    if (startDate && endDate) {
      const start = parseInt(startDate)
      const end = parseInt(endDate)
      filteredRankings = rankingsStorage.filter(
        (entry) => entry.timestamp >= start && entry.timestamp <= end
      )
    }

    return NextResponse.json({ rankings: filteredRankings })
  } catch (error) {
    console.error("Error fetching rankings:", error)
    return NextResponse.json({ error: "Failed to fetch rankings" }, { status: 500 })
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
    
    rankingsStorage.push(newEntry)
    await saveRankings(rankingsStorage)
    
    console.log(`✅ Saved ranking: Player ${player.substring(0, 10)}... Score: ${score} Day: ${calculatedDay} Timestamp: ${new Date(timestamp).toISOString()}`)
    console.log(`   Total rankings in storage: ${rankingsStorage.length}`)

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
    
    const searchParams = request.nextUrl.searchParams
    const beforeTimestamp = searchParams.get("beforeTimestamp")
    const clearAll = searchParams.get("clearAll") === "true"

    if (clearAll) {
      // Clear all rankings (for testing/cleanup)
      rankingsStorage = []
      await saveRankings(rankingsStorage)
      return NextResponse.json({ success: true, message: "All rankings cleared", count: 0 })
    }

    if (beforeTimestamp) {
      const before = parseInt(beforeTimestamp)
      rankingsStorage = rankingsStorage.filter((entry) => entry.timestamp >= before)
    } else {
      rankingsStorage = []
    }

    await saveRankings(rankingsStorage)
    return NextResponse.json({ success: true, count: rankingsStorage.length })
  } catch (error) {
    console.error("Error clearing rankings:", error)
    return NextResponse.json({ error: "Failed to clear rankings" }, { status: 500 })
  }
}

