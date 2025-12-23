import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "data/matches.json");
    
    // Read matches file or return empty array if it doesn't exist
    let matches: Array<{ player: string; points: number; timestamp: string }> = [];
    try {
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, "utf-8");
        if (data.trim()) {
          matches = JSON.parse(data);
        }
      }
    } catch (error: any) {
      // If file doesn't exist or can't be read, return empty array
      if (error.code === "ENOENT") {
        return NextResponse.json([], {
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
          },
        });
      }
      throw error;
    }

    // Ensure matches is an array
    if (!Array.isArray(matches)) {
      matches = [];
    }

    // Use UTC for date filtering to ensure consistency across timezones
    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    const todayEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));

    const rankingMap: Record<string, number> = {};

    matches.forEach((match: any) => {
      const ts = new Date(match.timestamp).getTime();
      if (ts >= todayStart.getTime() && ts <= todayEnd.getTime()) {
        const player = match.player.toLowerCase();
        rankingMap[player] = (rankingMap[player] || 0) + match.points;
      }
    });

    const ranking = Object.entries(rankingMap)
      .map(([player, totalPoints]) => ({ player, totalPoints }))
      .sort((a, b) => b.totalPoints - a.totalPoints);

    return NextResponse.json(ranking, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (err) {
    console.error("Erro ao gerar ranking:", err);
    return NextResponse.json({ error: "Erro ao gerar ranking" }, { status: 500 });
  }
}
