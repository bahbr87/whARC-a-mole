/**
 * Utility functions for day calculations and results checking
 */

import { getDayId } from "@/utils/day"

/**
 * Get today's day ID (days since epoch UTC)
 */
export function getTodayDayId(): number {
  return getDayId(new Date())
}

/**
 * Check if results are available for a specific day
 * @param dayId - Day ID to check
 * @returns Promise<boolean> - true if results are available
 */
export async function checkResultsAvailable(dayId: number): Promise<boolean> {
  try {
    // Check if there are any rankings for this day
    const response = await fetch(`/api/daily-results?day=${dayId}`)
    
    if (!response.ok) {
      return false
    }
    
    const data = await response.json()
    
    // Results are available if there's at least one player in the ranking
    return data.ranking && Array.isArray(data.ranking) && data.ranking.length > 0
  } catch (error) {
    console.error("Error checking results availability:", error)
    return false
  }
}


