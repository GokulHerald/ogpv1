import clsx from 'clsx';
import { User } from 'lucide-react';
import { Badge } from '../ui/Badge.jsx';
import { formatPlayerDisplayName } from '../../utils/playerDisplay.js';

const statusVariant = {
  pending: 'gray',
  live: 'orange',
  completed: 'green',
  walkover: 'red',
};

function Player({ userDoc, slotLabel }) {
  const name = formatPlayerDisplayName(userDoc);
  return (
    <div className="flex items-center gap-2 rounded-lg border border-brand-border bg-brand-subtle/50 px-3 py-2">
      <User className="h-4 w-4 shrink-0 text-brand-muted" />
      <div className="min-w-0">
        <p className="text-xs text-brand-muted">{slotLabel}</p>
        <p className="truncate font-medium text-brand-light">{name}</p>
      </div>
    </div>
  );
}

export function MatchCard({ match, className }) {
  if (!match) return null;
  const { round, matchNumber, player1, player2, status, winner } = match;

  return (
    <div className={clsx('card-surface p-5', className)}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-brand-muted">
          Round {round} · Match {matchNumber}
        </span>
        <Badge variant={statusVariant[status] || 'gray'}>{status}</Badge>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Player userDoc={player1} slotLabel="Competitor A" />
        <Player userDoc={player2} slotLabel="Competitor B" />
      </div>
      {winner ? (
        <p className="mt-3 text-sm text-brand-muted">
          Winner:{' '}
          <span className="font-semibold text-brand-light">{formatPlayerDisplayName(winner) || '—'}</span>
        </p>
      ) : null}
    </div>
  );
}
