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
// Note: In Vercel, filesystem is read-only except /tmp
// This function will return empty array if file doesn't exist or can't be read
async function loadRankings(): Promise<RankingEntry[]> {
  try {
    // Try to read the file directly
    const data = await fs.readFile(RANKINGS_FILE, "utf-8");
    const parsed = JSON.parse(data);
    
    if (!Array.isArray(parsed)) {
      console.warn("Rankings file is not an array, returning empty array");
      return [];
    }
    
    return parsed;
  } catch (error: any) {
    // File doesn't exist or can't be read (e.g., Vercel read-only filesystem)
    if (error.code === "ENOENT") {
      console.log("📝 Rankings file doesn't exist yet (this is normal on first run or in Vercel)");
      return [];
    }
    // Any other error (permissions, etc.) - return empty array
    console.warn("⚠️ Cannot read rankings file:", error.message);
    return [];
  }
}

export async function GET() {
  try {
    // Load all rankings from file (always fresh read, no cache)
    const allRankings = await loadRankings();
    
    // If no rankings loaded (file doesn't exist or is empty), return empty array
    if (!Array.isArray(allRankings) || allRankings.length === 0) {
      console.log(`📊 [getDailyRanking] No rankings found in file, returning empty array`);
      return NextResponse.json([], {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    }
    
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
    console.error('   Error details:', err.message);
    // Return empty array instead of error to prevent frontend crash
    // This is safe because the frontend handles empty arrays gracefully
    return NextResponse.json([], {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  }
}
