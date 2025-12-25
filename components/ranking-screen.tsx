'use client';

import { useEffect, useState } from 'react';

type Player = {
  player: string;
  totalPoints: number;
};

type RankingScreenProps = {
  selectedDate: string; // formato 'YYYY-MM-DD'
};

export default function RankingScreen({ selectedDate }: RankingScreenProps) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    console.log('[RANKING-SCREEN] Fetching ranking for date:', selectedDate);

    fetch(`/api/getDailyRanking?date=${selectedDate}`)
      .then(async res => {
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${res.status}: ${res.statusText}`);
        }
        return res.json();
      })
      .then(data => {
        console.log('[RANKING-SCREEN] Response received:', data);
        
        // Handle new consistent format: { date: "YYYY-MM-DD", players: [...] }
        if (data && typeof data === 'object' && 'players' in data && Array.isArray(data.players)) {
          setPlayers(data.players);
          if (data.error) {
            console.warn('[RANKING-SCREEN] API returned error but also data:', data.error);
            setError(data.error);
          }
        } 
        // Fallback: handle old format (array directly) for backward compatibility
        else if (Array.isArray(data)) {
          console.warn('[RANKING-SCREEN] Received old format (array), converting...');
          setPlayers(data);
        } 
        else {
          console.error('[RANKING-SCREEN] Invalid response format:', data);
          setError('Erro: formato de dados inválido da API');
          setPlayers([]);
        }
      })
      .catch(err => {
        console.error('[RANKING-SCREEN] Fetch error:', err);
        setError(err.message || 'Erro ao buscar ranking');
        setPlayers([]);
      })
      .finally(() => setLoading(false));
  }, [selectedDate]);

  if (loading) return <p>Carregando ranking...</p>;
  if (error) return <p>{error}</p>;
  if (!players || players.length === 0) return <p>No players found for this day.</p>;

  return (
    <div>
      <h2>Ranking de {selectedDate}</h2>
      <ul>
        {players.map((p, index) => (
          <li key={index}>
            <strong>{p.player}</strong> — {p.totalPoints} pts
          </li>
        ))}
      </ul>
    </div>
  );
}
