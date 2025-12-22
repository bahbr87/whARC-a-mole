import { ethers } from "ethers";

const RPC_URL = "https://rpc.testnet.arc.network";
const USDC_ADDRESS = "0x37225a0bC4bc9f2dAA06F535E7B8BC7AB03636c4"; // USDC Arc Testnet
const ADDRESS_TO_CHECK = "0xA6338636D92e024dBC3541524E332F68c5c811a2";

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);

  const usdc = new ethers.Contract(
    USDC_ADDRESS,
    [
      "function balanceOf(address) view returns (uint256)",
      "function decimals() view returns (uint8)"
    ],
    provider
  );

  const decimals = await usdc.decimals();
  const balance = await usdc.balanceOf(ADDRESS_TO_CHECK);
  const formattedBalance = ethers.formatUnits(balance, decimals);

  console.log("💰 Saldo de USDC:");
  console.log("   Endereço:", ADDRESS_TO_CHECK);
  console.log("   Saldo:", formattedBalance, "USDC");
  console.log("   Saldo (raw):", balance.toString());
}

main().catch(console.error);




