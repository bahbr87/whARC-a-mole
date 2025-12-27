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

    // day → dias desde epoch
    const dayStart = new Date(day * 86400000)
    const dayEnd = new Date(dayStart.getTime() + 86400000 - 1)

    console.log("📅 Filtering from:", dayStart, "to:", dayEnd)

    const { data, error } = await supabase
      .from("matches")
      .select("*")
      .gte("timestamp", dayStart.toISOString())
      .lte("timestamp", dayEnd.toISOString())

    if (error) {
      console.error("Supabase error:", error)
      return NextResponse.json({ error: "DB error" }, { status: 500 })
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ day, ranking: [] })
    }

    // aggregate player totals
    const players = new Map<
      string,
      { player: string; score: number }
    >()

    for (const row of data) {
      const addr = row.player.toLowerCase()
      if (!players.has(addr)) {
        players.set(addr, { player: addr, score: 0 })
      }

      players.get(addr)!.score += row.points
    }

    const ranking = Array.from(players.values()).sort(
      (a, b) => b.score - a.score
    )

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

