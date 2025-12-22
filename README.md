# whARC-a-mole Game

A blockchain arcade game built on Arc Network where players compete daily for USDC prizes!

## 🌐 Arc Testnet Configuration

- **Chain ID**: `5042002`
- **RPC URL**: `https://rpc.testnet.arc.network`
- **Explorer**: `https://testnet.arcscan.app`
- **⚠️ IMPORTANT**: Gas is paid in **USDC**, not ETH!

## 💰 Getting Testnet USDC

To deploy contracts and make transactions, you need USDC on Arc Testnet:

1. **Visit Circle Faucet**: https://faucet.circle.com
2. **Connect your wallet** (MetaMask/Rabby)
3. **Select Arc Testnet** (Chain ID: 5042002)
4. **Enter your wallet address** and request testnet USDC
5. **Wait for confirmation** (may take a few minutes)

**Note**: You need USDC in your wallet to pay for gas fees!

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- MetaMask or Rabby wallet
- USDC on Arc Testnet (from faucet)

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

### Generate Deployer Wallet

```bash
npm run generate-wallet
```

This will create a new wallet and save it to `.env.local`.

### Deploy Contracts

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

## 🎮 How to Play

1. Connect your Arc wallet
2. Choose a difficulty level (Easy, Medium, Hard)
3. Click on moles to score points, avoid cows!
4. Catch golden moles for bonus points
5. Compete for daily prizes: 20, 10, 5 USDC

## 📝 Features

- Daily rankings with UTC timezone
- Prize claiming system (7-day window)
- Multiple wallet support (MetaMask, Rabby, Coinbase, Trust)
- Pause/resume game functionality
- Difficulty-based scoring system

## 🔧 Configuration

Copy `.env.example.txt` to `.env.local` and configure:

```env
NEXT_PUBLIC_API_URL=/api
USDC_CONTRACT_ADDRESS=0x... (after deployment)
```

## 📚 Documentation

- [Deployment Guide](./DEPLOYMENT.md)
- [Arc Network Docs](https://docs.arc.network/)

## ⚠️ Important Notes

- Gas fees are paid in USDC (not ETH) on Arc Network
- Get testnet USDC from: https://faucet.circle.com
- Never commit private keys to git
- This is a testnet deployment







