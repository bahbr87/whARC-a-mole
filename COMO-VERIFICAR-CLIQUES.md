# 🔍 Como Verificar se Cada Clique Está Gerando uma Transação na Rede

## Método 1: Script Automático (Recomendado)

Use o script que verifica todas as transações de cliques:

```bash
# Verificar cliques de um jogador específico (últimos 5 minutos)
npx tsx scripts/verify-clicks-onchain.ts 0xSEU_ENDERECO_AQUI 5

# Verificar todos os cliques (últimos 10 minutos)
npx tsx scripts/verify-clicks-onchain.ts 10

# Verificar cliques de um jogador (últimos 30 minutos)
npx tsx scripts/verify-clicks-onchain.ts 0xSEU_ENDERECO_AQUI 30
```

**Exemplo:**
```bash
npx tsx scripts/verify-clicks-onchain.ts 0xB51158878a08a860443B10b2F24617bab5F1F3eA 10
```

O script mostrará:
- ✅ Total de cliques encontrados
- 📤 Hash de cada transação
- 🔗 Link para o ArcScan
- 💰 Créditos usados e restantes
- 📦 Número do bloco
- ⏰ Horário de cada transação

---

## Método 2: ArcScan (Explorer da Rede)

1. **Acesse o ArcScan:**
   - https://testnet.arcscan.app

2. **Verifique o contrato GameCredits:**
   - Endereço: `0xB6EF59882778d0A245202F1482f20f02ad82bd87`
   - Acesse: https://testnet.arcscan.app/address/0xB6EF59882778d0A245202F1482f20f02ad82bd87

3. **Veja os eventos:**
   - Clique em "Events" ou "Logs"
   - Procure por eventos `CreditsConsumed`
   - Cada evento = 1 clique processado on-chain

4. **Filtre por seu endereço:**
   - Use o filtro de eventos
   - Digite seu endereço de wallet
   - Veja apenas seus cliques

---

## Método 3: Console do Navegador

1. **Abra o console do navegador** (F12)
2. **Jogue e clique nos animais**
3. **Procure por estas mensagens:**

```
✅✅✅ CLIQUE PROCESSADO NA BLOCKCHAIN ✅✅✅
   📤 Transaction Hash: 0x...
   🔗 Explorer: https://testnet.arcscan.app/tx/0x...
   💰 Créditos consumidos: 1
```

**Se você vê essas mensagens, cada clique está gerando uma transação!**

---

## Método 4: Verificar Transações do Relayer

O relayer processa todas as transações. Verifique as transações dele:

1. **Endereço do Relayer:**
   - `0xA6338636D92e024dBC3541524E332F68c5c811a2`

2. **No ArcScan:**
   - https://testnet.arcscan.app/address/0xA6338636D92e024dBC3541524E332F68c5c811a2
   - Veja todas as transações enviadas pelo relayer
   - Cada transação para `GameCredits.consumeCredits` = 1 clique

---

## O Que Verificar

✅ **Cada clique deve:**
- Gerar uma transação on-chain
- Emitir um evento `CreditsConsumed`
- Consumir 1 crédito
- Ter um hash de transação único
- Aparecer no ArcScan

❌ **Se não estiver funcionando:**
- Verifique se o relayer está configurado
- Verifique se você tem créditos
- Verifique os logs do console do navegador
- Verifique os logs do servidor (backend)

---

## Exemplo de Saída do Script

```
======================================================================
🔍 VERIFICAÇÃO DE CLIQUES ON-CHAIN
======================================================================

📋 Configuração:
   RPC URL: https://rpc.testnet.arc.network
   Chain ID: 5042002
   GameCredits: 0xB6EF59882778d0A245202F1482f20f02ad82bd87
   Período: últimos 10 minutos

📊 RESUMO:
   Total de cliques encontrados: 15
   Período: 18/12/2024 14:30:00 até 18/12/2024 14:40:00

👥 Cliques por jogador:
   0xb51158878a08a860443b10b2f24617bab5f1f3ea:
      Total de cliques: 15
      Transações: 15
      Créditos usados: 15

📝 ÚLTIMAS 10 TRANSAÇÕES:
   📤 TX: 0x1234...
      Player: 0xb51158878a08a860443b10b2f24617bab5f1f3ea
      Cliques: 1
      Créditos usados: 1
      Créditos restantes: 85
      Bloco: 123456
      Horário: 18/12/2024 14:39:45
      🔗 https://testnet.arcscan.app/tx/0x1234...
```

---

## Dicas

1. **Execute o script enquanto joga** para ver os cliques em tempo real
2. **Use períodos maiores** (30 minutos) se quiser ver histórico
3. **Verifique o ArcScan** para ver detalhes completos de cada transação
4. **Compare o número de cliques** com o número de transações - devem ser iguais!



