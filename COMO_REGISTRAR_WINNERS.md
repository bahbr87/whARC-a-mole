# 🏆 Como Registrar Winners Diariamente

## 🎯 Problema

Os winners não estão sendo registrados automaticamente porque:
1. Variáveis de ambiente não configuradas no Vercel
2. Cron não está executando ou falhando silenciosamente

## ✅ Solução Rápida

### Opção 1: Registrar Manualmente (Imediato)

**Registrar um dia específico:**
```bash
npm run test-register-winners -- --day=20458
```

**Registrar todos os dias pendentes:**
```bash
# Via endpoint (se estiver rodando localmente)
curl http://localhost:3000/api/cron/register-winners

# Ou via script local (requer .env.local)
npm run test-register-winners -- --local
```

### Opção 2: Configurar no Vercel (Automático)

1. **Vercel Dashboard** → Seu Projeto → **Settings** → **Environment Variables**

2. **Adicione as variáveis:**
   ```
   PRIZE_POOL_OWNER_PRIVATE_KEY=0x...
   NEXT_PUBLIC_PRIZE_POOL_CONTRACT_ADDRESS=0x...
   ```

3. **Redeploy** o projeto (ou aguarde o próximo deploy)

4. **Teste o endpoint:**
   ```bash
   curl https://seu-dominio.vercel.app/api/cron/register-winners
   ```

### Opção 3: Usar GitHub Actions (Alternativa)

O GitHub Actions já está configurado em `.github/workflows/register-winners-daily.yml`

1. **GitHub** → Seu Repo → **Settings** → **Secrets and variables** → **Actions**

2. **Adicione os secrets:**
   - `RPC_URL`
   - `PRIZE_POOL_OWNER_PRIVATE_KEY`
   - `PRIZE_POOL_CONTRACT_ADDRESS`

3. **Execute manualmente:**
   - Vá em **Actions** → **Register Daily Winners**
   - Clique em **Run workflow**

## 🧪 Scripts Disponíveis

### Diagnóstico
```bash
# Verificar configuração
npm run check-cron-setup
```

### Testar Registro
```bash
# Registrar dia específico
npm run test-register-winners -- --day=20458

# Testar localmente (dia de ontem)
npm run test-register-winners -- --local

# Testar endpoint do Vercel
npm run test-register-winners -- --vercel --url=https://seu-app.vercel.app/api/cron/register-winners
```

## 📋 Checklist

- [ ] Variáveis de ambiente configuradas no Vercel
- [ ] Endpoint testado manualmente
- [ ] Logs do Vercel verificados
- [ ] Cron executando diariamente (verificar logs)

## 🔍 Verificar se Está Funcionando

1. **Vercel Dashboard** → **Deployments** → Último deployment → **Functions** → `/api/cron/register-winners` → **Logs**

2. **Procure por:**
   - `[CRON] Register winners request received`
   - `[REGISTER-WINNERS] Winners registered successfully`
   - `[CRON] Found X pending days to finalize`

3. **Se ver erros:**
   - `PRIZE_POOL_OWNER_PRIVATE_KEY not configured` → Configure no Vercel
   - `Unauthorized` → Token bloqueando (verificar `CRON_SECRET_TOKEN`)
   - `No players found` → Normal, não há jogadores naquele dia

## 🚨 Problemas Comuns

### "PRIZE_POOL_OWNER_PRIVATE_KEY not configured"
**Solução:** Configure no Vercel Dashboard → Settings → Environment Variables

### "Wallet is not the contract owner"
**Solução:** Use a chave privada da wallet que deployou o contrato PrizePool

### "No pending days to finalize"
**Causa:** Todos os dias já foram registrados ou não há matches
**Solução:** Normal, não é um erro

### Cron não executa
**Causa:** Vercel Cron pode ter limitações no plano gratuito
**Solução:** Use GitHub Actions como alternativa

## 📞 Próximos Passos

1. Execute `npm run check-cron-setup` para diagnosticar
2. Configure as variáveis no Vercel se faltarem
3. Teste manualmente com `npm run test-register-winners -- --day=20458`
4. Verifique os logs do Vercel para confirmar execução

