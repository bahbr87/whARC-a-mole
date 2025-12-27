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
    let matches: Array<{ player: string; points: number; timestamp: string }> = [];
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
    
    // Ensure matches is an array
    if (!Array.isArray(matches)) {
      matches = [];
    }
    
    // Add new match
    matches.push({
      player: player.toLowerCase(),
      points,
      timestamp: new Date().toISOString()
    });
    
    // Write back to file
    try {
      fs.writeFileSync(filePath, JSON.stringify(matches, null, 2), "utf-8");
    } catch (error: any) {
      // In Vercel, filesystem is read-only, so this will fail silently
      // Log warning but don't throw
      if (error.code === "EACCES" || error.code === "EROFS") {
        console.warn("⚠️ Cannot write matches.json (read-only filesystem in Vercel)");
        return;
      }
      throw error;
    }
  } catch (error) {
    console.error("Error saving match:", error);
    // Don't throw - allow game to continue even if save fails
  }
}



