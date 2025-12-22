import dotenv from "dotenv"
import path from "path"

dotenv.config({ path: path.join(process.cwd(), ".env.local") })

async function registerWinners() {
  console.log("=".repeat(70))
  console.log("📝 REGISTRANDO VENCEDORES DO DIA 21/12/2025")
  console.log("=".repeat(70))
  console.log("")

  try {
    const response = await fetch("http://localhost:3000/api/register-daily-winners", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        date: "2025-12-21",
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error("❌ Erro:", errorData)
      return
    }

    const result = await response.json()
    console.log("✅ Sucesso!")
    console.log("")
    console.log("Resultado:", JSON.stringify(result, null, 2))
    console.log("")
    console.log(`🔗 Explorer: ${result.explorerUrl}`)
    console.log("")

  } catch (error: any) {
    console.error("❌ Erro:", error.message)
    console.error("   Certifique-se de que o servidor Next.js está rodando (npm run dev)")
  }
}

registerWinners().catch(console.error)



