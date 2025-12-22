# PrizePool Contract Deployment Guide

## 📋 Overview

This guide explains how to deploy the `PrizePool` contract to Arc Testnet.

## 🔧 Prerequisites

1. **Node.js** and **npm** installed
2. **Ethers.js v6** installed: `npm install ethers@^6.0.0`
3. **Private key** with Arc Testnet ETH for gas fees
4. **Compiled contract** (using Hardhat or Foundry)

## 📝 Step 1: Configure Environment

Create or update `.env.local`:

```env
# Your private key (for deployment)
PRIVATE_KEY=your_private_key_here

# (Optional) Address to set as PrizePool owner
# If not set, deployer address will be used
PRIZE_POOL_OWNER=0x...
```

## 📝 Step 2: Compile Contract

Compile the Solidity contract:

```bash
npx hardhat compile
```

This will generate the contract artifacts in `artifacts/contracts/PrizePool.sol/PrizePool.json`.

## 📝 Step 3: Update Contract Addresses

### In `scripts/deploy-prizepool.mjs`:

**Line 20-21:** Verify USDC address (already set correctly):
```javascript
const USDC_ADDRESS = "0x37225a0bC4bc9f2dAA06F535E7B8BC7AB03636c4";
```

**Line 58:** Set owner address (or leave empty to use deployer):
```javascript
const ownerAddress = process.env.PRIZE_POOL_OWNER || wallet.address;
```

## 📝 Step 4: Deploy

Run the deployment script:

```bash
node scripts/deploy-prizepool.mjs
```

## 📝 Step 5: Save Deployment Info

After successful deployment, the script will:
- Save deployment info to `prizepool-deployment.json`
- Display the contract address
- Show next steps

## 📝 Step 6: Update Configuration

### Add to `.env.local`:

```env
PRIZE_POOL_ADDRESS=0x...your_deployed_address...
```

### Update `lib/arc-config.ts` (if needed):

```typescript
export const PRIZE_POOL_ADDRESS = "0x...your_deployed_address...";
```

## 🔍 Verify Deployment

1. Check contract on Arc Testnet Explorer:
   ```
   https://testnet.explorer.arc.network/address/YOUR_CONTRACT_ADDRESS
   ```

2. Verify contract state:
   - USDC address should be: `0x37225a0bC4bc9f2dAA06F535E7B8BC7AB03636c4`
   - Owner should match your specified address
   - Initial balance should be 0 USDC

## 📚 Contract Functions

### For Users:
- `depositPrize(uint256 amount)` - Deposit USDC into prize pool

### For Owner:
- `distributePrize(address winner, uint256 amount)` - Distribute prize to one winner
- `distributePrizesBatch(address[] winners, uint256[] amounts)` - Distribute to multiple winners
- `emergencyWithdraw()` - Emergency withdrawal (owner only)

### View Functions:
- `getPrizePoolBalance()` - Get current USDC balance
- `getPrizesForAddress(address winner)` - Get total prizes for an address
- `totalDeposited` - Total USDC ever deposited
- `totalDistributed` - Total USDC ever distributed

## ⚠️ Important Notes

1. **USDC Decimals**: Arc USDC uses 6 decimals (not 18 like ETH)
   - 1 USDC = 1,000,000 (in smallest unit)
   - Use `ethers.parseUnits("1", 6)` to convert

2. **Gas Fees**: Arc Testnet uses USDC for gas, not ETH
   - Make sure you have USDC in your wallet for transactions

3. **Approval Required**: Before depositing, users must approve the PrizePool contract:
   ```javascript
   await usdcContract.approve(prizePoolAddress, amount);
   ```

## 🐛 Troubleshooting

### "Contract file not found"
- Make sure `contracts/PrizePool.sol` exists
- Run `npx hardhat compile` first

### "Insufficient balance"
- Fund your wallet with Arc Testnet ETH/USDC
- Get testnet tokens from Arc faucet

### "USDC transfer failed"
- Check USDC balance
- Verify approval was given to PrizePool contract
- Ensure amount doesn't exceed balance




