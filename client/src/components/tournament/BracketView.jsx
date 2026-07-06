import clsx from 'clsx';
import { EmptyState } from '../ui/EmptyState.jsx';
import { GitBranch } from 'lucide-react';
import { formatPlayerDisplayName, playerInitials } from '../../utils/playerDisplay.js';

function pid(u) {
  if (!u) return null;
  return String(u._id || u);
}

function roundTitle(roundNum, totalRounds) {
  if (totalRounds <= 1) return 'Final';
  if (roundNum === totalRounds) return 'Final';
  if (roundNum === totalRounds - 1) return 'Semi-final';
  if (roundNum === totalRounds - 2) return 'Quarter-final';
  return `Round ${roundNum}`;
}

function BracketMatchCard({ match, currentUserId, isHighlighted }) {
  if (!match) return null;

  if (match.kind === 'br_lobby') {
    const slots = match.brTeams || [];
    return (
      <div
        className={clsx(
          'relative w-[260px] shrink-0 rounded-xl border bg-[#0F0F0F] p-3',
          isHighlighted ? 'border-violet-500/50 ring-1 ring-violet-500/30' : 'border-brand-border'
        )}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-brand-muted">BR lobby</span>
          {match.status === 'live' ? (
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-green-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
              LIVE
            </span>
          ) : null}
        </div>
        <p className="text-xs font-semibold text-brand-light">{slots.length} squads</p>
        <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto text-[11px] text-brand-muted">
          {slots.slice(0, 8).map((slot, idx) => {
            const t = slot.team;
            const label =
              typeof t === 'object' && t != null
                ? t.name?.trim() || t.captain?.username || 'Squad'
                : 'Squad';
            return (
              <li key={`${String(t?._id || t)}-${idx}`} className="truncate">
                {label}
              </li>
            );
          })}
          {slots.length > 8 ? <li className="text-brand-orange">+{slots.length - 8} more…</li> : null}
        </ul>
      </div>
    );
  }

  const { player1, player2, winner, status } = match;
  const w = winner ? pid(winner) : null;
  const p1 = pid(player1);
  const p2 = pid(player2);
  const uid = currentUserId ? String(currentUserId) : null;
  const p1You = uid && p1 && uid === p1;
  const p2You = uid && p2 && uid === p2;
  const p1Win = w && p1 && w === p1;
  const p2Win = w && p2 && w === p2;

  const Row = ({ userDoc, win, lose, isYou, slot }) => {
    const pending = !userDoc;
    const name = pending ? 'TBD' : formatPlayerDisplayName(userDoc);
    const initial = pending ? '?' : playerInitials(userDoc);

    return (
      <div
        className={clsx(
          'flex items-center gap-2 rounded-lg border px-2.5 py-2',
          isYou && 'border-brand-orange/50 bg-brand-orange/10',
          !isYou && !pending && 'border-brand-border bg-brand-card',
          pending && 'border-dashed border-brand-border/70 bg-brand-subtle/15',
          win && 'border-l-[3px] border-l-emerald-500',
          lose && 'opacity-45'
        )}
      >
        <div
          className={clsx(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold',
            isYou ? 'bg-brand-orange text-white' : pending ? 'bg-brand-border text-brand-muted' : 'bg-brand-red text-white'
          )}
        >
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          {isYou ? (
            <span className="text-[9px] font-bold uppercase tracking-wider text-brand-orange">You</span>
          ) : (
            <span className="text-[9px] font-bold uppercase tracking-wider text-brand-muted">{slot}</span>
          )}
          <p
            className={clsx(
              'truncate text-sm font-semibold',
              pending ? 'text-brand-muted' : 'text-brand-light',
              win && 'text-emerald-300',
              lose && 'line-through'
            )}
          >
            {name}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div
      className={clsx(
        'relative w-[240px] shrink-0 rounded-xl border bg-[#0F0F0F] p-3 transition-shadow',
        isHighlighted
          ? 'border-brand-orange/50 shadow-[0_0_24px_rgba(232,57,42,0.15)] ring-1 ring-brand-orange/25'
          : 'border-brand-border'
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-brand-muted">
          M{match.matchNumber}
        </span>
        {status === 'live' ? (
          <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-green-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
            LIVE
          </span>
        ) : null}
      </div>
      <div className="space-y-1.5">
        <Row userDoc={player1} win={p1Win} lose={Boolean(w && p1 && !p1Win)} isYou={p1You} slot="Player 1" />
        <div className="flex items-center gap-2 py-0.5">
          <div className="h-px flex-1 bg-brand-border" />
          <span className="font-display text-[10px] font-black text-brand-red">VS</span>
          <div className="h-px flex-1 bg-brand-border" />
        </div>
        <Row userDoc={player2} win={p2Win} lose={Boolean(w && p2 && !p2Win)} isYou={p2You} slot="Player 2" />
      </div>
    </div>
  );
}

function SvgBetweenColumns({ matchCount }) {
  const h = Math.max(120, matchCount * 88);
  return (
    <div className="flex w-12 shrink-0 items-stretch self-stretch" style={{ minHeight: h }}>
      <svg
        className="h-full w-full text-[#3a3a3a]"
        preserveAspectRatio="none"
        viewBox="0 0 48 200"
        aria-hidden
      >
        <path
          d="M 0 50 L 24 50 L 24 100 L 48 100 M 0 150 L 24 150 L 24 100"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}

export function BracketView({ matches, className, currentUserId, highlightMatchId }) {
  if (!Array.isArray(matches) || matches.length === 0) {
    return (
      <EmptyState
        icon={GitBranch}
        title="No bracket yet"
        description="Matches will appear after the tournament starts."
      />
    );
  }

  const byRound = matches.reduce((acc, m) => {
    const r = m.round ?? 1;
    if (!acc[r]) acc[r] = [];
    acc[r].push(m);
    return acc;
  }, {});

  const rounds = Object.keys(byRound)
    .map(Number)
    .sort((a, b) => a - b);

  const totalRounds = rounds.length ? Math.max(...rounds) : 1;

  return (
    <div className={clsx('rounded-xl bg-[#0A0A0A] p-4', className)}>
      <p className="mb-4 text-center font-display text-xs font-bold uppercase tracking-[0.35em] text-brand-muted">
        Knockout bracket
      </p>
      <div className="bracket-scrollbar overflow-x-auto pb-2">
        <div className="flex min-w-min items-stretch">
          {rounds.map((roundNum, colIdx) => {
            const roundMatches = byRound[roundNum]
              .slice()
              .sort((a, b) => (a.matchNumber || 0) - (b.matchNumber || 0));
            return (
              <div key={roundNum} className="flex items-stretch">
                {colIdx > 0 ? <SvgBetweenColumns matchCount={roundMatches.length} /> : null}
                <div className="flex min-w-[260px] flex-col px-2">
                  <h3 className="font-display mb-6 text-center text-sm font-bold uppercase tracking-[0.2em] text-brand-light">
                    {roundTitle(roundNum, totalRounds)}
                  </h3>
                  <div className="flex flex-1 flex-col justify-around gap-8">
                    {roundMatches.map((match) => (
                      <BracketMatchCard
                        key={match._id}
                        match={match}
                        currentUserId={currentUserId}
                        isHighlighted={highlightMatchId && String(match._id) === String(highlightMatchId)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
