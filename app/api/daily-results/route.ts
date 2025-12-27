import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

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

    const { data, error } = await supabase
      .from("matches")
      .select("player, points, golden_moles, errors, timestamp")
      .gte("timestamp", new Date(day * 86400000).toISOString())
      .lte("timestamp", new Date((day + 1) * 86400000 - 1).toISOString())
      .order("points", { ascending: false })
      .order("golden_moles", { ascending: false })
      .order("errors", { ascending: true })

    if (error) {
      console.error("Supabase error:", error)
      return NextResponse.json({ error: "DB error" }, { status: 500 })
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ day, ranking: [] })
    }

    // Aggregate player totals with golden_moles and errors
    const players = new Map<
      string,
      { player: string; score: number; goldenMoles: number; errors: number }
    >()

    for (const row of data) {
      const addr = row.player.toLowerCase()
      if (!players.has(addr)) {
        players.set(addr, { player: addr, score: 0, goldenMoles: 0, errors: 0 })
      }

      const playerData = players.get(addr)!
      playerData.score += row.points || 0
      playerData.goldenMoles += row.golden_moles || 0
      playerData.errors += row.errors || 0
    }

    // Sort by score (desc), then golden_moles (desc), then errors (asc)
    const ranking = Array.from(players.values()).sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      if (b.goldenMoles !== a.goldenMoles) return b.goldenMoles - a.goldenMoles
      return a.errors - b.errors
    }).map(row => ({
      address: row.player,
      score: row.score,
      goldenMoles: row.goldenMoles,
      errors: row.errors
    }))

    return NextResponse.json({
      day,
      ranking,
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json(
      { error: "Failed to fetch daily results" },
      { status: 500 }
    )
  }
}

