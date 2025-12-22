# 📝 Script de Registro Diário de Vencedores

## 🎯 Objetivo

Este script registra automaticamente os vencedores do dia anterior (UTC) no contrato PrizePool.

## 📋 Pré-requisitos

1. **Variáveis de ambiente** (`.env.local`):
   ```env
   RPC_URL=https://rpc.testnet.arc.network
   PRIZE_POOL_OWNER_PRIVATE_KEY=0x...
   PRIZE_POOL_CONTRACT_ADDRESS=0xB98b8A9213072903277B9f592009E7C22acd2dd3
   ```

2. **Arquivo de rankings** (`data/rankings.json`):
   - Deve conter os rankings do jogo
   - Formato: array de objetos com `player`, `score`, `goldenMoles`, `errors`, `timestamp`

## 🚀 Como Usar

### Executar manualmente:
```bash
npm run register-winners
```

### Agendar execução diária (cron):
```bash
# Executar todo dia às 00:05 UTC (5 minutos após meia-noite)
5 0 * * * cd /caminho/do/projeto && npm run register-winners
```

## 📊 O que o script faz:

1. **Calcula o dia anterior (UTC)**
   - Sempre fecha o dia anterior, não o dia atual
   - Exemplo: Se hoje é 16/12, registra vencedores de 15/12

2. **Lê rankings do arquivo**
   - Filtra rankings do dia específico
   - Agrega scores por jogador (soma múltiplas partidas)
   - Ordena por: score → goldenMoles → errors → timestamp

3. **Calcula vencedores progressivos**
   - 1 jogador → apenas 1º lugar
   - 2 jogadores → 1º e 2º lugares
   - 3+ jogadores → 1º, 2º e 3º lugares

4. **Validações**
   - ✅ Verifica se wallet é owner do contrato
   - ✅ Verifica se vencedores já estão registrados (`isWinnersRegistered`)
   - ✅ Valida todos os endereços (não zero, não duplicados)
   - ✅ Array size = exatamente `min(totalPlayers, 3)`

5. **Registra no contrato**
   - Chama `setDailyWinnersArray(day, winners)`
   - Aguarda confirmação da transação
   - Mostra hash da transação e link do explorer

## 🔍 Exemplo de Saída

```
🚀 Iniciando registro diário de vencedores
📅 Dia UTC: 2025-12-15
🧮 Days since epoch: 20073
🔑 Wallet: 0x...
✅ Wallet confirmada como owner do contrato
🏆 Vencedores: [ '0x1111...', '0x2222...', '0x3333...' ]
   Total: 3 jogador(es)
⛓️ Enviando transação...
📤 TX enviada: 0x...
⏳ Aguardando confirmação...
✅ Vencedores registrados com sucesso!
🔗 Explorer: https://testnet.arcscan.app/tx/0x...
```

## ⚠️ Observações

- **Sempre fecha o dia anterior**: O script sempre registra vencedores do dia anterior (UTC)
- **Não registra duplicado**: Se vencedores já estão registrados, o script para sem erro
- **Valida tudo antes**: Todas as validações são feitas antes de enviar a transação
- **Usa a mesma função de data**: `getDaysSinceEpochUTC()` é a mesma usada no frontend/backend

## 🐛 Troubleshooting

### Erro: "PRIZE_POOL_OWNER_PRIVATE_KEY não configurado"
- Verifique se a variável está no `.env.local`
- Verifique se começa com `0x`

### Erro: "Wallet não é o owner do contrato"
- Use a chave privada da wallet que é owner do contrato PrizePool
- Verifique o owner do contrato: `await prizePool.owner()`

### Erro: "Nenhum jogador no dia"
- Verifique se há rankings no arquivo `data/rankings.json`
- Verifique se os timestamps estão corretos (UTC)

### Erro: "Vencedores já registrados"
- Isso é normal se o script já foi executado para aquele dia
- O script para sem erro neste caso

