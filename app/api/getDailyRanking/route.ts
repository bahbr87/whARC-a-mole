import { NextResponse } from "next/server";
import { getRankingForDay } from "@/lib/ranking";

export async function GET(request: Request) {
  try {
    // Validate Supabase configuration at runtime
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    // Check for query parameter ?day=yesterday
    const url = new URL(request.url);
    const dayParam = url.searchParams.get("day");
    
    // Determine which day to fetch
    const day: "today" | "yesterday" = dayParam === "yesterday" ? "yesterday" : "today";

    // Get ranking from Supabase using helper
    const ranking = await getRankingForDay(day);

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
