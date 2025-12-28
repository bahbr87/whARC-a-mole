/**
 * Script para testar a finalização de dias pendentes
 * 
 * Uso:
 *   npm run test-finalize-day
 *   ou
 *   npx tsx scripts/test-finalize-day.ts [day]
 * 
 * Se day não for fornecido, finaliza todos os dias pendentes
 */

async function testFinalizeDay() {
  const dayParam = process.argv[2];
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 
                  "https://wharc-a-mole.vercel.app";

  let url = `${baseUrl}/api/cron/register-winners`;
  if (dayParam) {
    const day = parseInt(dayParam, 10);
    if (isNaN(day)) {
      console.error("❌ Day parameter must be a number");
      process.exit(1);
    }
    url += `?day=${day}`;
    console.log(`🚀 Testing finalization for specific day: ${day}`);
  } else {
    console.log(`🚀 Testing finalization for ALL pending days`);
  }

  console.log(`📡 Calling: ${url}`);
  console.log();

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();

    console.log(`📊 Status: ${response.status}`);
    console.log(`📋 Response:`, JSON.stringify(data, null, 2));

    if (response.ok) {
      console.log();
      console.log("✅ Success!");
      if (data.results) {
        console.log(`📊 Finalized ${data.results.filter((r: any) => r.success).length} day(s)`);
        data.results.forEach((result: any) => {
          console.log(`   Day ${result.day}: ${result.message}`);
        });
      }
    } else {
      console.error();
      console.error("❌ Error:", data.error || "Unknown error");
      process.exit(1);
    }
  } catch (error: any) {
    console.error();
    console.error("❌ Error calling endpoint:");
    console.error(`   ${error.message}`);
    process.exit(1);
  }
}

testFinalizeDay();

