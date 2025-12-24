/**
 * Reusable ranking logic using Supabase
 * Handles daily rankings calculation from matches table
 */

import { supabase } from './supabase'

export interface RankingEntry {
  player: string
  totalPoints: number
}

/**
 * Get ranking for a specific day
 * @param day - "today" or "yesterday" (calculated in UTC)
 * @returns Promise<RankingEntry[]> - Array of players with total points, sorted descending
 */
export async function getRankingForDay(day: "today" | "yesterday"): Promise<RankingEntry[]> {
  // Validate Supabase configuration
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Supabase not configured')
    return []
  }

  try {
    // Calculate target date in UTC
    const now = new Date()
    let targetDate: Date

    if (day === "today") {
      // Today in UTC
      targetDate = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate()
      ))
    } else {
      // Yesterday in UTC
      targetDate = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() - 1
      ))
    }

    // Calculate start and end of target day in UTC
    const dayStart = new Date(targetDate)
    dayStart.setUTCHours(0, 0, 0, 0)
    
    const dayEnd = new Date(targetDate)
    dayEnd.setUTCHours(23, 59, 59, 999)

    // Query Supabase matches table
    const { data, error } = await supabase
      .from('matches')
      .select('player, points, timestamp')
      .gte('timestamp', dayStart.toISOString())
      .lte('timestamp', dayEnd.toISOString())

    if (error) {
      console.error('Error fetching matches from Supabase:', error)
      return []
    }

    if (!data || data.length === 0) {
      return []
    }

    // Aggregate points by player (case-insensitive)
    const rankingMap: Record<string, number> = {}
    
    data.forEach((match) => {
      const player = match.player.toLowerCase()
      const points = match.points || 0
      
      if (typeof points === 'number' && !isNaN(points) && isFinite(points)) {
        rankingMap[player] = (rankingMap[player] || 0) + points
      }
    })

    // Convert to array and sort by total points (descending)
    const ranking: RankingEntry[] = Object.entries(rankingMap)
      .map(([player, totalPoints]) => ({
        player,
        totalPoints,
      }))
      .sort((a, b) => b.totalPoints - a.totalPoints)

    return ranking
  } catch (error) {
    console.error('Error in getRankingForDay:', error)
    return []
  }
}

