import { ethers } from "ethers";

const CONTRACT = "0x41Afb27763416f555207c9B0bB04F08E665b4AFd";
const RPC = "https://rpc.testnet.arc.network";

const ABI = [
  "function owner() view returns (address)"
];

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const contract = new ethers.Contract(CONTRACT, ABI, provider);

  const owner = await contract.owner();
  console.log("OWNER DO CONTRATO:", owner);
}

main();

