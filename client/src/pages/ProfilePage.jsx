import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import * as authApi from '../api/auth.api.js';
import * as tournamentApi from '../api/tournament.api.js';
import { useAuth } from '../hooks/useAuth.js';
import { Button } from '../components/ui/Button.jsx';
import { Badge } from '../components/ui/Badge.jsx';
import { LoadingSpinner } from '../components/ui/LoadingSpinner.jsx';
import { User } from 'lucide-react';

export function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portal, setPortal] = useState(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('profilePicture', file);
    setUploading(true);
    try {
      await authApi.updateProfilePicture(fd);
      toast.success('Profile picture updated');
      await refreshUser();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setPortalLoading(true);
        const res = await tournamentApi.getMyPlayerPortal();
        if (!cancelled) setPortal(res.data);
      } catch (e) {
        if (!cancelled) toast.error(e.response?.data?.message || 'Failed to load player portal');
      } finally {
        if (!cancelled) setPortalLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const squads = useMemo(() => portal?.squads || [], [portal]);
  const soloTournaments = useMemo(() => portal?.soloTournaments || [], [portal]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-3xl font-black uppercase tracking-tight text-brand-light">Profile</h1>
      <div className="card-surface mt-8 flex flex-col items-center p-8 text-center">
        <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 border-brand-border bg-brand-subtle">
          {user?.profilePicture ? (
            <img src={user.profilePicture} alt="" className="h-full w-full object-cover" />
          ) : (
            <User className="h-12 w-12 text-brand-muted" />
          )}
        </div>
        <p className="mt-4 font-display text-xl font-semibold text-brand-light">{user?.username}</p>
        <p className="text-sm text-brand-muted">{user?.phoneNumber}</p>
        <Badge variant={user?.role === 'organizer' ? 'orange' : 'green'} className="mt-2 capitalize">
          {user?.role || 'player'}
        </Badge>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        <Button
          type="button"
          variant="secondary"
          className="mt-6"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? <LoadingSpinner className="mx-auto !border-t-white" size="sm" /> : 'Change photo'}
        </Button>
      </div>

      <div className="mt-10 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-display text-xl font-black uppercase tracking-wide text-brand-light">
            Player portal
          </h2>
          <Button
            type="button"
            variant="secondary"
            disabled={portalLoading}
            onClick={async () => {
              try {
                setPortalLoading(true);
                const res = await tournamentApi.getMyPlayerPortal();
                setPortal(res.data);
                toast.success('Updated');
              } catch (e) {
                toast.error(e.response?.data?.message || 'Failed to refresh');
              } finally {
                setPortalLoading(false);
              }
            }}
            className="!px-3 !py-2 text-xs"
          >
            {portalLoading ? 'Refreshing…' : 'Refresh'}
          </Button>
        </div>

        <div className="card-surface p-5">
          <h3 className="font-display text-sm font-bold uppercase tracking-wide text-brand-light">
            My squads
          </h3>
          {!squads.length ? (
            <p className="mt-3 text-sm text-brand-muted">No squads yet.</p>
          ) : (
            <div className="mt-4 space-y-4">
              {squads.map((s) => {
                const t = s.tournament;
                return (
                  <div key={s.team?._id} className="rounded-xl border border-brand-border bg-brand-subtle/10 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-brand-light">{t?.name || 'Tournament'}</p>
                        <p className="text-xs text-brand-muted">
                          {t?.game || '—'} · {t?.status || '—'} · Entry ₹{t?.entryFee ?? 0}
                        </p>
                      </div>
                      <div className="text-right text-xs text-brand-muted">
                        <div>
                          Invite: <span className="font-mono text-brand-light">{s.inviteCode || '—'}</span>
                        </div>
                        <div>
                          Slots left: <span className="text-brand-light">{s.membersNeeded ?? 0}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                      <div className="rounded-lg border border-brand-border/60 p-3">
                        <p className="text-xs uppercase tracking-wider text-brand-muted">Captain</p>
                        <p className="mt-1 text-brand-light">{s.team?.captain?.username || '—'}</p>
                      </div>
                      <div className="rounded-lg border border-brand-border/60 p-3">
                        <p className="text-xs uppercase tracking-wider text-brand-muted">Members</p>
                        <ul className="mt-1 space-y-1">
                          {(s.team?.members || []).length ? (
                            (s.team.members || []).map((m) => (
                              <li key={m?._id || m} className="text-brand-light">
                                {m?.username || '—'}
                              </li>
                            ))
                          ) : (
                            <li className="text-brand-muted">No members yet.</li>
                          )}
                        </ul>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <Badge variant={s.isFullTeam ? 'green' : 'orange'}>
                        {s.isFullTeam ? 'Full squad' : 'Waiting teammates'}
                      </Badge>
                      <Badge variant={s.isRegisteredInTournament ? 'green' : 'gray'}>
                        {s.isRegisteredInTournament ? 'Registered' : 'Not registered'}
                      </Badge>
                      <Badge variant={s.hasPaid ? 'green' : 'orange'}>{s.hasPaid ? 'Paid' : 'Unpaid'}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="card-surface p-5">
          <h3 className="font-display text-sm font-bold uppercase tracking-wide text-brand-light">
            Tournaments I joined (solo)
          </h3>
          {!soloTournaments.length ? (
            <p className="mt-3 text-sm text-brand-muted">No solo tournaments joined yet.</p>
          ) : (
            <ul className="mt-4 space-y-2 text-sm">
              {soloTournaments.map((t) => (
                <li key={t._id} className="flex items-center justify-between gap-3 rounded-lg border border-brand-border/60 p-3">
                  <div>
                    <p className="font-semibold text-brand-light">{t.name}</p>
                    <p className="text-xs text-brand-muted">{t.game} · {t.status}</p>
                  </div>
                  <span className="text-xs text-brand-muted">Entry ₹{t.entryFee ?? 0}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
