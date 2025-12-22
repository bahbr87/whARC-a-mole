import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

interface RankingEntry {
  player: string;
  score: number;
  goldenMoles: number;
  errors: number;
  timestamp: number;
}

// File-based storage for persistence
const RANKINGS_FILE = path.join(process.cwd(), "data", "rankings.json");

// Load rankings from file
async function loadRankings(): Promise<RankingEntry[]> {
  try {
    await fs.mkdir(path.dirname(RANKINGS_FILE), { recursive: true });
    const data = await fs.readFile(RANKINGS_FILE, "utf-8");
    const parsed = JSON.parse(data);
    
    if (!Array.isArray(parsed)) {
      return [];
    }
    
    return parsed;
  } catch (error: any) {
    if (error.code === "ENOENT") {
      await fs.writeFile(RANKINGS_FILE, "[]", "utf-8");
      return [];
    }
    console.error("Error loading rankings:", error);
    return [];
  }
}

export async function GET() {
  try {
    // Load all rankings from file
    const allRankings = await loadRankings();

    // Use UTC for date filtering to ensure consistency across timezones
    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    const todayEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));

    // Filter rankings for today only (UTC)
    const todayRankings = allRankings.filter((entry) => {
      if (!entry || typeof entry.timestamp !== 'number') return false;
      return entry.timestamp >= todayStart.getTime() && entry.timestamp <= todayEnd.getTime();
    });

    // Aggregate scores by player (sum all games from same player)
    const rankingMap: Record<string, number> = {};
    todayRankings.forEach((entry) => {
      if (!entry || !entry.player || typeof entry.score !== 'number') return;
      const player = String(entry.player).toLowerCase();
      const points = entry.score;
      if (!isNaN(points) && isFinite(points)) {
        rankingMap[player] = (rankingMap[player] || 0) + points;
      }
    });

    const ranking = Object.entries(rankingMap)
      .map(([player, totalPoints]) => ({ player, totalPoints }))
      .sort((a, b) => b.totalPoints - a.totalPoints);

    console.log(`📊 [getDailyRanking] Returning ranking: ${ranking.length} players`);
    console.log(`   Date range: ${todayStart.toISOString()} to ${todayEnd.toISOString()}`);
    console.log(`   Total entries found: ${todayRankings.length}`);

    // Add cache headers to prevent stale data, but allow fresh fetches
    return NextResponse.json(ranking, {
      headers: {
        'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30',
      },
    });

  } catch (err: any) {
    console.error('Erro ao gerar ranking:', err);
    // Return empty array instead of error to prevent frontend crash
    return NextResponse.json([], {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache',
      },
    });
  }
}
