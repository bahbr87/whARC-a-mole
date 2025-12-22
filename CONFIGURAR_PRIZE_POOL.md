# Como Configurar o PrizePool Owner

Para que o sistema possa registrar automaticamente os vencedores no contrato PrizePool, você precisa configurar a chave privada do owner do contrato.

## 📋 Passo a Passo

### 1. Identificar o Owner do Contrato

O owner do contrato PrizePool é o endereço que fez o deploy. De acordo com o `deployment.json`:
- **Owner Address**: `0xA6338636D92e024dBC3541524E332F68c5c811a2`

### 2. Obter a Chave Privada

Você precisa da chave privada da carteira que fez o deploy do contrato. Se você não tem mais essa chave:

**Opção A: Se você tem acesso à carteira (MetaMask/Rabby)**
1. Abra sua carteira
2. Vá em "Detalhes da Conta" ou "Exportar Conta"
3. Copie a chave privada (começa com `0x`)

**Opção B: Se você perdeu a chave privada**
- Você precisará fazer o deploy de um novo contrato PrizePool
- Ou transferir a ownership do contrato para uma nova carteira

### 3. Adicionar ao .env.local

Abra o arquivo `.env.local` na raiz do projeto e adicione:

```env
PRIZE_POOL_OWNER_PRIVATE_KEY=0xSUA_CHAVE_PRIVADA_AQUI
PRIZE_POOL_CONTRACT_ADDRESS=0xB98b8A9213072903277B9f592009E7C22acd2dd3
NEXT_PUBLIC_PRIZE_POOL_CONTRACT_ADDRESS=0xB98b8A9213072903277B9f592009E7C22acd2dd3
```

**⚠️ IMPORTANTE:**
- NUNCA commite a chave privada no git!
- O arquivo `.env.local` já está no `.gitignore`
- Mantenha essa chave segura e privada

### 4. Verificar se a Carteira tem USDC

A carteira owner precisa ter USDC na Arc Testnet para pagar as taxas de gas:
1. Acesse: https://faucet.circle.com
2. Conecte a carteira owner
3. Solicite USDC de testnet

### 5. Reiniciar o Servidor

Após adicionar a configuração, reinicie o servidor:

```bash
npm run dev
```

## ✅ Verificação

Após configurar, quando um vencedor clicar em "Reivindicar Prêmio":
1. O sistema registrará automaticamente os vencedores (se ainda não estiverem registrados)
2. Depois executará o claim automaticamente
3. Todo o processo é automático - o jogador só precisa clicar em "Reivindicar Prêmio"

## 🔍 Troubleshooting

**Erro: "PrizePool owner private key not configured"**
- Verifique se `PRIZE_POOL_OWNER_PRIVATE_KEY` está no `.env.local`
- Verifique se a chave começa com `0x`
- Reinicie o servidor após adicionar

**Erro: "Transaction failed"**
- Verifique se a carteira owner tem USDC suficiente
- Verifique se a chave privada está correta
- Verifique os logs do servidor para mais detalhes

**Erro: "Not enough players"**
- O sistema suporta distribuição progressiva: 1 jogador (1º lugar), 2 jogadores (1º e 2º), 3+ jogadores (1º, 2º e 3º)
- Verifique se os rankings estão sendo salvos corretamente

