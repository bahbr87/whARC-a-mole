# 🔐 Guia de Configuração do Relayer

Este guia explica como configurar o relayer para processar transações na blockchain.

## ✅ Passo 1: Configurar .env.local

O arquivo `.env.local` já está configurado com:

- ✅ `RELAYER_PRIVATE_KEY` - Chave privada do relayer
- ✅ `RELAYER_ADDRESS` - Endereço do relayer: `0xA6338636D92e024dBC3541524E332F68c5c811a2`
- ✅ `GAME_CREDITS_ADDRESS` - Endereço do contrato: `0xB6EF59882778d0A245202F1482f20f02ad82bd87`
- ✅ `RPC_URL` - URL do RPC: `https://rpc.testnet.arc.network`
- ✅ `CHAIN_ID` - ID da chain: `5042002`

## 💰 Passo 2: Fundar o Relayer com USDC

O relayer precisa de USDC para pagar as taxas de gas:

1. **Acesse o Faucet da Circle**: https://faucet.circle.com
2. **Conecte sua carteira** (MetaMask/Rabby)
3. **Selecione Arc Testnet** (Chain ID: 5042002)
4. **Cole o endereço do relayer**: `0xA6338636D92e024dBC3541524E332F68c5c811a2`
5. **Solicite USDC de testnet**
6. **Aguarde a confirmação** (pode levar alguns minutos)

⚠️ **IMPORTANTE**: Na Arc Network, o gas é pago em **USDC**, não em ETH!

## 🔑 Passo 3: Autorizar o Relayer no Contrato

Você precisa autorizar o relayer no contrato GameCredits. Há duas opções:

### Opção A: Usar o Script Automático (Recomendado)

Se você é o owner do contrato:

```bash
npm run authorize-relayer
```

O script irá:
- Verificar se o relayer já está autorizado
- Autorizar automaticamente se você for o owner
- Verificar a autorização após a transação

### Opção B: Autorizar Manualmente via Remix IDE

1. **Acesse Remix IDE**: https://remix.ethereum.org
2. **Conecte sua carteira** (deve ser o owner do contrato)
3. **Selecione Arc Testnet** (Chain ID: 5042002)
4. **Importe o contrato GameCredits** no endereço: `0xB6EF59882778d0A245202F1482f20f02ad82bd87`
5. **Chame a função `authorizeConsumer`** com o parâmetro:
   ```
   0xA6338636D92e024dBC3541524E332F68c5c811a2
   ```
6. **Confirme a transação**

### Opção C: Verificar se Relayer é Owner

Se o relayer já é o owner do contrato, ele pode se autorizar:

```bash
npm run authorize-relayer
```

## ✅ Passo 4: Verificar Configuração

Após autorizar, você pode verificar se está tudo correto:

1. **Reinicie o servidor Next.js**:
   ```bash
   npm run dev
   ```

2. **Teste o jogo** - cada clique deve gerar uma transação real na blockchain

3. **Verifique os logs do servidor** - você verá:
   ```
   ✅ TRANSACTION CONFIRMED
      Hash: 0x...
      Block: 12345
   ```

## 🔍 Verificação de Status

Para verificar o status do relayer:

```bash
npm run authorize-relayer
```

O script mostrará:
- ✅ Se o relayer está autorizado
- ✅ Se o relayer é o owner
- ✅ Saldo da carteira do relayer

## ❌ Troubleshooting

### Erro: "Relayer not authorized"

**Solução**: Execute `npm run authorize-relayer` ou autorize manualmente via Remix.

### Erro: "Insufficient funds for gas"

**Solução**: Funde o relayer com USDC no faucet: https://faucet.circle.com

### Erro: "Wallet is not the owner"

**Solução**: Use a carteira do owner para autorizar o relayer, ou autorize manualmente via Remix.

## 📝 Informações Importantes

- **Relayer Address**: `0xA6338636D92e024dBC3541524E332F68c5c811a2`
- **GameCredits Contract**: `0xB6EF59882778d0A245202F1482f20f02ad82bd87`
- **Explorer**: https://testnet.arcscan.app
- **Faucet**: https://faucet.circle.com

## 🎮 Após Configuração

Quando tudo estiver configurado:

1. ✅ Cada clique no jogo gerará uma transação real na blockchain
2. ✅ Os créditos serão consumidos corretamente no contrato
3. ✅ Você verá os hashes das transações nos logs
4. ✅ As transações aparecerão no explorer: https://testnet.arcscan.app

