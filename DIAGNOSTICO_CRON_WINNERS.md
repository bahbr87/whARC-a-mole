# 🔍 Diagnóstico: Por que os winners não estão sendo registrados diariamente?

## 📋 Checklist de Verificação

### 1️⃣ Variáveis de Ambiente no Vercel

Verifique se as seguintes variáveis estão configuradas no **Vercel Dashboard → Settings → Environment Variables**:

- ✅ `PRIZE_PUBLIC_PRIZE_POOL_CONTRACT_ADDRESS` (ou `PRIZE_POOL_CONTRACT_ADDRESS`)
- ✅ `PRIZE_POOL_OWNER_PRIVATE_KEY` ⚠️ **CRÍTICO**
- ✅ `RPC_URL` (opcional, tem fallback)
- ⚠️ `CRON_SECRET_TOKEN` (opcional, mas se configurado, precisa estar na URL)

### 2️⃣ Verificar se o Cron está Executando

**No Vercel Dashboard:**
1. Vá em **Deployments**
2. Clique no deployment mais recente
3. Vá em **Functions** → `/api/cron/register-winners`
4. Verifique os **logs** para ver se há erros

**Ou execute manualmente:**
```bash
# Testar localmente
npm run dev
# Em outro terminal:
curl http://localhost:3000/api/cron/register-winners
```

### 3️⃣ Verificar Logs do Vercel

Os logs devem mostrar:
- `[CRON] Register winners request received`
- `[CRON] Finding all pending days to finalize...`
- `[REGISTER-WINNERS] Checking if day X is already registered...`

**Se você ver:**
- `PRIZE_POOL_OWNER_PRIVATE_KEY not configured` → Configure no Vercel
- `Unauthorized` → Token está bloqueando (veja seção abaixo)
- `No pending days to finalize` → Não há dias para registrar (normal se já foram registrados)

### 4️⃣ Problema com Token (se configurado)

Se `CRON_SECRET_TOKEN` estiver configurado no Vercel, você precisa atualizar o `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/register-winners?token=SEU_TOKEN_AQUI",
      "schedule": "0 0 * * *"
    }
  ]
}
```

**OU** remover a verificação de token do código (não recomendado para produção).

### 5️⃣ Testar Manualmente

**Registrar um dia específico:**
```bash
curl "https://seu-dominio.vercel.app/api/cron/register-winners?day=20458"
```

**Registrar todos os dias pendentes:**
```bash
curl "https://seu-dominio.vercel.app/api/cron/register-winners"
```

### 6️⃣ Verificar GitHub Actions (alternativa)

Se o Vercel não estiver funcionando, o GitHub Actions também pode registrar:

1. Vá em **GitHub → Settings → Secrets and variables → Actions**
2. Verifique se os secrets estão configurados:
   - `RPC_URL`
   - `PRIZE_POOL_OWNER_PRIVATE_KEY`
   - `PRIZE_POOL_CONTRACT_ADDRESS`
3. Vá em **Actions** → **Register Daily Winners**
4. Clique em **Run workflow** para executar manualmente

## 🐛 Problemas Comuns

### ❌ "PRIZE_POOL_OWNER_PRIVATE_KEY not configured"
**Solução:** Configure no Vercel Dashboard → Settings → Environment Variables

### ❌ "Unauthorized"
**Solução:** 
- Se `CRON_SECRET_TOKEN` estiver configurado, adicione `?token=...` na URL do `vercel.json`
- OU remova o token do código (não recomendado)

### ❌ "No players found for day X"
**Causa:** Não há matches no Supabase para aquele dia
**Solução:** Normal, não é um erro. O dia só será registrado quando houver jogadores.

### ❌ "Wallet is not the contract owner"
**Causa:** A chave privada configurada não é a owner do contrato
**Solução:** Use a chave privada da wallet que deployou o contrato

### ❌ Cron não executa
**Causa:** Vercel Cron pode ter limitações no plano gratuito
**Solução:** Use GitHub Actions como alternativa

## ✅ Script de Diagnóstico

Execute o script de diagnóstico:

```bash
npx tsx scripts/check-cron-setup.ts
```

Este script vai:
1. Verificar todas as variáveis de ambiente
2. Testar o registro de um dia passado
3. Mostrar erros específicos

## 📞 Próximos Passos

1. Execute o script de diagnóstico
2. Verifique os logs do Vercel
3. Teste manualmente o endpoint
4. Configure as variáveis de ambiente faltantes
5. Verifique se o cron está realmente executando (logs do Vercel)

