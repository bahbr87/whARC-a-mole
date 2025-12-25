import { supabase } from "./supabase";

export interface RankingEntry {
  player: string;
  totalPoints: number;
}

export async function getRankingForDate(dateString: string | null): Promise<RankingEntry[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Supabase not configured");
    return [];
  }

  try {
    let targetDate: Date;

    if (dateString) {
      const [year, month, day] = dateString.split("-").map(Number);
      targetDate = new Date(Date.UTC(year, month - 1, day));
    } else {
      const now = new Date();
      targetDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    }

    const dayStart = new Date(targetDate);
    dayStart.setUTCHours(0, 0, 0, 0);

    const dayEnd = new Date(targetDate);
    dayEnd.setUTCHours(23, 59, 59, 999);

    const { data, error } = await supabase
      .from("matches")
      .select("player, points, timestamp")
      .gte("timestamp", dayStart.toISOString())
      .lte("timestamp", dayEnd.toISOString());

    if (error) {
      console.error("Supabase error:", error);
      return [];
    }

    if (!data || data.length === 0) return [];

    const rankingMap: Record<string, number> = {};

    data.forEach((match) => {
      const player = match.player.toLowerCase();
      const points = match.points || 0;

      rankingMap[player] = (rankingMap[player] || 0) + points;
    });

    return Object.entries(rankingMap)
      .map(([player, totalPoints]) => ({ player, totalPoints }))
      .sort((a, b) => b.totalPoints - a.totalPoints);
  } catch (err) {
    console.error("Ranking error:", err);
    return [];
  }
}

