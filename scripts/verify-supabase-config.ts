/**
 * Script para verificar se o Supabase está configurado corretamente
 */

import * as dotenv from "dotenv"
import { supabaseAdmin } from "@/lib/supabase"

dotenv.config({ path: ".env.local" })

async function main() {
  console.log("🔍 Verificando configuração do Supabase...\n")

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  console.log("📋 Variáveis de ambiente:")
  console.log(`   NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl ? "✅ Configurado" : "❌ Não configurado"}`)
  if (supabaseUrl) {
    console.log(`   URL: ${supabaseUrl.substring(0, 30)}...`)
  }
  console.log(`   SUPABASE_SERVICE_ROLE_KEY: ${serviceRoleKey ? "✅ Configurado" : "❌ NÃO CONFIGURADO"}`)
  if (serviceRoleKey) {
    console.log(`   Key: ${serviceRoleKey.substring(0, 20)}... (${serviceRoleKey.length} caracteres)`)
  }

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("\n❌ Configuração incompleta!")
    console.error("   Adicione as variáveis no .env.local:")
    console.error("   NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co")
    console.error("   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...")
    process.exit(1)
  }

  console.log("\n🧪 Testando conexão com Supabase...")

  try {
    // Tentar buscar uma match para testar
    const { data, error, count } = await supabaseAdmin
      .from("matches")
      .select("id, timestamp, day", { count: "exact" })
      .limit(1)

    if (error) {
      console.error("❌ Erro ao conectar com Supabase:", error.message)
      console.error("   Código:", error.code)
      process.exit(1)
    }

    console.log("✅ Conexão com Supabase OK!")
    console.log(`   Total de matches no banco: ${count || 0}`)
    
    if (data && data.length > 0) {
      console.log(`\n📊 Exemplo de match:`)
      console.log(`   ID: ${data[0].id}`)
      console.log(`   Timestamp: ${data[0].timestamp}`)
      console.log(`   Day: ${data[0].day || "NULL"}`)
    }

    // Verificar matches para os dias 20458 e 20459
    console.log(`\n🔍 Verificando matches para dias 20458 e 20459...`)
    
    const { data: matchesDay58, error: error58 } = await supabaseAdmin
      .from("matches")
      .select("id, player, points, timestamp, day")
      .eq("day", 20458)

    const { data: matchesDay59, error: error59 } = await supabaseAdmin
      .from("matches")
      .select("id, player, points, timestamp, day")
      .eq("day", 20459)

    if (error58) {
      console.error(`   ❌ Erro ao buscar matches do dia 20458:`, error58.message)
    } else {
      console.log(`   Dia 20458: ${matchesDay58?.length || 0} matches com day=20458`)
    }

    if (error59) {
      console.error(`   ❌ Erro ao buscar matches do dia 20459:`, error59.message)
    } else {
      console.log(`   Dia 20459: ${matchesDay59?.length || 0} matches com day=20459`)
    }

    // Verificar matches por timestamp (fallback)
    console.log(`\n🔍 Verificando matches por timestamp (fallback)...`)
    
    const day58Start = "2026-01-05T00:00:00.000Z"
    const day58End = "2026-01-05T23:59:59.999Z"
    const day59Start = "2026-01-06T00:00:00.000Z"
    const day59End = "2026-01-06T23:59:59.999Z"

    const { data: matchesByTs58, error: errorTs58 } = await supabaseAdmin
      .from("matches")
      .select("id, player, points, timestamp, day")
      .gte("timestamp", day58Start)
      .lte("timestamp", day58End)

    const { data: matchesByTs59, error: errorTs59 } = await supabaseAdmin
      .from("matches")
      .select("id, player, points, timestamp, day")
      .gte("timestamp", day59Start)
      .lte("timestamp", day59End)

    if (errorTs58) {
      console.error(`   ❌ Erro ao buscar matches por timestamp (20458):`, errorTs58.message)
    } else {
      console.log(`   Dia 20458 (por timestamp): ${matchesByTs58?.length || 0} matches`)
      if (matchesByTs58 && matchesByTs58.length > 0) {
        console.log(`   Exemplo: match ${matchesByTs58[0].id}, timestamp=${matchesByTs58[0].timestamp}, day=${matchesByTs58[0].day || "NULL"}`)
      }
    }

    if (errorTs59) {
      console.error(`   ❌ Erro ao buscar matches por timestamp (20459):`, errorTs59.message)
    } else {
      console.log(`   Dia 20459 (por timestamp): ${matchesByTs59?.length || 0} matches`)
      if (matchesByTs59 && matchesByTs59.length > 0) {
        console.log(`   Exemplo: match ${matchesByTs59[0].id}, timestamp=${matchesByTs59[0].timestamp}, day=${matchesByTs59[0].day || "NULL"}`)
      }
    }

    console.log(`\n${"=".repeat(60)}`)
    console.log("📊 RESUMO")
    console.log(`${"=".repeat(60)}`)
    console.log(`   Total de matches no banco: ${count || 0}`)
    console.log(`   Matches com day=20458: ${matchesDay58?.length || 0}`)
    console.log(`   Matches com day=20459: ${matchesDay59?.length || 0}`)
    console.log(`   Matches por timestamp (20458): ${matchesByTs58?.length || 0}`)
    console.log(`   Matches por timestamp (20459): ${matchesByTs59?.length || 0}`)

    if ((matchesDay58?.length || 0) === 0 && (matchesByTs58?.length || 0) === 0) {
      console.log(`\n   ⚠️ NENHUM match encontrado para o dia 20458 (05/01/2026)`)
      console.log(`   💡 Isso significa que não há jogadores para registrar winners neste dia`)
    }

    if ((matchesDay59?.length || 0) === 0 && (matchesByTs59?.length || 0) === 0) {
      console.log(`\n   ⚠️ NENHUM match encontrado para o dia 20459 (06/01/2026)`)
      console.log(`   💡 Isso significa que não há jogadores para registrar winners neste dia`)
    }

  } catch (error: any) {
    console.error("❌ Erro ao testar Supabase:", error.message)
    if (error.message.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      console.error("\n💡 A chave SUPABASE_SERVICE_ROLE_KEY não está configurada corretamente")
      console.error("   Verifique se o valor está completo no .env.local")
    }
    process.exit(1)
  }
}

main().catch(console.error)

