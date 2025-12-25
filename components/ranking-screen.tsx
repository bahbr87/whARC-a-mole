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
      .then(res => res.json())
      .then(data => {
        if (!Array.isArray(data)) {
          setError('Erro: formato de dados inválido da API');
          setPlayers([]);
        } else {
          setPlayers(data);
        }
      })
      .catch(err => {
        console.error(err);
        setError('Erro ao buscar ranking');
        setPlayers([]);
      })
      .finally(() => setLoading(false));
  }, [selectedDate]);

  if (loading) {
    return <p>Carregando ranking...</p>;
  }

  if (error) {
    return <p>{error}</p>;
  }

  if (!players || players.length === 0) {
    return <p>No players found for this day.</p>;
  }

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
