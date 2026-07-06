import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTournaments } from '../hooks/useTournaments.js';
import { getGlobalLeaderboard } from '../api/match.api.js';
import { formatPlayerDisplayName } from '../utils/playerDisplay.js';
import { LoadingSpinner } from '../components/ui/LoadingSpinner.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { BarChart2, Trophy } from 'lucide-react';
import { Badge } from '../components/ui/Badge.jsx';

function GlobalLeaderboard() {
  const [players, setPlayers] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getGlobalLeaderboard({ limit: 50 })
      .then(({ data }) => setPlayers(data.players || []))
      .catch((e) => setError(e.response?.data?.message || 'Failed to load global ranking'));
  }, []);

  return (
    <section className="mb-14">
      <div className="flex items-center gap-2">
        <Trophy className="h-6 w-6 text-brand-orange" aria-hidden />
        <h2 className="font-display text-2xl font-black uppercase tracking-tight text-brand-light">
          Top players
        </h2>
      </div>
      <p className="mt-1 text-sm text-brand-muted">Career points across every tournament.</p>

      {error ? (
        <p className="mt-4 text-sm text-red-400">{error}</p>
      ) : players === null ? (
        <div className="flex justify-center py-10">
          <LoadingSpinner />
        </div>
      ) : !players.length ? (
        <p className="mt-4 text-sm text-brand-muted">No points earned yet.</p>
      ) : (
        <div className="card-surface mt-4 overflow-x-auto p-4">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="border-b border-brand-border text-xs uppercase tracking-wider text-brand-muted">
                <th className="pb-2 pr-4">#</th>
                <th className="pb-2 pr-4">Player</th>
                <th className="pb-2 pr-4">Points</th>
                <th className="pb-2 pr-4">Wins</th>
                <th className="pb-2 pr-4">Matches</th>
                <th className="pb-2">Tournaments</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p) => (
                <tr key={p.playerId} className="border-b border-brand-border/60">
                  <td className="py-2 pr-4 text-brand-muted">{p.rank}</td>
                  <td className="py-2 pr-4 font-semibold text-brand-light">
                    {formatPlayerDisplayName(p.player) !== 'TBD'
                      ? formatPlayerDisplayName(p.player)
                      : p.playerId.slice(-6)}
                  </td>
                  <td className="py-2 pr-4 font-semibold text-brand-orange">{p.points}</td>
                  <td className="py-2 pr-4 text-brand-light">{p.wins}</td>
                  <td className="py-2 pr-4 text-brand-light">{p.matchesPlayed}</td>
                  <td className="py-2 text-brand-light">{p.tournaments}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

const statusVariant = {
  registration: 'orange',
  ongoing: 'green',
  completed: 'gray',
  cancelled: 'red',
};

export function LeaderboardPage() {
  const { data, loading, error } = useTournaments({ status: 'completed', limit: 50, page: 1 });
  const list = data?.tournaments || [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="font-display text-3xl font-black uppercase tracking-tight text-brand-light">Leaderboards</h1>
      <p className="mt-2 text-brand-muted">Career rankings, plus standings for completed tournaments.</p>

      <GlobalLeaderboard />

      <h2 className="font-display text-2xl font-black uppercase tracking-tight text-brand-light">
        Completed tournaments
      </h2>

      {loading ? (
        <div className="flex justify-center py-20">
          <LoadingSpinner size="lg" />
        </div>
      ) : error ? (
        <p className="mt-8 text-center text-red-400">{error}</p>
      ) : !list.length ? (
        <div className="mt-12">
          <EmptyState
            icon={BarChart2}
            title="No completed tournaments yet"
            description="Once a tournament is completed, it will appear here with its final standings."
          />
        </div>
      ) : (
        <ul className="mt-10 space-y-3">
          {list.map((t) => (
            <li key={t._id}>
              <Link
                to={`/tournaments/${t._id}`}
                className="card-surface flex flex-wrap items-center justify-between gap-3 p-4 transition-all hover:shadow-glow-red"
              >
                <div>
                  <p className="font-display text-lg font-bold text-brand-light">{t.name}</p>
                  <p className="text-sm text-brand-orange">{t.game}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={statusVariant[t.status] || 'gray'}>{t.status}</Badge>
                  <span className="text-sm font-semibold text-brand-muted">View →</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
