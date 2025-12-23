import { promises as fs } from 'fs';
import fsSync from 'fs';
import path from 'path';

export interface MatchEntry {
  player: string;
  points: number;
  timestamp: string; // ISO string from saveMatch
}

// File path for matches storage
const MATCHES_FILE = path.join(process.cwd(), "data", "matches.json");

// In-memory cache for matches (shared across endpoints)
let matchesCache: MatchEntry[] = [];
let matchesLoaded = false;

// Load matches from file
async function loadMatches(): Promise<MatchEntry[]> {
  try {
    const data = await fs.readFile(MATCHES_FILE, "utf-8");
    const parsed = JSON.parse(data);
    
    if (!Array.isArray(parsed)) {
      return [];
    }
    
    return parsed;
  } catch (error: any) {
    // File doesn't exist - return empty array (normal on first run or in Vercel)
    if (error.code === "ENOENT") {
      return [];
    }
    return [];
  }
}

// Load matches synchronously (for use with saveMatch)
function loadMatchesSync(): MatchEntry[] {
  try {
    if (!fsSync.existsSync(MATCHES_FILE)) {
      return [];
    }
    const data = fsSync.readFileSync(MATCHES_FILE, "utf-8");
    if (!data.trim()) {
      return [];
    }
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed;
  } catch (error: any) {
    return [];
  }
}

// Ensure matches are loaded
export async function ensureMatchesLoaded(): Promise<void> {
  if (!matchesLoaded) {
    matchesCache = await loadMatches();
    matchesLoaded = true;
  }
}

// Refresh cache from file (call after saveMatch)
export function refreshMatchesCache(): void {
  matchesCache = loadMatchesSync();
  matchesLoaded = true;
}

// Get matches from cache
export function getMatchesFromCache(): MatchEntry[] {
  // Always refresh from file to get latest data
  refreshMatchesCache();
  return matchesCache;
}

// Get daily ranking from matches
export async function getDailyRanking(): Promise<Array<{ player: string; totalPoints: number }>> {
  // Refresh cache to get latest matches
  refreshMatchesCache();
  const matches = getMatchesFromCache();
  
  // Use UTC for date filtering
  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  const todayEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
  
  const todayStartTime = todayStart.getTime();
  const todayEndTime = todayEnd.getTime();
  
  // Filter matches for today only (UTC)
  // Convert ISO timestamp string to number for comparison
  const todayMatches = matches.filter((match) => {
    const matchTimestamp = new Date(match.timestamp).getTime();
    return matchTimestamp >= todayStartTime && matchTimestamp <= todayEndTime;
  });
  
  // Aggregate points by player
  const rankingMap: Record<string, number> = {};
  todayMatches.forEach((match) => {
    const player = match.player.toLowerCase();
    const points = match.points;
    if (!isNaN(points) && isFinite(points)) {
      rankingMap[player] = (rankingMap[player] || 0) + points;
    }
  });
  
  // Convert to array and sort
  const ranking = Object.entries(rankingMap)
    .map(([player, totalPoints]) => ({ player, totalPoints }))
    .sort((a, b) => b.totalPoints - a.totalPoints);
  
  return ranking;
}

