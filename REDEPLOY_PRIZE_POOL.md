# Como Fazer Redeploy do PrizePool com as Novas Mudanças

## Opção 1: Usar Remix IDE (Recomendado - Mais Simples)

### Passo 1: Acessar Remix IDE
1. Acesse: https://remix.ethereum.org
2. Crie um novo arquivo chamado `PrizePool.sol` na pasta `contracts`
3. Copie o conteúdo do arquivo `contracts/PrizePool.sol` do seu projeto

### Passo 2: Compilar
1. Na aba "Solidity Compiler" (ícone de Solidity no menu lateral)
2. Selecione a versão: **0.8.20**
3. Clique em **"Compile PrizePool.sol"**
4. Verifique se não há erros

### Passo 3: Deploy
1. Vá para a aba **"Deploy & Run Transactions"** (ícone de Ethereum)
2. Conecte sua carteira (MetaMask/Rabby)
3. Selecione a rede **Arc Testnet** (Chain ID: 5042002)
4. No campo "CONTRACT", selecione **PrizePool**
5. No campo "Deploy", você precisa passar o endereço do contrato USDC:
   - Se estiver usando MockUSDC: `0x37225a0bC4bc9f2dAA06F535E7B8BC7AB03636c4`
   - Ou o endereço do USDC que você está usando
6. Clique em **"Deploy"**
7. Confirme a transação na sua carteira

### Passo 4: Atualizar Configuração
Após o deploy, atualize o `.env.local`:

```env
PRIZE_POOL_CONTRACT_ADDRESS=0x... (novo endereço do contrato)
NEXT_PUBLIC_PRIZE_POOL_CONTRACT_ADDRESS=0x... (mesmo endereço)
```

### Passo 5: Fundir o PrizePool
O contrato precisa ter USDC para pagar os prêmios. Você pode:
1. Usar o script: `npm run fund-prize-pool`
2. Ou transferir USDC manualmente para o endereço do contrato

## Opção 2: Usar Hardhat (Se Preferir)

Se quiser usar Hardhat, você precisará:
1. Corrigir a configuração do Hardhat para funcionar com ES modules
2. Ou converter o projeto para CommonJS

Mas para MVP, Remix IDE é mais rápido e simples.

## Mudanças no Contrato

As mudanças implementadas permitem:
- ✅ Registrar vencedores com >= 1 jogador (não precisa mais de 3)
- ✅ 2º e 3º lugares podem ser endereços zero se não houver jogadores suficientes
- ✅ Apenas o 1º lugar é obrigatório

## Verificação

Após o redeploy:
1. Reinicie o servidor: `npm run dev`
2. Teste com 1 jogador - deve funcionar
3. Teste com 2 jogadores - deve funcionar
4. Teste com 3+ jogadores - deve funcionar normalmente

