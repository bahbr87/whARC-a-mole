# ⏰ Agendamento Automático do Registro de Vencedores

Este documento explica como configurar a execução automática do script de registro de vencedores todo dia após virar o dia UTC.

## 🎯 Objetivo

Executar automaticamente:
```typescript
await prizePool.setDailyWinnersArray(day, winners)
```

Todo dia às **00:05 UTC** (5 minutos após meia-noite UTC).

---

## 📋 Opções de Agendamento

### 1️⃣ Vercel Cron Jobs (Recomendado para Vercel)

**Arquivo:** `vercel.json`

```json
{
  "crons": [
    {
      "path": "/api/cron/register-winners?token=SEU_SECRET_TOKEN",
      "schedule": "5 0 * * *"
    }
  ]
}
```

**Configuração:**
1. Adicione `CRON_SECRET_TOKEN` nas variáveis de ambiente do Vercel
2. Atualize o token no `vercel.json`
3. O Vercel executará automaticamente a API route

**API Route:** `app/api/cron/register-winners/route.ts`
- Executa o script `register-daily-winners-auto.ts`
- Protegido por token (opcional)

---

### 2️⃣ GitHub Actions (Recomendado para GitHub)

**Arquivo:** `.github/workflows/register-winners-daily.yml`

**Configuração:**
1. Vá em **Settings → Secrets and variables → Actions**
2. Adicione os secrets:
   - `RPC_URL`
   - `PRIZE_POOL_OWNER_PRIVATE_KEY`
   - `PRIZE_POOL_CONTRACT_ADDRESS`
3. O GitHub Actions executará automaticamente todo dia às 00:05 UTC

**Vantagens:**
- ✅ Gratuito para repositórios públicos
- ✅ Logs completos
- ✅ Notificações de falha
- ✅ Execução manual via `workflow_dispatch`

---

### 3️⃣ Cron (Linux/Mac)

**Comando:**
```bash
crontab -e
```

**Adicionar linha:**
```cron
5 0 * * * cd /caminho/do/projeto && npm run register-winners-auto
```

**Explicação:**
- `5 0 * * *` = Todo dia às 00:05 UTC
- `cd /caminho/do/projeto` = Navega para o diretório do projeto
- `npm run register-winners-auto` = Executa o script

---

### 4️⃣ Task Scheduler (Windows)

**Passos:**
1. Abra **Task Scheduler** (Agendador de Tarefas)
2. Clique em **Create Basic Task**
3. Nome: "Register Daily Winners"
4. Trigger: **Daily**
5. Time: **00:05** (ajuste para UTC)
6. Action: **Start a program**
7. Program: `npm`
8. Arguments: `run register-winners-auto`
9. Start in: `C:\caminho\do\projeto`

---

### 5️⃣ Serviços Externos

#### EasyCron / Cron-Job.org
1. Crie uma conta
2. Configure a URL: `https://seu-dominio.com/api/cron/register-winners?token=SEU_SECRET_TOKEN`
3. Schedule: `5 0 * * *` (todo dia às 00:05 UTC)

#### Uptime Robot
1. Crie um monitor HTTP(S)
2. URL: `https://seu-dominio.com/api/cron/register-winners?token=SEU_SECRET_TOKEN`
3. Interval: 24 hours
4. Alert: Configure notificações

---

## 🔒 Segurança

### Proteção por Token

Adicione no `.env.local`:
```env
CRON_SECRET_TOKEN=seu_token_secreto_aqui
```

Use na URL:
```
/api/cron/register-winners?token=seu_token_secreto_aqui
```

---

## 📊 Monitoramento

### Logs do Script

O script gera logs detalhados:
- ✅ Sucesso: Vencedores registrados
- ⚠️ Aviso: Já registrado / Nenhum jogador
- ❌ Erro: Falha na transação / Validação

### Verificação Manual

Execute manualmente para testar:
```bash
npm run register-winners-auto
```

---

## ✅ Checklist de Configuração

- [ ] Script `register-daily-winners-auto.ts` criado
- [ ] Variáveis de ambiente configuradas (`.env.local`)
- [ ] Agendamento configurado (escolha uma opção acima)
- [ ] Token de segurança configurado (se usar API route)
- [ ] Teste manual executado com sucesso
- [ ] Monitoramento configurado (logs/notificações)

---

## 🐛 Troubleshooting

### Script não executa
- Verifique se o caminho está correto
- Verifique permissões de execução
- Verifique logs de erro

### Transação falha
- Verifique se a wallet tem gas suficiente
- Verifique se a wallet é owner do contrato
- Verifique se os endereços são válidos

### Vencedores já registrados
- Isso é normal se o script já foi executado
- O script para sem erro neste caso

---

## 📝 Notas

- ⏰ O script **sempre fecha o dia anterior** (UTC)
- 🔄 Não registra duplicado (verifica `isWinnersRegistered`)
- ✅ Valida tudo antes de enviar transação
- 📊 Logs completos para debugging

