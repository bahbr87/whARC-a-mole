import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const dayParam = url.searchParams.get("day");

    // Log request details for debugging
    const headers: Record<string, string> = {}
    req.headers.forEach((value, key) => {
      headers[key] = value
    })
    
    console.log(`[RANKINGS] Request URL: ${req.url}`);
    console.log(`[RANKINGS] dayParam from query: ${dayParam}`);
    console.log(`[RANKINGS] Request headers:`, JSON.stringify(headers, null, 2));
    console.log(`[RANKINGS] Referer: ${headers['referer'] || 'N/A'}`);

    if (!dayParam) {
      console.error(`[RANKINGS] Missing day parameter in URL: ${req.url}`);
      console.error(`[RANKINGS] Full request details:`, {
        url: req.url,
        method: req.method,
        headers: headers,
        referer: headers['referer'] || 'N/A'
      });
      // Return empty array instead of error to prevent breaking the app
      // This allows the app to continue working even if there's a stray request
      return new Response(
        JSON.stringify({ ranking: [], error: "Missing day parameter - please use ?day=<dayId>" }),
        { status: 200 }
      );
    }

    const day = parseInt(dayParam, 10);

    if (isNaN(day)) {
      console.error(`[RANKINGS] Invalid day parameter: ${dayParam} (parsed as ${day})`);
      return new Response(
        JSON.stringify({ error: "Invalid day parameter", received: dayParam }),
        { status: 400 }
      );
    }

    console.log(`[RANKINGS] Querying matches for day: ${day}`);
    const todayDay = Math.floor(Date.now() / 86400000);
    console.log(`[RANKINGS] Today's day: ${todayDay}, requested day: ${day}`);

    // First try to get matches with day field
    const { data, error } = await supabaseAdmin
      .from("matches")
      .select(`
        player,
        points,
        golden_moles,
        errors,
        day,
        timestamp
      `)
      .eq("day", day)
      .order("points", { ascending: false })
      .order("golden_moles", { ascending: false })
      .order("errors", { ascending: true });

    if (error) {
      console.error("[RANKINGS] DB ERROR:", error);
      return new Response(JSON.stringify({ error: "Database error" }), {
        status: 500,
      });
    }

    console.log(`[RANKINGS] Found ${data?.length || 0} matches with day=${day}`);
    
    // If we have results, return them
    if (data && data.length > 0) {
      console.log(`[RANKINGS] Returning ${data.length} matches`);
      return new Response(JSON.stringify({ ranking: data }), {
        status: 200,
      });
    }

    // If no results, also try to get matches without day field or with NULL day
    // and calculate day from timestamp (for backward compatibility with old data)
    console.log(`[RANKINGS] No matches found with day=${day}, trying fallback query by timestamp...`);
    
    // Calculate day range from timestamp (UTC day boundaries)
    const dayStartMs = day * 86400000;
    const dayEndMs = (day + 1) * 86400000;
    const dayStartISO = new Date(dayStartMs).toISOString();
    const dayEndISO = new Date(dayEndMs).toISOString();
    
    console.log(`[RANKINGS] Searching by timestamp range: ${dayStartISO} to ${dayEndISO}`);
    
    const { data: dataByTimestamp, error: errorByTimestamp } = await supabaseAdmin
      .from("matches")
      .select(`
        player,
        points,
        golden_moles,
        errors,
        day,
        timestamp
      `)
      .gte("timestamp", dayStartISO)
      .lt("timestamp", dayEndISO)
      .order("points", { ascending: false })
      .order("golden_moles", { ascending: false })
      .order("errors", { ascending: true });

    if (errorByTimestamp) {
      console.error("[RANKINGS] Error in fallback query:", errorByTimestamp);
    } else if (dataByTimestamp && dataByTimestamp.length > 0) {
      console.log(`[RANKINGS] Found ${dataByTimestamp.length} matches by timestamp`);
      // Calculate day from timestamp for each match and verify
      const matchesWithDay = dataByTimestamp.map(match => {
        const calculatedDay = Math.floor(new Date(match.timestamp).getTime() / 86400000);
        return {
          ...match,
          day: calculatedDay
        };
      });
      
      // Filter to only matches that match the requested day
      const filtered = matchesWithDay.filter(m => m.day === day);
      console.log(`[RANKINGS] After filtering by calculated day: ${filtered.length} matches`);
      
      if (filtered.length > 0) {
        return new Response(JSON.stringify({ ranking: filtered }), {
          status: 200,
        });
      }
    }

    console.log(`[RANKINGS] No matches found for day ${day}`);
    return new Response(JSON.stringify({ ranking: [] }), {
      status: 200,
    });
  } catch (err) {
    console.error("[RANKINGS] Unexpected:", err);
    return new Response(JSON.stringify({ error: "Unexpected error" }), {
      status: 500,
    });
  }
}
