# Deployment Guide

## 🌐 Arc Testnet Configuration

- **Chain ID**: `5042002`
- **RPC URL**: `https://rpc.testnet.arc.network`
- **Explorer**: `https://testnet.arcscan.app`
- **⚠️ IMPORTANTE**: Gas é pago em **USDC**, não em ETH!

## 💰 Como Conseguir USDC de Testnet

Para fazer deploy e transações, você precisa de USDC na Arc Testnet:

1. **Acesse o Faucet da Circle**: https://faucet.circle.com
2. **Conecte sua carteira** (MetaMask/Rabby)
3. **Selecione Arc Testnet** (Chain ID: 5042002)
4. **Cole o endereço da sua carteira** e solicite USDC de testnet
5. **Aguarde a confirmação** (pode levar alguns minutos)

**Nota**: Você precisa ter USDC na carteira para pagar as taxas de gas!

## ✅ Wallet Gerada

Uma nova carteira foi gerada e salva em `.env.local`:
- **Address**: `0xA6338636D92e024dBC3541524E332F68c5c811a2`
- **Private Key**: Salva em `.env.local` (NÃO commitar no git!)

## 📋 Próximos Passos para Deploy

### Opção 1: Usar Remix IDE (Recomendado - Mais Fácil)

1. **Acesse Remix IDE**: https://remix.ethereum.org

2. **Crie os arquivos**:
   - Copie `contracts/MockUSDC.sol` para Remix
   - Copie `contracts/PrizePool.sol` para Remix

3. **Compile**:
   - Selecione Solidity 0.8.20
   - Clique em "Compile"

4. **Deploy**:
   - Vá para a aba "Deploy & Run"
   - Conecte sua carteira (MetaMask/Rabby)
   - Selecione "Injected Provider - MetaMask"
   - Mude a rede para Arc Network (Chain ID: 1243)
   - Deploy MockUSDC primeiro
   - Depois deploy PrizePool (passando o endereço do MockUSDC)

5. **Atualize a configuração**:
   - Copie o endereço do MockUSDC
   - Atualize `lib/arc-config.ts` com o endereço
   - Atualize `.env.local` com `USDC_CONTRACT_ADDRESS`

### Opção 2: Usar Hardhat (Requer correção)

Há um problema de compatibilidade com Hardhat. Para resolver:

1. **Instalar versão compatível**:
   ```bash
   npm install --save-dev hardhat@^2.19.0 @nomicfoundation/hardhat-toolbox@^5.0.0
   ```

2. **Compilar**:
   ```bash
   npm run compile
   ```

3. **Deploy**:
   ```bash
   npm run deploy
   ```

## 📝 Contratos Criados

### MockUSDC (`contracts/MockUSDC.sol`)
- Token ERC20 mock para testes (simula USDC)
- 6 decimais (como USDC real)
- Símbolo: mUSDC
- 1,000,000 tokens mintados para o deployer na criação
- Pode ser usado para testar a aplicação completa

### PrizePool (`contracts/PrizePool.sol`)
- Gerencia prêmios diários
- Prêmios: 20, 10, 5 USDC (1º, 2º, 3º lugar)
- Permite que vencedores reivindiquem prêmios

## 🔧 Configuração

Após o deploy, atualize manualmente:
- `lib/arc-config.ts` - Endereço do MockUSDC
- `.env.local` - Adicione `USDC_CONTRACT_ADDRESS=0x...`

## ⚠️ Importante

1. **NUNCA** commite a chave privada no git
2. O arquivo `.env.local` está no `.gitignore`
3. Mantenha a chave privada segura
4. **Gas é pago em USDC, não ETH!** - Use o faucet da Circle: https://faucet.circle.com
5. Certifique-se de ter USDC na carteira antes de fazer deploy
6. Use Remix IDE se tiver problemas com Hardhat

## 🚀 Testando

Após o deploy:
1. Os contratos estarão disponíveis na Arc Network
2. O endereço do MockUSDC será usado pela aplicação
3. Você pode testar a aplicação completa
