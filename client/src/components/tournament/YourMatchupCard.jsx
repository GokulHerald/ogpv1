import clsx from 'clsx';
import { formatPlayerDisplayName, playerInitials } from '../../utils/playerDisplay.js';

function pid(u) {
  if (!u) return null;
  return String(u._id || u);
}

function CompetitorSlot({ userDoc, isYou, isWinner, isLoser, pending }) {
  const name = userDoc ? formatPlayerDisplayName(userDoc) : 'TBD';
  const pendingSlot = !userDoc || pending;

  return (
    <div
      className={clsx(
        'flex flex-1 flex-col items-center rounded-xl border px-4 py-5 text-center transition-colors',
        isYou && 'border-brand-orange/60 bg-brand-orange/10 ring-1 ring-brand-orange/30',
        !isYou && !pendingSlot && 'border-brand-border bg-brand-card',
        pendingSlot && 'border-dashed border-brand-border/80 bg-brand-subtle/20'
      )}
    >
      <div
        className={clsx(
          'flex h-16 w-16 items-center justify-center rounded-full text-xl font-black text-white',
          isYou ? 'bg-brand-orange' : pendingSlot ? 'bg-brand-border text-brand-muted' : 'bg-brand-red'
        )}
      >
        {pendingSlot ? '?' : playerInitials(userDoc)}
      </div>
      {isYou ? (
        <span className="mt-2 text-[10px] font-bold uppercase tracking-widest text-brand-orange">You</span>
      ) : null}
      <p
        className={clsx(
          'mt-2 font-display text-lg font-bold uppercase tracking-wide',
          pendingSlot ? 'text-brand-muted' : 'text-brand-light',
          isLoser && 'line-through opacity-60'
        )}
      >
        {name}
      </p>
      {isWinner ? (
        <span className="mt-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400">Winner</span>
      ) : null}
    </div>
  );
}

export function YourMatchupCard({ match, currentUserId, className }) {
  if (!match || !currentUserId) return null;

  const uid = String(currentUserId);

  if (match.kind === 'br_lobby') {
    const squadCount = match.brTeams?.length ?? 0;
    return (
      <div
        className={clsx(
          'mb-6 rounded-xl border border-violet-500/30 bg-gradient-to-r from-violet-950/40 to-brand-card p-5',
          className
        )}
      >
        <p className="text-center text-[10px] font-bold uppercase tracking-[0.25em] text-violet-300">
          Your lobby
        </p>
        <p className="mt-2 text-center font-display text-xl font-black uppercase text-brand-light">
          Battle royale · {squadCount} squads
        </p>
        <p className="mt-2 text-center text-sm text-brand-muted">
          Everyone in this lobby competes together — check the bracket below for all squads.
        </p>
      </div>
    );
  }

  const p1 = match.player1;
  const p2 = match.player2;
  const p1Id = pid(p1);
  const p2Id = pid(p2);
  const youAreP1 = p1Id && p1Id === uid;
  const youAreP2 = p2Id && p2Id === uid;
  if (!youAreP1 && !youAreP2) return null;

  const you = youAreP1 ? p1 : p2;
  const opponent = youAreP1 ? p2 : p1;
  const winnerId = match.winner ? pid(match.winner) : null;
  const youWon = winnerId && winnerId === uid;
  const youLost = winnerId && winnerId !== uid;

  const roundLabel =
    match.round === 1
      ? 'Round 1'
      : match.roundLabel || `Round ${match.round}`;

  return (
    <div
      className={clsx(
        'mb-6 overflow-hidden rounded-xl border border-brand-red/35 bg-gradient-to-b from-brand-red/10 to-brand-card',
        className
      )}
    >
      <div className="border-b border-brand-border/60 px-4 py-3 text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-brand-muted">Your matchup</p>
        <p className="mt-1 font-display text-sm font-bold uppercase tracking-wider text-brand-light">
          {roundLabel} · Match {match.matchNumber}
        </p>
        {match.status === 'live' ? (
          <span className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold uppercase text-green-400">
            <span className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
            Live now
          </span>
        ) : null}
      </div>

      <div className="flex items-stretch gap-3 p-4 sm:gap-6 sm:p-6">
        <CompetitorSlot
          userDoc={you}
          isYou
          isWinner={youWon}
          isLoser={youLost}
        />
        <div className="flex shrink-0 flex-col items-center justify-center">
          <span className="font-display text-2xl font-black text-brand-red sm:text-3xl">VS</span>
        </div>
        <CompetitorSlot
          userDoc={opponent}
          isYou={false}
          isWinner={winnerId && pid(opponent) === winnerId}
          isLoser={winnerId && pid(opponent) !== winnerId}
          pending={!opponent}
        />
      </div>
    </div>
  );
}
