import * as fs from "fs"
import * as path from "path"
import "dotenv/config"

const NEW_ADDRESS = process.argv[2] || process.env.NEW_PRIZE_POOL_ADDRESS

if (!NEW_ADDRESS) {
  console.error("❌ Erro: Endereço não fornecido")
  console.log("\n📋 Uso:")
  console.log("   npm run update-prizepool-address <NOVO_ENDERECO>")
  console.log("   ou")
  console.log("   NEW_PRIZE_POOL_ADDRESS=<NOVO_ENDERECO> npm run update-prizepool-address")
  console.log("\n💡 Exemplo:")
  console.log("   npm run update-prizepool-address 0x1234567890123456789012345678901234567890")
  process.exit(1)
}

// Validar formato do endereço
if (!/^0x[a-fA-F0-9]{40}$/.test(NEW_ADDRESS)) {
  console.error("❌ Erro: Endereço inválido. Deve ser um endereço Ethereum válido (0x seguido de 40 caracteres hexadecimais)")
  process.exit(1)
}

const envPath = path.join(process.cwd(), ".env.local")

// Ler arquivo .env.local se existir
let envContent = ""
if (fs.existsSync(envPath)) {
  envContent = fs.readFileSync(envPath, "utf8")
} else {
  console.log("⚠️ Arquivo .env.local não encontrado. Criando novo arquivo...")
}

// Atualizar ou adicionar NEXT_PUBLIC_PRIZE_POOL_CONTRACT_ADDRESS
const lines = envContent.split("\n")
let updated = false
let found = false

const newLines = lines.map((line) => {
  if (line.trim().startsWith("NEXT_PUBLIC_PRIZE_POOL_CONTRACT_ADDRESS=")) {
    found = true
    updated = true
    return `NEXT_PUBLIC_PRIZE_POOL_CONTRACT_ADDRESS=${NEW_ADDRESS}`
  }
  return line
})

// Se não encontrou, adicionar no final
if (!found) {
  if (envContent && !envContent.endsWith("\n")) {
    newLines.push("")
  }
  newLines.push(`NEXT_PUBLIC_PRIZE_POOL_CONTRACT_ADDRESS=${NEW_ADDRESS}`)
  updated = true
}

// Também atualizar PRIZE_POOL_CONTRACT_ADDRESS se existir
let prizePoolUpdated = false
const finalLines = newLines.map((line) => {
  if (line.trim().startsWith("PRIZE_POOL_CONTRACT_ADDRESS=") && !line.trim().startsWith("NEXT_PUBLIC_")) {
    prizePoolUpdated = true
    return `PRIZE_POOL_CONTRACT_ADDRESS=${NEW_ADDRESS}`
  }
  return line
})

// Escrever arquivo atualizado
fs.writeFileSync(envPath, finalLines.join("\n"), "utf8")

console.log("✅ Arquivo .env.local atualizado com sucesso!")
console.log(`📍 Novo endereço: ${NEW_ADDRESS}`)
if (prizePoolUpdated) {
  console.log("✅ PRIZE_POOL_CONTRACT_ADDRESS também foi atualizado")
}
console.log("\n📋 Próximos passos:")
console.log("1. Reinicie o servidor de desenvolvimento:")
console.log("   npm run dev")
console.log("2. Verifique se o novo endereço está sendo usado corretamente")




