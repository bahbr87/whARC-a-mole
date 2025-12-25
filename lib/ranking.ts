import { supabase } from "./supabase";

export interface RankingEntry {
  player: string;
  totalPoints: number;
}

export async function getRankingForDate(dateString: string | null): Promise<RankingEntry[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Supabase not configured");
    return [];
  }

  try {
    // ============================================
    // LOG 1: Dia solicitado
    // ============================================
    console.log("🔍 [RANKING-DEBUG] ========================================");
    console.log("🔍 [RANKING-DEBUG] Date string received:", dateString);
    console.log("🔍 [RANKING-DEBUG] Type:", typeof dateString);

    let targetDate: Date;

    if (dateString) {
      const [year, month, day] = dateString.split("-").map(Number);
      targetDate = new Date(Date.UTC(year, month - 1, day));
      console.log("🔍 [RANKING-DEBUG] Parsed date components:", { year, month, day });
    } else {
      const now = new Date();
      targetDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      console.log("🔍 [RANKING-DEBUG] No date provided, using today");
    }

    const dayStart = new Date(targetDate);
    dayStart.setUTCHours(0, 0, 0, 0);

    const dayEnd = new Date(targetDate);
    dayEnd.setUTCHours(23, 59, 59, 999);

    // ============================================
    // LOG 2: Valores exatos de dayStart e dayEnd
    // ============================================
    console.log("🔍 [RANKING-DEBUG] Target date (UTC):", targetDate.toISOString());
    console.log("🔍 [RANKING-DEBUG] Day start (UTC):", dayStart.toISOString());
    console.log("🔍 [RANKING-DEBUG] Day end (UTC):", dayEnd.toISOString());
    console.log("🔍 [RANKING-DEBUG] Day start timestamp (ms):", dayStart.getTime());
    console.log("🔍 [RANKING-DEBUG] Day end timestamp (ms):", dayEnd.getTime());

    // ============================================
    // LOG 3: Query enviada ao Supabase
    // ============================================
    const queryStart = dayStart.toISOString();
    const queryEnd = dayEnd.toISOString();
    console.log("🔍 [RANKING-DEBUG] Query filters:");
    console.log("🔍 [RANKING-DEBUG]   .gte('timestamp', '" + queryStart + "')");
    console.log("🔍 [RANKING-DEBUG]   .lte('timestamp', '" + queryEnd + "')");

    // First, try to get ALL columns to see what actually exists
    const { data: allColumnsData } = await supabase
      .from("matches")
      .select("*")
      .limit(1);
    
    if (allColumnsData && allColumnsData.length > 0) {
      console.log("🔍 [RANKING-DEBUG] Sample row with all columns:", JSON.stringify(allColumnsData[0], null, 2));
      console.log("🔍 [RANKING-DEBUG] Available columns:", Object.keys(allColumnsData[0]));
      
      // Check if timestamp column exists
      const hasTimestamp = 'timestamp' in allColumnsData[0];
      const hasCreatedAt = 'created_at' in allColumnsData[0];
      console.log("🔍 [RANKING-DEBUG] Has 'timestamp' column?", hasTimestamp);
      console.log("🔍 [RANKING-DEBUG] Has 'created_at' column?", hasCreatedAt);
      
      if (allColumnsData[0].timestamp) {
        console.log("🔍 [RANKING-DEBUG] Sample timestamp value:", allColumnsData[0].timestamp);
        console.log("🔍 [RANKING-DEBUG] Sample timestamp type:", typeof allColumnsData[0].timestamp);
      }
      if (allColumnsData[0].created_at) {
        console.log("🔍 [RANKING-DEBUG] Sample created_at value:", allColumnsData[0].created_at);
        console.log("🔍 [RANKING-DEBUG] Sample created_at type:", typeof allColumnsData[0].created_at);
      }
    } else {
      console.log("🔍 [RANKING-DEBUG] No rows found in matches table");
    }

    // Try query with timestamp column
    let { data, error } = await supabase
      .from("matches")
      .select("player, points, timestamp")
      .gte("timestamp", queryStart)
      .lte("timestamp", queryEnd);

    // ============================================
    // LOG 4: Quantidade de linhas retornadas
    // ============================================
    console.log("🔍 [RANKING-DEBUG] Query executed (using 'timestamp' column)");
    console.log("🔍 [RANKING-DEBUG] Rows returned:", data?.length || 0);
    console.log("🔍 [RANKING-DEBUG] Error:", error ? JSON.stringify(error, null, 2) : "null");

    // If error or no data, try with created_at as fallback
    if (error || !data || data.length === 0) {
      if (error) {
        console.log("🔍 [RANKING-DEBUG] Query with 'timestamp' failed, trying 'created_at'...");
        console.log("🔍 [RANKING-DEBUG] Error message:", error.message);
      } else {
        console.log("🔍 [RANKING-DEBUG] No data with 'timestamp', trying 'created_at'...");
      }
      
      const { data: dataCreatedAt, error: errorCreatedAt } = await supabase
        .from("matches")
        .select("player, points, created_at")
        .gte("created_at", queryStart)
        .lte("created_at", queryEnd);
      
      if (!errorCreatedAt && dataCreatedAt && dataCreatedAt.length > 0) {
        console.log("🔍 [RANKING-DEBUG] Found data using 'created_at' column!");
        console.log("🔍 [RANKING-DEBUG] Rows returned (created_at):", dataCreatedAt.length);
        // Map created_at to timestamp for consistency
        data = dataCreatedAt.map(row => ({
          player: row.player,
          points: row.points,
          timestamp: row.created_at
        }));
        error = null;
      } else if (errorCreatedAt) {
        console.log("🔍 [RANKING-DEBUG] Query with 'created_at' also failed:", errorCreatedAt.message);
      }
    }

    if (error) {
      console.error("🔍 [RANKING-DEBUG] Supabase error details:", error);
      return [];
    }

    // ============================================
    // LOG 5: Exemplos de timestamps retornados
    // ============================================
    if (data && data.length > 0) {
      console.log("🔍 [RANKING-DEBUG] Sample timestamps from returned data:");
      data.slice(0, 5).forEach((match, idx) => {
        console.log(`🔍 [RANKING-DEBUG]   [${idx + 1}] timestamp: ${match.timestamp}, type: ${typeof match.timestamp}, player: ${match.player}, points: ${match.points}`);
        if (match.timestamp) {
          const tsDate = new Date(match.timestamp);
          console.log(`🔍 [RANKING-DEBUG]      Parsed as Date: ${tsDate.toISOString()}`);
          console.log(`🔍 [RANKING-DEBUG]      Is within range? ${tsDate >= dayStart && tsDate <= dayEnd}`);
        }
      });
    } else {
      console.log("🔍 [RANKING-DEBUG] No data returned - checking if there's any data in table...");
      
      // Debug: Get some sample data to see what timestamps exist
      const { data: sampleData } = await supabase
        .from("matches")
        .select("player, points, timestamp")
        .order("timestamp", { ascending: false })
        .limit(10);
      
      if (sampleData && sampleData.length > 0) {
        console.log("🔍 [RANKING-DEBUG] Sample timestamps from entire table (latest 10):");
        sampleData.forEach((match, idx) => {
          console.log(`🔍 [RANKING-DEBUG]   [${idx + 1}] timestamp: ${match.timestamp}, type: ${typeof match.timestamp}`);
          if (match.timestamp) {
            const tsDate = new Date(match.timestamp);
            const isInRange = tsDate >= dayStart && tsDate <= dayEnd;
            const isBefore = tsDate < dayStart;
            const isAfter = tsDate > dayEnd;
            console.log(`🔍 [RANKING-DEBUG]      Parsed: ${tsDate.toISOString()}`);
            console.log(`🔍 [RANKING-DEBUG]      In range? ${isInRange}, Before? ${isBefore}, After? ${isAfter}`);
          }
        });
      } else {
        console.log("🔍 [RANKING-DEBUG] Table appears to be empty");
      }
    }

    console.log("🔍 [RANKING-DEBUG] ========================================");

    if (!data || data.length === 0) return [];

    const rankingMap: Record<string, number> = {};

    data.forEach((match) => {
      const player = match.player.toLowerCase();
      const points = match.points || 0;

      rankingMap[player] = (rankingMap[player] || 0) + points;
    });

    return Object.entries(rankingMap)
      .map(([player, totalPoints]) => ({ player, totalPoints }))
      .sort((a, b) => b.totalPoints - a.totalPoints);
  } catch (err) {
    console.error("Ranking error:", err);
    return [];
  }
}

