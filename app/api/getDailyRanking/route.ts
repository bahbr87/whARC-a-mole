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
// Use same path as /api/rankings to ensure consistency
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
    // Load all rankings from file (always fresh read, no cache)
    const allRankings = await loadRankings();
    
    console.log(`📊 [getDailyRanking] Loaded ${allRankings.length} total rankings from file`);

    // Use UTC for date filtering to ensure consistency across timezones
    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    const todayEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
    
    const todayStartTime = todayStart.getTime();
    const todayEndTime = todayEnd.getTime();
    
    console.log(`📊 [getDailyRanking] Filtering for today (UTC):`);
    console.log(`   Start: ${todayStart.toISOString()} (${todayStartTime})`);
    console.log(`   End: ${todayEnd.toISOString()} (${todayEndTime})`);
    console.log(`   Current time: ${now.toISOString()} (${now.getTime()})`);

    // Filter rankings for today only (UTC)
    const todayRankings = allRankings.filter((entry) => {
      if (!entry || typeof entry.timestamp !== 'number') {
        return false;
      }
      return entry.timestamp >= todayStartTime && entry.timestamp <= todayEndTime;
    });

    console.log(`📊 [getDailyRanking] Found ${todayRankings.length} entries for today out of ${allRankings.length} total`);

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

    console.log(`📊 [getDailyRanking] Final ranking: ${ranking.length} players`);
    console.log(`   Date range: ${todayStart.toISOString()} to ${todayEnd.toISOString()}`);
    console.log(`   Total entries found: ${todayRankings.length}`);
    if (ranking.length > 0) {
      console.log(`   Top player: ${ranking[0].player.substring(0, 10)}... with ${ranking[0].totalPoints} points`);
    }

    // Add cache headers to prevent stale data, but allow fresh fetches
    return NextResponse.json(ranking, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });

  } catch (err: any) {
    console.error('❌ [getDailyRanking] Erro ao gerar ranking:', err);
    console.error('   Error details:', err.message, err.stack);
    // Return empty array instead of error to prevent frontend crash
    return NextResponse.json([], {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache',
      },
    });
  }
}
