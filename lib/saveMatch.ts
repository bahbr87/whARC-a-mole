import fs from "fs";
import path from "path";

export function saveMatch(player: string, points: number) {
  try {
    const filePath = path.join(process.cwd(), "data/matches.json");
    
    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Read existing matches or create empty array
    let matches: Array<{ player: string; points: number; timestamp: number }> = [];
    if (fs.existsSync(filePath)) {
      try {
        const data = fs.readFileSync(filePath, "utf-8");
        if (data.trim()) {
          matches = JSON.parse(data);
        }
      } catch (error) {
        console.warn("Error reading matches.json, starting with empty array:", error);
        matches = [];
      }
    }
    
    if (!Array.isArray(matches)) {
      matches = [];
    }
    
    // Save timestamp as NUMBER (required by daily-results)
    matches.push({
      player: player.toLowerCase(),
      points,
      timestamp: Date.now()   // <-- ⭐️ IMPORTANTE
    });
    
    try {
      fs.writeFileSync(filePath, JSON.stringify(matches, null, 2), "utf-8");
    } catch (error: any) {
      if (error.code === "EACCES" || error.code === "EROFS") {
        console.warn("⚠️ Cannot write matches.json (read-only filesystem in Vercel)");
        return;
      }
      throw error;
    }
  } catch (error) {
    console.error("Error saving match:", error);
  }
}
