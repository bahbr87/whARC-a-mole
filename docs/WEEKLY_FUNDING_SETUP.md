# 💰 Configuração de Funding Semanal do PrizePool

Este documento explica como configurar o funding automático semanal do PrizePool (300 USDC toda semana aos domingos).

## 🎯 Objetivo

Transferir automaticamente **300 USDC** da conta principal para o PrizePool **toda semana aos domingos às 00:00 UTC**.

## 📋 Opções de Agendamento

### 1️⃣ Vercel Cron Jobs (Recomendado para Vercel)

**Arquivo:** `vercel.json`

```json
{
  "crons": [
    {
      "path": "/api/cron/fund-prizepool?token=SEU_SECRET_TOKEN",
      "schedule": "0 0 * * 0"
    }
  ]
}
```

**Configuração:**
1. Adicione `CRON_SECRET_TOKEN` nas variáveis de ambiente do Vercel
2. Atualize o token no `vercel.json`
3. O Vercel executará automaticamente a API route todo domingo às 00:00 UTC

**API Route:** `app/api/cron/fund-prizepool/route.ts`
- Executa a transferência de 300 USDC
- Protegido por token (opcional)
- Pode especificar valor customizado: `?amount=500`

---

### 2️⃣ GitHub Actions (Recomendado para GitHub)

**Arquivo:** `.github/workflows/fund-prizepool-weekly.yml`

**Configuração:**
1. Vá em **Settings → Secrets and variables → Actions**
2. Adicione os secrets:
   - `RPC_URL`
   - `PRIZE_POOL_OWNER_PRIVATE_KEY`
   - `PRIZE_POOL_CONTRACT_ADDRESS`
   - `USDC_CONTRACT_ADDRESS`
   - `CRON_SECRET_TOKEN`
   - `API_URL` (URL da sua aplicação, ex: `https://your-app.vercel.app`)
3. O GitHub Actions executará automaticamente todo domingo às 00:00 UTC

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
0 0 * * 0 curl -X GET "https://your-app.vercel.app/api/cron/fund-prizepool?token=SEU_SECRET_TOKEN&amount=300"
```

**Explicação:**
- `0 0 * * 0` = Todo domingo às 00:00 UTC
- Substitua `SEU_SECRET_TOKEN` pelo seu token
- Substitua `your-app.vercel.app` pela URL da sua aplicação

---

### 4️⃣ Task Scheduler (Windows)

**Passos:**
1. Abra **Task Scheduler** (Agendador de Tarefas)
2. Crie uma nova tarefa
3. Configure:
   - **Trigger**: Semanal, domingo, 00:00 UTC
   - **Action**: Executar programa
   - **Programa**: `curl`
   - **Argumentos**: `-X GET "https://your-app.vercel.app/api/cron/fund-prizepool?token=SEU_SECRET_TOKEN&amount=300"`

---

## 🔒 Segurança

O endpoint é protegido por token (opcional mas recomendado):

```
GET /api/cron/fund-prizepool?token=SEU_SECRET_TOKEN&amount=300
```

**Variáveis de ambiente necessárias:**
- `PRIZE_POOL_OWNER_PRIVATE_KEY` - Chave privada da conta principal
- `NEXT_PUBLIC_PRIZE_POOL_CONTRACT_ADDRESS` - Endereço do PrizePool
- `NEXT_PUBLIC_USDC_CONTRACT_ADDRESS` - Endereço do contrato USDC
- `CRON_SECRET_TOKEN` - Token de segurança (opcional)

---

## 📊 Monitoramento

O endpoint retorna informações detalhadas:

```json
{
  "success": true,
  "message": "Successfully transferred 300 USDC to PrizePool",
  "transactionHash": "0x...",
  "explorer": "https://testnet.arcscan.app/tx/0x...",
  "balances": {
    "ownerBefore": 475.97,
    "ownerAfter": 175.97,
    "prizePoolBefore": 780.0,
    "prizePoolAfter": 1080.0
  },
  "daysCovered": 30,
  "timestamp": "2025-01-12T00:00:00.000Z"
}
```

---

## ⚠️ Importante

- O script verifica se há saldo suficiente antes de transferir
- Se não houver saldo suficiente, retorna erro sem executar a transferência
- O valor padrão é 300 USDC, mas pode ser customizado via parâmetro `?amount=500`
- A transferência é executada automaticamente, sem necessidade de intervenção manual

---

## 🧪 Teste Manual

Para testar manualmente:

```bash
curl -X GET "https://your-app.vercel.app/api/cron/fund-prizepool?token=SEU_SECRET_TOKEN&amount=300"
```

Ou via navegador (não recomendado em produção):
```
https://your-app.vercel.app/api/cron/fund-prizepool?token=SEU_SECRET_TOKEN&amount=300
```


