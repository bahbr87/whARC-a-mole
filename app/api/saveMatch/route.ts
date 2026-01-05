import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * POST /api/saveMatch
 * Saves a match to Supabase matches table
 * 
 * Expected payload:
 * {
 *   player: string,
 *   events: Array<{ holeId: number, animalType: "mole" | "cow" | "golden", timestamp: number }>,
 *   completed: boolean,
 *   game_duration: number,
 *   difficulty: "easy" | "medium" | "hard"
 * }
 * 
 * Backend calculates:
 * - points: based on events and difficulty
 * - golden_moles: count of golden mole hits
 * - errors: count of cow hits
 * 
 * Fields saved:
 * - player: string (lowercase wallet address)
 * - points: number (calculated by backend)
 * - golden_moles: number (calculated by backend)
 * - errors: number (calculated by backend)
 * - timestamp: timestamp (auto-set by Supabase default)
 * 
 * Security validations:
 * - Maximum 9 matches per day per player
 * - Minimum 30 seconds game duration (game must be completed to the end)
 * - Maximum 9 golden moles per day per player
 * - Maximum points validation (only hits in hard difficulty * 9 matches)
 * 
 * NO filesystem access - works on Vercel
 */

// Game constants
const GAME_DURATION = 30; // seconds
const MAX_MATCHES_PER_DAY = 9;
const MAX_GOLDEN_MOLES_PER_DAY = 9;
const MIN_GAME_DURATION_SECONDS = 30; // Partida deve durar pelo menos 30 segundos

// Point values for hard difficulty (mole: 15, golden: 30)
// Maximum theoretical points in hard: assuming perfect play with all hits
// Conservative estimate: ~30-40 moles can appear in 30 seconds at fastest speed
// Each mole = 15 points, 1 golden = 30 points
// Max per match (hard, perfect): ~(35 * 15) + 30 = 555 points
// Max per day (9 matches): 555 * 9 = 4995 points
// Using conservative 5000 points as maximum
const MAX_POINTS_PER_DAY = 5000; // Conservative maximum for hard difficulty * 9 matches

// Point values per difficulty (same as frontend)
type GameDifficulty = "easy" | "medium" | "hard";
type AnimalType = "mole" | "cow" | "golden";

const getPointsForDifficulty = (difficulty: GameDifficulty) => {
  switch (difficulty) {
    case "easy":
      return { mole: 5, cow: -1, golden: 10 };
    case "medium":
      return { mole: 10, cow: -2, golden: 20 };
    case "hard":
      return { mole: 15, cow: -3, golden: 30 };
  }
};

interface GameEvent {
  holeId: number;
  animalType: AnimalType;
  timestamp: number;
}

export async function POST(req: Request) {
  try {
    // Validate Supabase configuration at runtime
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    const { player, events, game_duration, completed, difficulty } = await req.json();

    // Validate required fields
    if (!player || !events || !Array.isArray(events)) {
      return NextResponse.json({ error: 'Missing required fields: player and events' }, { status: 400 });
    }

    if (!difficulty || !["easy", "medium", "hard"].includes(difficulty)) {
      return NextResponse.json({ error: 'Missing or invalid difficulty field' }, { status: 400 });
    }

    // ============================================================================
    // CALCULATE POINTS, GOLDEN_MOLES, AND ERRORS FROM EVENTS
    // ============================================================================
    
    const pointsConfig = getPointsForDifficulty(difficulty as GameDifficulty);
    let points = 0;
    let golden_moles = 0;
    let errors = 0;

    for (const event of events as GameEvent[]) {
      if (!event.animalType || !["mole", "cow", "golden"].includes(event.animalType)) {
        console.warn(`[SAVE-MATCH] Invalid event animalType: ${event.animalType}, skipping`);
        continue;
      }

      if (event.animalType === "golden") {
        points += pointsConfig.golden;
        golden_moles += 1;
      } else if (event.animalType === "mole") {
        points += pointsConfig.mole;
      } else if (event.animalType === "cow") {
        points += pointsConfig.cow; // This is negative
        errors += 1;
      }
    }

    // Ensure points cannot go below 0
    points = Math.max(0, points);

    console.log(`[SAVE-MATCH] Calculated from events: points=${points}, golden_moles=${golden_moles}, errors=${errors}, events_count=${events.length}`);

    // Normalize player to lowercase (for consistent grouping)
    const normalizedPlayer = player.toLowerCase();

    // Calculate day using the same formula as everywhere else: Math.floor(timestamp / 86400000)
    const day = Math.floor(Date.now() / 86400000);

    // ============================================================================
    // SECURITY VALIDATIONS
    // ============================================================================

    // 1. Validate game was completed to the end (not quit mid-game)
    if (completed === false || completed === undefined) {
      console.log(`[SAVE-MATCH] ❌ Match rejected: game not completed to the end. player=${normalizedPlayer}`);
      return NextResponse.json({ 
        error: 'Match not completed. Only matches played to the end count for points.',
        code: 'GAME_NOT_COMPLETED'
      }, { status: 400 });
    }

    // 2. Validate minimum game duration (30 seconds)
    const gameDuration = game_duration || GAME_DURATION;
    if (gameDuration < MIN_GAME_DURATION_SECONDS) {
      console.log(`[SAVE-MATCH] ❌ Match rejected: game duration too short. player=${normalizedPlayer}, duration=${gameDuration}s`);
      return NextResponse.json({ 
        error: `Match duration too short. Minimum duration is ${MIN_GAME_DURATION_SECONDS} seconds.`,
        code: 'GAME_DURATION_TOO_SHORT'
      }, { status: 400 });
    }

    // 3. Check maximum matches per day (9 matches)
    const { data: todayMatches, error: matchesError } = await supabaseAdmin
      .from('matches')
      .select('id')
      .eq('player', normalizedPlayer)
      .eq('day', day);

    if (matchesError) {
      console.error('[SAVE-MATCH] Error checking daily matches:', matchesError);
      return NextResponse.json({ error: 'Error validating match limits' }, { status: 500 });
    }

    const matchesToday = todayMatches?.length || 0;
    if (matchesToday >= MAX_MATCHES_PER_DAY) {
      console.log(`[SAVE-MATCH] ❌ Match rejected: maximum matches per day reached. player=${normalizedPlayer}, matches=${matchesToday}`);
      return NextResponse.json({ 
        error: `Maximum ${MAX_MATCHES_PER_DAY} matches per day reached. Please try again tomorrow.`,
        code: 'MAX_MATCHES_REACHED'
      }, { status: 400 });
    }

    // 4. Check maximum golden moles per day (9 golden moles)
    const { data: todayMatchesWithGolden, error: goldenError } = await supabaseAdmin
      .from('matches')
      .select('golden_moles')
      .eq('player', normalizedPlayer)
      .eq('day', day);

    if (goldenError) {
      console.error('[SAVE-MATCH] Error checking golden moles:', goldenError);
      return NextResponse.json({ error: 'Error validating golden moles limit' }, { status: 500 });
    }

    const totalGoldenMolesToday = (todayMatchesWithGolden || []).reduce((sum: number, match: any) => sum + (match.golden_moles || 0), 0);
    const newTotalGoldenMoles = totalGoldenMolesToday + (golden_moles || 0);
    
    if (newTotalGoldenMoles > MAX_GOLDEN_MOLES_PER_DAY) {
      console.log(`[SAVE-MATCH] ❌ Match rejected: maximum golden moles per day exceeded. player=${normalizedPlayer}, current=${totalGoldenMolesToday}, new=${newTotalGoldenMoles}, max=${MAX_GOLDEN_MOLES_PER_DAY}`);
      return NextResponse.json({ 
        error: `Maximum ${MAX_GOLDEN_MOLES_PER_DAY} golden moles per day exceeded. This appears to be fraudulent.`,
        code: 'MAX_GOLDEN_MOLES_EXCEEDED'
      }, { status: 400 });
    }

    // 5. Check maximum points per day (conservative validation)
    const { data: todayMatchesPoints, error: pointsError } = await supabaseAdmin
      .from('matches')
      .select('points')
      .eq('player', normalizedPlayer)
      .eq('day', day);

    if (pointsError) {
      console.error('[SAVE-MATCH] Error checking daily points:', pointsError);
      return NextResponse.json({ error: 'Error validating points limit' }, { status: 500 });
    }

    const totalPointsToday = (todayMatchesPoints || []).reduce((sum: number, match: any) => sum + (match.points || 0), 0);
    const newTotalPoints = totalPointsToday + points;
    
    if (newTotalPoints > MAX_POINTS_PER_DAY) {
      console.log(`[SAVE-MATCH] ❌ Match rejected: maximum points per day exceeded. player=${normalizedPlayer}, current=${totalPointsToday}, new=${newTotalPoints}, max=${MAX_POINTS_PER_DAY}`);
      return NextResponse.json({ 
        error: `Maximum points per day exceeded. This appears to be fraudulent.`,
        code: 'MAX_POINTS_EXCEEDED'
      }, { status: 400 });
    }

    // ============================================================================
    // All validations passed - save match
    // ============================================================================

    // Insert into Supabase matches table
    // Explicitly set timestamp to ensure it's in UTC and matches the column name
    const timestamp = new Date().toISOString();
    
    console.log(`[SAVE-MATCH] ✅ Saving match: player=${normalizedPlayer}, points=${points}, golden_moles=${golden_moles || 0}, day=${day}, matches_today=${matchesToday + 1}, timestamp=${timestamp}`);
    
    const { error, data: insertedData } = await supabaseAdmin
      .from('matches')
      .insert([{ 
        player: normalizedPlayer, 
        points,
        golden_moles: golden_moles || 0,
        errors: errors || 0,
        timestamp, // Explicitly set timestamp column
        day // Calculate and save day field
      }])
      .select();
    
    if (insertedData) {
      console.log(`[SAVE-MATCH] Match saved successfully:`, insertedData[0]);
    }

    if (error) {
      console.error('Supabase insert error:', error);
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Error saving match:', err);
    return NextResponse.json({ error: 'Erro ao salvar partida' }, { status: 500 });
  }
}

