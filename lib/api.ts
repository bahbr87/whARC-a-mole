import { RankingEntry } from "@/app/page"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api"

export async function getRankings(startDate?: number, endDate?: number): Promise<RankingEntry[]> {
  try {
    const params = new URLSearchParams()
    if (startDate) params.append("startDate", startDate.toString())
    if (endDate) params.append("endDate", endDate.toString())

    const url = `${API_BASE_URL}/rankings${params.toString() ? `?${params.toString()}` : ""}`
    const response = await fetch(url)

    if (!response.ok) {
      throw new Error("Failed to fetch rankings")
    }

    const data = await response.json()
    return data.rankings || []
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







