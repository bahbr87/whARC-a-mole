/**
 * Reusable ranking logic using Supabase
 * Handles daily rankings calculation from matches table
 * 
 * NO filesystem access - works on Vercel
 */

import { supabase } from './supabase'

export interface RankingEntry {
  player: string
  totalPoints: number
}

/**
 * Get ranking for a specific date
 * @param dateString - Date in format "YYYY-MM-DD" (UTC) or null for today
 * @returns Promise<RankingEntry[]> - Array of players with total points, sorted descending
 */
export async function getRankingForDate(dateString: string | null): Promise<RankingEntry[]> {
  // Validate Supabase configuration
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Supabase not configured')
    return []
  }

  try {
    // Parse target date (default to today if not provided)
    let targetDate: Date
    
    if (dateString) {
      // Parse YYYY-MM-DD format
      const [year, month, day] = dateString.split('-').map(Number)
      if (isNaN(year) || isNaN(month) || isNaN(day)) {
        console.error('Invalid date format. Expected YYYY-MM-DD')
        return []
      }
      targetDate = new Date(Date.UTC(year, month - 1, day))
    } else {
      // Default to today in UTC
      const now = new Date()
      targetDate = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate()
      ))
    }

    // Calculate start and end of target day in UTC
    const dayStart = new Date(targetDate)
    dayStart.setUTCHours(0, 0, 0, 0)
    
    const dayEnd = new Date(targetDate)
    dayEnd.setUTCHours(23, 59, 59, 999)

    // Query Supabase matches table using timestamp column
    // The database column is named 'timestamp', not 'created_at'
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
    // Always lowercase wallet address when grouping
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
    console.error('Error in getRankingForDate:', error)
    return []
  }
}

