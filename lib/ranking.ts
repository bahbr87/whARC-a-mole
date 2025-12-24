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
    console.error('❌ [RANKING] Supabase not configured')
    return []
  }

  try {
    // Parse target date (default to today if not provided)
    let targetDate: Date
    
    if (dateString) {
      // Parse YYYY-MM-DD format
      const [year, month, day] = dateString.split('-').map(Number)
      if (isNaN(year) || isNaN(month) || isNaN(day)) {
        console.error('❌ [RANKING] Invalid date format. Expected YYYY-MM-DD, got:', dateString)
        return []
      }
      targetDate = new Date(Date.UTC(year, month - 1, day))
      console.log(`📅 [RANKING] Requested date: ${dateString} (parsed as UTC: ${targetDate.toISOString()})`)
    } else {
      // Default to today in UTC
      const now = new Date()
      targetDate = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate()
      ))
      console.log(`📅 [RANKING] No date provided, using today (UTC): ${targetDate.toISOString()}`)
    }

    // Calculate start and end of target day in UTC
    const dayStart = new Date(targetDate)
    dayStart.setUTCHours(0, 0, 0, 0)
    
    const dayEnd = new Date(targetDate)
    dayEnd.setUTCHours(23, 59, 59, 999)

    const dayStartISO = dayStart.toISOString()
    const dayEndISO = dayEnd.toISOString()
    
    console.log(`🔍 [RANKING] Query interval (UTC):`)
    console.log(`   Start: ${dayStartISO}`)
    console.log(`   End:   ${dayEndISO}`)

    // Try both column names - Supabase might use created_at (default) or timestamp (custom)
    // First try created_at (Supabase default)
    let data: any[] | null = null
    let error: any = null
    let columnUsed = 'created_at'
    
    const { data: dataCreatedAt, error: errorCreatedAt } = await supabase
      .from('matches')
      .select('player, points, created_at, timestamp')
      .gte('created_at', dayStartISO)
      .lte('created_at', dayEndISO)

    if (errorCreatedAt) {
      console.log(`⚠️ [RANKING] Query with created_at failed, trying timestamp column...`)
      console.log(`   Error: ${errorCreatedAt.message}`)
      
      // Try timestamp column
      const { data: dataTimestamp, error: errorTimestamp } = await supabase
        .from('matches')
        .select('player, points, created_at, timestamp')
        .gte('timestamp', dayStartISO)
        .lte('timestamp', dayEndISO)
      
      if (errorTimestamp) {
        console.error(`❌ [RANKING] Both column queries failed:`)
        console.error(`   created_at error: ${errorCreatedAt.message}`)
        console.error(`   timestamp error: ${errorTimestamp.message}`)
        error = errorTimestamp
      } else {
        data = dataTimestamp
        columnUsed = 'timestamp'
        console.log(`✅ [RANKING] Using 'timestamp' column (created_at failed)`)
      }
    } else {
      data = dataCreatedAt
      columnUsed = 'created_at'
      console.log(`✅ [RANKING] Using 'created_at' column`)
    }

    if (error) {
      console.error('❌ [RANKING] Error fetching matches from Supabase:', error)
      return []
    }

    console.log(`📊 [RANKING] Records returned: ${data?.length || 0}`)
    
    if (!data || data.length === 0) {
      console.log(`⚠️ [RANKING] No matches found for date ${dateString || 'today'}`)
      // Try to get some sample data to debug
      // Try ordering by created_at first, if that fails try timestamp
      let sampleData: any[] | null = null
      const { data: sampleCreatedAt } = await supabase
        .from('matches')
        .select('player, points, created_at, timestamp')
        .limit(5)
        .order('created_at', { ascending: false })
        .catch(() => null)
      
      if (sampleCreatedAt) {
        sampleData = sampleCreatedAt
      } else {
        // Try timestamp column
        const { data: sampleTimestamp } = await supabase
          .from('matches')
          .select('player, points, created_at, timestamp')
          .limit(5)
          .order('timestamp', { ascending: false })
          .catch(() => null)
        
        if (sampleTimestamp) {
          sampleData = sampleTimestamp
        }
      }
      
      if (sampleData && sampleData.length > 0) {
        console.log(`🔍 [RANKING] Sample records from database (latest 5):`)
        sampleData.forEach((match, idx) => {
          console.log(`   [${idx + 1}] player: ${match.player}, points: ${match.points}`)
          console.log(`       created_at: ${match.created_at || 'null'}`)
          console.log(`       timestamp: ${match.timestamp || 'null'}`)
        })
      } else {
        console.log(`⚠️ [RANKING] Could not fetch sample data - database might be empty or connection failed`)
      }
      return []
    }

    // Log first few records for debugging
    console.log(`📋 [RANKING] First 3 records returned:`)
    data.slice(0, 3).forEach((match, idx) => {
      console.log(`   [${idx + 1}] player: ${match.player}, points: ${match.points}`)
      if (match.created_at) console.log(`       created_at: ${match.created_at}`)
      if (match.timestamp) console.log(`       timestamp: ${match.timestamp}`)
    })

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

