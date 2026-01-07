// Arc Network Configuration (Testnet)
// Based on https://docs.arc.network/
// IMPORTANT: Gas is paid in USDC (not ETH) on Arc Network

export const ARC_NETWORK = {
  chainId: 5042002, // Arc Testnet Chain ID
  name: "Arc Testnet",
  currency: "USDC", // Gas is paid in USDC, not ETH
  rpcUrls: {
    default: {
      http: ["https://rpc.testnet.arc.network"],
    },
  },
  blockExplorers: {
    default: {
      name: "Arc Testnet Explorer",
      url: "https://testnet.arcscan.app",
    },
  },
}

// USDC Token Contract Address on Arc Testnet
// Official Arc Testnet USDC: 0x3600000000000000000000000000000000000000
// You can override this with NEXT_PUBLIC_USDC_CONTRACT_ADDRESS environment variable
export const USDC_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_USDC_CONTRACT_ADDRESS || "0x3600000000000000000000000000000000000000"

// ABI for ERC20 functions
export const ERC20_ABI = [
  {
    constant: false,
    inputs: [
      { name: "_to", type: "address" },
      { name: "_value", type: "uint256" },
    ],
    name: "transfer",
    outputs: [{ name: "", type: "bool" }],
    payable: false,
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    constant: true,
    inputs: [{ name: "_owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "balance", type: "uint256" }],
    type: "function",
  },
  {
    constant: false,
    inputs: [
      { name: "_spender", type: "address" },
      { name: "_value", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    payable: false,
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    constant: true,
    inputs: [
      { name: "_owner", type: "address" },
      { name: "_spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
] as const


// GameCredits Contract Address
// Can be overridden with NEXT_PUBLIC_GAME_CREDITS_ADDRESS environment variable
export const GAME_CREDITS_ADDRESS = process.env.NEXT_PUBLIC_GAME_CREDITS_ADDRESS || "0x531Ba20fB57fb9Efe6b8f5c7Cbf29248A7B3D5cF"

// OLD GAME CREDITS CONTRACT (players still have credits here)
// DO NOT DELETE
// 0xB6EF59882778d0A245202F1482f20f02ad82bd87
