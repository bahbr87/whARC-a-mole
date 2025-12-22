import fs from "fs";
import path from "path";

interface RankingEntry {
  player: string;
  score: number;
  goldenMoles: number;
  errors: number;
  timestamp: number;
}

function getUTCDayStart(date: Date): number {
  const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0));
  return utcDate.getTime();
}

function getUTCDayEnd(date: Date): number {
  const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
  return utcDate.getTime();
}

/**
 * Função auxiliar para construir vencedores do dia
 * @param playersSorted - Array de endereços ordenados por score DESC
 * @returns Objeto com first, second, third (usa ZeroAddress quando não há jogadores suficientes)
 */
export function buildDailyWinners(playersSorted: string[]): {
  first: string;
  second: string;
  third: string;
} {
  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
  return {
    first: playersSorted[0] ?? ZERO_ADDRESS,
    second: playersSorted[1] ?? ZERO_ADDRESS,
    third: playersSorted[2] ?? ZERO_ADDRESS,
  };
}

/**
 * Retorna array de endereços ordenados por score DESC (não limitado a 3)
 * @param dayUTC - Número de dias desde epoch UTC (1970-01-01)
 * @returns Array de endereços ordenados por score (maior para menor)
 */
export async function getDailyRankings(dayUTC: number): Promise<string[]> {
  const RANKINGS_FILE = path.join(process.cwd(), "data", "rankings.json");
  
  // Converter dayUTC de volta para Date
  const epoch = Date.UTC(1970, 0, 1);
  const date = new Date(epoch + dayUTC * 24 * 60 * 60 * 1000);
  
  let rankings: RankingEntry[] = [];
  try {
    const data = fs.readFileSync(RANKINGS_FILE, "utf-8");
    rankings = JSON.parse(data);
    if (!Array.isArray(rankings)) {
      rankings = [];
    }
  } catch (error) {
    console.warn("⚠️ Arquivo de rankings não encontrado ou vazio");
    return [];
  }

  const dayStart = getUTCDayStart(date);
  const dayEnd = getUTCDayEnd(date);

  // Filtrar rankings do dia específico e agrupar por player
  const dayRankings = rankings
    .filter((entry) => entry.timestamp >= dayStart && entry.timestamp <= dayEnd)
    .reduce((acc, entry) => {
      const existing = acc.get(entry.player);
      if (existing) {
        existing.score += entry.score;
        existing.goldenMoles += entry.goldenMoles;
        existing.errors += entry.errors;
      } else {
        acc.set(entry.player, {
          player: entry.player,
          score: entry.score,
          goldenMoles: entry.goldenMoles,
          errors: entry.errors,
          timestamp: entry.timestamp,
        });
      }
      return acc;
    }, new Map<string, RankingEntry>());

  // Ordenar por: score → goldenMoles → errors → timestamp (DESC por score)
  const sorted = Array.from(dayRankings.values()).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.goldenMoles !== a.goldenMoles) return b.goldenMoles - a.goldenMoles;
    if (a.errors !== b.errors) return a.errors - b.errors;
    return a.timestamp - b.timestamp;
  });

  // Retornar array de endereços ordenados por score DESC
  return sorted.map(entry => entry.player);
}

