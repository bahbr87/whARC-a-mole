import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const dayParam = url.searchParams.get("day");

    if (!dayParam) {
      return new Response(
        JSON.stringify({ error: "Missing day parameter" }),
        { status: 400 }
      );
    }

    const day = parseInt(dayParam, 10);

    if (isNaN(day)) {
      return new Response(
        JSON.stringify({ error: "Invalid day parameter" }),
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("matches")
      .select(`
        player,
        points,
        golden_moles,
        errors,
        day
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

    return new Response(JSON.stringify({ ranking: data || [] }), {
      status: 200,
    });
  } catch (err) {
    console.error("[RANKINGS] Unexpected:", err);
    return new Response(JSON.stringify({ error: "Unexpected error" }), {
      status: 500,
    });
  }
}
