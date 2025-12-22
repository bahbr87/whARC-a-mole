import { NextRequest, NextResponse } from "next/server"
import { Wallet, JsonRpcProvider, Contract } from "ethers"

const GAME_CREDITS_ADDRESS = process.env.GAME_CREDITS_ADDRESS || "0xB6EF59882778d0A245202F1482f20f02ad82bd87"
const META_TRANSACTION_ADDRESS = process.env.META_TRANSACTION_ADDRESS || "0x0000000000000000000000000000000000000000"
const RPC_URL = process.env.RPC_URL || "https://rpc.testnet.arc.network"
const CHAIN_ID = parseInt(process.env.CHAIN_ID || "5042002")
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY || ""

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const player = searchParams.get("player")
    
    if (!player) {
      return NextResponse.json({ error: "Player address required" }, { status: 400 })
    }

    const provider = new JsonRpcProvider(RPC_URL, CHAIN_ID)
    const relayer = new Wallet(RELAYER_PRIVATE_KEY, provider)

    const GAME_CREDITS_ABI = [
      "function owner() external view returns (address)",
      "function authorizedConsumers(address) external view returns (bool)",
      "function credits(address) external view returns (uint256)",
    ]

    const gameCreditsContract = new Contract(
      GAME_CREDITS_ADDRESS,
      GAME_CREDITS_ABI,
      provider
    )

    const owner = await gameCreditsContract.owner()
    const relayerAuthorized = await gameCreditsContract.authorizedConsumers(relayer.address)
    const processorAuthorized = await gameCreditsContract.authorizedConsumers(META_TRANSACTION_ADDRESS)
    const playerCredits = await gameCreditsContract.credits(player)

    return NextResponse.json({
      gameCreditsAddress: GAME_CREDITS_ADDRESS,
      metaTransactionAddress: META_TRANSACTION_ADDRESS,
      relayerAddress: relayer.address,
      owner: owner,
      isRelayerOwner: owner.toLowerCase() === relayer.address.toLowerCase(),
      isRelayerAuthorized: relayerAuthorized,
      isProcessorAuthorized: processorAuthorized,
      player: player,
      playerCredits: playerCredits.toString(),
      rpcUrl: RPC_URL,
      chainId: CHAIN_ID,
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Failed to get debug info",
        message: error.message || "Unknown error",
        stack: error.stack,
      },
      { status: 500 }
    )
  }
}







