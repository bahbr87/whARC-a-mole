# 🎯 Fluxo Completo do Sistema de Prêmios

## 📋 Visão Geral

```
JOGO → eventos / scores
      ↓
BACKEND (fecha o dia UTC)
      ↓
setDailyWinners*
      ↓
CONTRATO
      ↓
Jogador → claimPrize()
```

---

## 1️⃣ JOGO → Eventos / Scores

**Onde:** `components/game-screen.tsx`

**O que acontece:**
- Jogador joga o jogo Whac-A-Mole
- Cada clique gera um evento (via meta-transaction)
- Scores são calculados e salvos em `data/rankings.json`
- Cada entrada tem: `player`, `score`, `goldenMoles`, `errors`, `timestamp`

**Formato do ranking:**
```json
{
  "player": "0x...",
  "score": 150,
  "goldenMoles": 5,
  "errors": 2,
  "timestamp": 1734567890000
}
```

---

## 2️⃣ BACKEND (Fecha o Dia UTC)

**Onde:** `app/api/register-daily-winners/route.ts`

**Quando:** Executado manualmente pelo admin OU automaticamente quando necessário

**O que acontece:**
1. Lê todos os rankings de `data/rankings.json`
2. Filtra rankings do dia específico (UTC, start of day)
3. Agrega scores por jogador (soma múltiplas partidas)
4. Ordena por: score → goldenMoles → errors → timestamp
5. Calcula vencedores progressivos:
   - 1 jogador → apenas 1º lugar
   - 2 jogadores → 1º e 2º lugares
   - 3+ jogadores → 1º, 2º e 3º lugares

**Cálculo do day:**
```typescript
const day = getDaysSinceEpochUTC(date) // Mesma função usada em TODO lugar
```

**Validações:**
- ✅ Verifica se wallet é owner do contrato
- ✅ Verifica se vencedores já estão registrados (`isWinnersRegistered`)
- ✅ Valida todos os endereços (não zero, não duplicados)
- ✅ Array size = exatamente `min(totalPlayers, 3)`

---

## 3️⃣ setDailyWinners*

**Onde:** `app/api/register-daily-winners/route.ts` → `contracts/PrizePool.sol`

**Função do contrato:**
```solidity
function setDailyWinnersArray(
    uint256 date,  // daysSinceEpoch UTC
    address[] calldata winners  // Array dinâmico (1-3 endereços)
) external onlyOwner
```

**O que acontece:**
1. Valida que `winners.length > 0 && winners.length <= 3`
2. Valida que não está duplicado (`dailyWinners[date][1] == address(0)`)
3. Valida todos os endereços (não zero, não duplicados)
4. Registra no mapping: `dailyWinners[date][rank] = winner`
5. Emite evento `WinnersSet`

**Exemplo:**
```typescript
// 1 jogador
await prizePool.setDailyWinnersArray(20073, ["0xPlayer1"])

// 2 jogadores
await prizePool.setDailyWinnersArray(20073, ["0xPlayer1", "0xPlayer2"])

// 3 jogadores
await prizePool.setDailyWinnersArray(20073, ["0xPlayer1", "0xPlayer2", "0xPlayer3"])
```

---

## 4️⃣ CONTRATO

**Onde:** `contracts/PrizePool.sol`

**Storage:**
```solidity
mapping(uint256 => mapping(uint256 => address)) public dailyWinners;
// dailyWinners[day][rank] = winner address
```

**Funções disponíveis:**
- `getWinner(uint256 date, uint256 rank) view returns (address)`
- `isWinnersRegistered(uint256 date) view returns (bool)`
- `claimPrize(uint256 date, uint256 rank) external`

**Validações no contrato:**
- ✅ Rank deve ser 1, 2 ou 3
- ✅ Prêmio não pode ter sido reivindicado (`!prizesClaimed[date][rank]`)
- ✅ Vencedor deve estar registrado (`dailyWinners[date][rank] != address(0)`)
- ✅ Chamador deve ser o vencedor (`dailyWinners[date][rank] == msg.sender`)
- ✅ Contrato deve ter saldo suficiente

---

## 5️⃣ Jogador → claimPrize()

**Onde:** `app/page.tsx` → `handleClaimPrize`

**Fluxo:**
1. Jogador clica em "Reivindicar Prêmio" no frontend
2. Frontend calcula `day = getDaysSinceEpochUTC(date)` (mesma função do backend)
3. Frontend verifica `onchainWinner = await contract.getWinner(day, rank)`
4. Frontend compara `signerAddress === onchainWinner`
5. Se match → chama `contract.claimPrize(day, rank)`
6. Contrato valida tudo internamente
7. Contrato transfere USDC para o jogador
8. Contrato marca como reivindicado (`prizesClaimed[date][rank] = true`)

**Logs de debug:**
```javascript
// No botão (daily-results-screen.tsx)
console.log("CLAIM FINAL CHECK", {
  day,
  rank,
  walletUI: currentPlayer,
  walletSigner: await signer.getAddress(),
  onchainWinner,
  match: onchainWinner.toLowerCase() === walletSigner.toLowerCase(),
})

// No handleClaimPrize (app/page.tsx)
console.log("CLAIM DEBUG FINAL", {
  day,
  rank,
  wallet: currentWallet,
  onchainWinner,
  match: currentWallet.toLowerCase() === onchainWinner.toLowerCase(),
})
```

---

## 🎯 Regra de Ouro

**O mesmo `day` (daysSinceEpoch UTC) deve ser usado em:**
- ✅ Backend ao registrar vencedores
- ✅ Contrato ao armazenar vencedores
- ✅ Frontend ao fazer claim

**Função única:**
```typescript
export function getDaysSinceEpochUTC(date: Date): number {
  const utc = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    0, 0, 0, 0
  )
  return Math.floor(utc / (1000 * 60 * 60 * 24))
}
```

**Se isso for respeitado, o claim NUNCA quebra.**

---

## ✅ Checklist de Validação

- [ ] Backend usa `getDaysSinceEpochUTC()` para calcular `day`
- [ ] Frontend usa `getDaysSinceEpochUTC()` para calcular `day`
- [ ] Contrato recebe `day` como `uint256` (days since epoch)
- [ ] `setDailyWinnersArray` é chamado apenas uma vez por dia
- [ ] Validação `isWinnersRegistered` antes de registrar
- [ ] Validação `onchainWinner === signerAddress` antes de claim
- [ ] Logs de debug mostram `match === true` quando deve funcionar
- [ ] Array de vencedores não contém zero address
- [ ] Array size = exatamente `min(totalPlayers, 3)`

---

## 🚨 Problemas Comuns

### "Not the winner for this rank"
- **Causa:** `day` calculado diferente no backend vs frontend
- **Solução:** Usar `getDaysSinceEpochUTC()` em TODO lugar

### "Winners already set for this date"
- **Causa:** Tentando registrar vencedores duas vezes no mesmo dia
- **Solução:** Verificar `isWinnersRegistered` antes de registrar

### "No winner set for this rank"
- **Causa:** Vencedor não foi registrado para aquele rank
- **Solução:** Verificar se o backend registrou corretamente

### "Insufficient contract balance"
- **Causa:** PrizePool não tem USDC suficiente
- **Solução:** Depositar USDC no contrato via `depositUSDC()`

