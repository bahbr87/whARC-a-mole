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

    fetch(`/api/getDailyRanking?date=${selectedDate}`)
      .then(async res => {
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
        if (data && typeof data === 'object' && 'players' in data && Array.isArray(data.players)) {
          setPlayers(data.players);
        } else if (Array.isArray(data)) {
          setPlayers(data);
        } else {
          setError('Erro: formato de dados inválido da API');
          setPlayers([]);
        }
      })
      .catch(err => {
        setError(err.message || 'Erro ao buscar ranking');
        setPlayers([]);
      })
      .finally(() => setLoading(false));
  }, [selectedDate]);

  return (
    <div>
      <h2>Ranking de {selectedDate}</h2>

      {loading && <p>Carregando ranking...</p>}

      {error && <p>{error}</p>}

      {!loading && !error && (
        <>
          {players.length === 0 ? (
            <p>No players found for this day.</p>
          ) : (
            <ul>
              {players.map((p, index) => (
                <li key={index}>
                  <strong>{p.player}</strong> — {p.totalPoints} pts
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
