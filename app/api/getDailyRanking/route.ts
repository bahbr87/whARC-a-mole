import { NextResponse } from 'next/server';
import { ethers } from 'ethers';

const RPC_URL = process.env.RPC_URL!;
const CONTRACT_ADDRESS = process.env.GAME_CREDITS_ADDRESS!;

const contractAbi = [
  "event MatchPlayed(address indexed player, uint256 points, uint256 timestamp)"
];

export async function GET() {
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, contractAbi, provider);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const events = await contract.queryFilter(contract.filters.MatchPlayed(), 0, 'latest');

    const rankingMap: Record<string, number> = {};
    events.forEach(e => {
      if ('args' in e && e.args) {
        const ts = Number(e.args.timestamp) * 1000;
        if (ts >= todayStart.getTime() && ts <= todayEnd.getTime()) {
          const player = String(e.args.player).toLowerCase();
          const points = Number(e.args.points);
          if (!isNaN(points)) {
            rankingMap[player] = (rankingMap[player] || 0) + points;
          }
        }
      }
    });

    const ranking = Object.entries(rankingMap)
      .map(([player, totalPoints]) => ({ player, totalPoints }))
      .sort((a, b) => b.totalPoints - a.totalPoints);

    return NextResponse.json(ranking);

  } catch (err) {
    console.error('Erro ao gerar ranking:', err);
    return NextResponse.json({ error: 'Erro ao gerar ranking' }, { status: 500 });
  }
}
