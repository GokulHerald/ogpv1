import { formatPlayerDisplayName } from '../../utils/playerDisplay.js';

/**
 * Shows who has registered for a tournament.
 * Squad (BR) tournaments list teams + members; for a registered player these
 * are the squads they'll face. Solo tournaments list individual players.
 */
export function ParticipantsList({ tournament }) {
  const isSquad = tournament.format === 'battle_royale_squad';

  if (isSquad) {
    const teams = tournament.registeredTeams || [];
    const pool = tournament.soloPool || [];
    if (!teams.length && !pool.length) {
      return <p className="text-sm text-brand-muted">No squads registered yet.</p>;
    }
    return (
      <div className="space-y-4">
        {teams.length ? (
          <ul className="space-y-3">
            {teams.map((t, ti) => {
              const members = [t.captain, ...(t.members || [])].filter(Boolean);
              return (
                <li key={t?._id || ti} className="rounded-lg border border-brand-border bg-brand-subtle/20 p-3">
                  <p className="font-semibold text-brand-light">
                    {t.name?.trim() || t.captain?.username || `Squad ${ti + 1}`}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-brand-muted">
                    {members.map((m, mi) => (
                      <span key={m?._id || mi}>
                        {formatPlayerDisplayName(m)}
                        {mi === 0 ? ' (captain)' : ''}
                      </span>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}

        {pool.length ? (
          <div>
            <p className="text-xs uppercase tracking-wider text-brand-muted">
              Solo players — auto-grouped into squads at start ({pool.length})
            </p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {pool.map((p, i) => (
                <li
                  key={p?._id || i}
                  className="rounded-full border border-brand-orange/30 bg-brand-orange/5 px-3 py-1 text-sm text-brand-light"
                >
                  {formatPlayerDisplayName(p)}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    );
  }

  const players = tournament.registeredPlayers || [];
  if (!players.length) {
    return <p className="text-sm text-brand-muted">No players registered yet.</p>;
  }
  return (
    <ul className="flex flex-wrap gap-2">
      {players.map((p, i) => (
        <li
          key={p?._id || i}
          className="rounded-full border border-brand-border bg-brand-subtle/20 px-3 py-1 text-sm text-brand-light"
        >
          {formatPlayerDisplayName(p)}
        </li>
      ))}
    </ul>
  );
}
