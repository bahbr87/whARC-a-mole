import { ethers } from "ethers";

const RPC_URL = "https://rpc.testnet.arc.network"; // arc testnet
const CONTRACT = "0x41Afb27763416f555207c9B0bB04F08E665b4AFd"; // novo contrato
const ABI = [
  "function credits(address) view returns (uint256)"
];

const PLAYER = "0xB51158878a08a860443B10b2F24617bab5F1F3eA";

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const contract = new ethers.Contract(CONTRACT, ABI, provider);

  const balance = await contract.credits(PLAYER);
  console.log(`Saldo de ${PLAYER}:`, balance.toString());
}

main().catch(console.error);

