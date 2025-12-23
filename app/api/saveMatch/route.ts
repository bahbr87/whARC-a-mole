import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function POST(req: Request) {
  try {
    const { player, points } = await req.json();

    const filePath = path.join(process.cwd(), "data/matches.json");
    
    // Read existing matches or create empty array
    let matches: Array<{ player: string; points: number; timestamp: string }> = [];
    try {
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, "utf-8");
        if (data.trim()) {
          matches = JSON.parse(data);
        }
      }
    } catch (error: any) {
      // If file doesn't exist or can't be read, start with empty array
      if (error.code !== "ENOENT") {
        console.warn("Error reading matches.json, starting with empty array:", error);
      }
    }

    // Ensure matches is an array
    if (!Array.isArray(matches)) {
      matches = [];
    }

    matches.push({
      player,
      points,
      timestamp: new Date().toISOString()
    });

    try {
      fs.writeFileSync(filePath, JSON.stringify(matches, null, 2), "utf-8");
    } catch (error: any) {
      // In Vercel, filesystem is read-only, so this will fail silently
      if (error.code === "EACCES" || error.code === "EROFS") {
        console.warn("⚠️ Cannot write matches.json (read-only filesystem in Vercel)");
        // Still return success to not break the game flow
        return NextResponse.json({ ok: true, warning: "File not saved (read-only filesystem)" });
      }
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Erro ao salvar partida:", err);
    return NextResponse.json({ error: "Erro ao salvar partida" }, { status: 500 });
  }
}

