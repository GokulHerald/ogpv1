import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import * as tournamentApi from '../api/tournament.api.js';
import { Button } from '../components/ui/Button.jsx';
import { Badge } from '../components/ui/Badge.jsx';
import { LoadingSpinner } from '../components/ui/LoadingSpinner.jsx';

const statusVariant = {
  registration: 'orange',
  ongoing: 'green',
  completed: 'gray',
  cancelled: 'red',
};

export function MyTournamentsPage() {
  const [loading, setLoading] = useState(true);
  const [portal, setPortal] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const res = await tournamentApi.getMyPlayerPortal();
        if (!cancelled) setPortal(res.data);
      } catch (e) {
        if (!cancelled) toast.error(e.response?.data?.message || 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const solo = useMemo(() => portal?.soloTournaments || [], [portal]);
  const squads = useMemo(() => portal?.squads || [], [portal]);

  const currentSolo = solo.filter((t) => t.status !== 'completed' && t.status !== 'cancelled');
  const pastSolo = solo.filter((t) => t.status === 'completed' || t.status === 'cancelled');

  if (loading) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-black uppercase tracking-tight text-brand-light">
          My tournaments
        </h1>
        <Button
          type="button"
          variant="secondary"
          onClick={async () => {
            try {
              setLoading(true);
              const res = await tournamentApi.getMyPlayerPortal();
              setPortal(res.data);
              toast.success('Updated');
            } catch (e) {
              toast.error(e.response?.data?.message || 'Failed to refresh');
            } finally {
              setLoading(false);
            }
          }}
          className="!px-3 !py-2 text-xs"
        >
          Refresh
        </Button>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="card-surface p-5">
          <h2 className="font-display text-sm font-bold uppercase tracking-wide text-brand-light">
            Squad tournaments
          </h2>
          {!squads.length ? (
            <p className="mt-3 text-sm text-brand-muted">No squads yet.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {squads.map((s) => {
                const t = s.tournament;
                const tid = t?._id;
                return (
                  <div key={s.team?._id} className="rounded-xl border border-brand-border/60 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-brand-light">{t?.name || 'Tournament'}</p>
                        <p className="mt-1 text-xs text-brand-muted">
                          {t?.game || '—'} · Entry ₹{t?.entryFee ?? 0}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge variant={statusVariant[t?.status] || 'gray'}>{t?.status || '—'}</Badge>
                          <Badge variant={s.isFullTeam ? 'green' : 'orange'}>
                            {s.isFullTeam ? 'Full squad' : `Slots left ${s.membersNeeded ?? 0}`}
                          </Badge>
                          <Badge variant={s.hasPaid ? 'green' : 'orange'}>{s.hasPaid ? 'Paid' : 'Unpaid'}</Badge>
                        </div>
                      </div>
                      <div className="text-right text-xs text-brand-muted">
                        <div>
                          Invite: <span className="font-mono text-brand-light">{s.inviteCode || '—'}</span>
                        </div>
                        <div>
                          Captain: <span className="text-brand-light">{s.team?.captain?.username || '—'}</span>
                        </div>
                      </div>
                    </div>
                    {tid ? (
                      <div className="mt-3">
                        <Link to={`/tournaments/${tid}`} className="text-xs font-semibold text-brand-orange hover:underline">
                          View tournament →
                        </Link>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="card-surface p-5">
          <h2 className="font-display text-sm font-bold uppercase tracking-wide text-brand-light">
            Solo tournaments
          </h2>
          {!solo.length ? (
            <p className="mt-3 text-sm text-brand-muted">No solo tournaments joined yet.</p>
          ) : (
            <div className="mt-4 space-y-6">
              <div>
                <p className="text-xs uppercase tracking-wider text-brand-muted">Current</p>
                {!currentSolo.length ? (
                  <p className="mt-2 text-sm text-brand-muted">None.</p>
                ) : (
                  <ul className="mt-2 space-y-2 text-sm">
                    {currentSolo.map((t) => (
                      <li key={t._id} className="flex items-center justify-between gap-3 rounded-lg border border-brand-border/60 p-3">
                        <div>
                          <p className="font-semibold text-brand-light">{t.name}</p>
                          <p className="text-xs text-brand-muted">
                            {t.game} · <Badge variant={statusVariant[t.status] || 'gray'}>{t.status}</Badge>
                          </p>
                        </div>
                        <Link to={`/tournaments/${t._id}`} className="text-xs font-semibold text-brand-orange hover:underline">
                          Open
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <p className="text-xs uppercase tracking-wider text-brand-muted">Past</p>
                {!pastSolo.length ? (
                  <p className="mt-2 text-sm text-brand-muted">None.</p>
                ) : (
                  <ul className="mt-2 space-y-2 text-sm">
                    {pastSolo.map((t) => (
                      <li key={t._id} className="flex items-center justify-between gap-3 rounded-lg border border-brand-border/60 p-3">
                        <div>
                          <p className="font-semibold text-brand-light">{t.name}</p>
                          <p className="text-xs text-brand-muted">
                            {t.game} · <Badge variant={statusVariant[t.status] || 'gray'}>{t.status}</Badge>
                          </p>
                        </div>
                        <Link to={`/tournaments/${t._id}`} className="text-xs font-semibold text-brand-orange hover:underline">
                          View
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

