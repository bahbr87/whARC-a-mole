import { RankingEntry } from "@/app/page"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api"

export async function getRankings(startDate?: number, endDate?: number): Promise<RankingEntry[]> {
  try {
    // ⚠️ NOTE: The /api/rankings endpoint now requires a 'day' parameter
    // This function is kept for backward compatibility but returns empty array
    // Use /api/rankings?day=<dayId> directly instead
    console.warn("[API] getRankings() is deprecated. Use /api/rankings?day=<dayId> directly.")
    return []
  } catch (error) {
    console.error("Error fetching rankings:", error)
    // Fallback to empty array on error
    return []
  }
}

export async function saveRanking(entry: RankingEntry): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/rankings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(entry),
    })

    if (!response.ok) {
      throw new Error("Failed to save ranking")
    }

    return true
  } catch (error) {
    console.error("Error saving ranking:", error)
    return false
  }
}

export async function clearOldRankings(beforeTimestamp: number): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/rankings?beforeTimestamp=${beforeTimestamp}`, {
      method: "DELETE",
    })

    if (!response.ok) {
      throw new Error("Failed to clear rankings")
    }

    return true
  } catch (error) {
    console.error("Error clearing rankings:", error)
    return false
  }
}







