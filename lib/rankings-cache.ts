import { promises as fs } from 'fs';
import path from 'path';

export interface RankingEntry {
  player: string;
  score: number;
  goldenMoles: number;
  errors: number;
  timestamp: number;
}

// File-based storage for persistence
const RANKINGS_FILE = path.join(process.cwd(), "data", "rankings.json");

// SHARED IN-MEMORY CACHE for all ranking endpoints
// This ensures rankings saved via POST /api/rankings are immediately available in GET /api/getDailyRanking
// In Vercel, filesystem is read-only, so we rely on in-memory cache
let rankingsStorage: RankingEntry[] = [];
let rankingsLoaded = false;
let lastLoadTime = 0;
const RELOAD_INTERVAL = 5000; // Reload from file every 5 seconds

// Load rankings from file
async function loadRankings(): Promise<RankingEntry[]> {
  try {
    const data = await fs.readFile(RANKINGS_FILE, "utf-8");
    const parsed = JSON.parse(data);
    
    if (!Array.isArray(parsed)) {
      return [];
    }
    
    return parsed;
  } catch (error: any) {
    // File doesn't exist - return empty array (normal in Vercel)
    if (error.code === "ENOENT") {
      return [];
    }
    return [];
  }
}

// Ensure rankings are loaded from file (if available) or use cache
export async function ensureRankingsLoaded(): Promise<void> {
  const now = Date.now();
  // Reload from file if never loaded, or if it's been more than RELOAD_INTERVAL since last load
  if (!rankingsLoaded || (now - lastLoadTime) > RELOAD_INTERVAL) {
    rankingsStorage = await loadRankings();
    rankingsLoaded = true;
    lastLoadTime = now;
  }
}

// Get current rankings from cache
export function getRankingsFromCache(): RankingEntry[] {
  return rankingsStorage;
}

// Update the cache (called when saving new rankings)
export function updateRankingsCache(rankings: RankingEntry[]): void {
  rankingsStorage = rankings;
  rankingsLoaded = true;
  lastLoadTime = Date.now();
}

// Add a single ranking to cache
export function addRankingToCache(entry: RankingEntry): void {
  rankingsStorage.push(entry);
  rankingsLoaded = true;
  lastLoadTime = Date.now();
}

// Replace entire cache (for DELETE operations)
export function replaceRankingsCache(rankings: RankingEntry[]): void {
  rankingsStorage = rankings;
  rankingsLoaded = true;
  lastLoadTime = Date.now();
}

