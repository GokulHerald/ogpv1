import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Upload, Trophy } from 'lucide-react';
import * as tournamentApi from '../api/tournament.api.js';
import * as matchApi from '../api/match.api.js';
import { useAuth } from '../hooks/useAuth.js';
import { BracketView } from '../components/tournament/BracketView.jsx';
import { StreamSubmitForm } from '../components/tournament/StreamSubmitForm.jsx';
import { LoadingSpinner } from '../components/ui/LoadingSpinner.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { Badge } from '../components/ui/Badge.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Modal } from '../components/ui/Modal.jsx';
import * as paymentApi from '../api/payment.api.js';
import toast from 'react-hot-toast';

const statusVariant = {
  registration: 'orange',
  ongoing: 'green',
  completed: 'gray',
  cancelled: 'red',
};

export function TournamentDetailPage() {
  const { id } = useParams();
  const { isAuthenticated, isOrganizer, isPlayer, user } = useAuth();
  const [tournament, setTournament] = useState(null);
  const [matches, setMatches] = useState([]);
  const [leaderboard, setLeaderboard] = useState(null);
  const [leaderboardLoadError, setLeaderboardLoadError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [adminStatsLoading, setAdminStatsLoading] = useState(false);
  const [adminStats, setAdminStats] = useState(null);
  const [squadName, setSquadName] = useState('');
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [createdInviteCode, setCreatedInviteCode] = useState('');
  const [createdTeamId, setCreatedTeamId] = useState('');
  const [squadRoster, setSquadRoster] = useState(null);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [brWinnerTeamId, setBrWinnerTeamId] = useState('');
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [pendingTeamId, setPendingTeamId] = useState(null);

  const refetchLeaderboard = useCallback(async () => {
    try {
      const { data } = await matchApi.getLeaderboard(id);
      setLeaderboard(data?.leaderboard ?? null);
      setLeaderboardLoadError(null);
    } catch (e) {
      setLeaderboard(null);
      setLeaderboardLoadError(
        e.response?.data?.message || e.message || 'Could not load leaderboard'
      );
    }
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLeaderboardLoadError(null);
      try {
        const [tRes, mRes] = await Promise.all([
          tournamentApi.getTournamentById(id),
          matchApi.getMatchesByTournament(id).catch(() => ({ data: { matches: [] } })),
        ]);
        if (!cancelled) {
          setTournament(tRes.data.tournament);
          setMatches(mRes.data.matches || []);
        }
        try {
          const { data } = await matchApi.getLeaderboard(id);
          if (!cancelled) {
            setLeaderboard(data?.leaderboard ?? null);
            setLeaderboardLoadError(null);
          }
        } catch (le) {
          if (!cancelled) {
            setLeaderboard(null);
            setLeaderboardLoadError(
              le.response?.data?.message || le.message || 'Could not load leaderboard'
            );
            toast.error('Could not load standings');
          }
        }
      } catch {
        if (!cancelled) toast.error('Failed to load tournament');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (tournament?.status !== 'registration') {
      setPayModalOpen(false);
    }
  }, [tournament?.status]);

  const refetchMatches = useCallback(async () => {
    try {
      const { data } = await matchApi.getMatchesByTournament(id);
      setMatches(data.matches || []);
      await refetchLeaderboard();
    } catch {
      toast.error('Failed to refresh matches');
    }
  }, [id, refetchLeaderboard]);

  const isSquadTournament = tournament?.format === 'battle_royale_squad';

  const myMatch = useMemo(() => {
    if (!user?._id) return null;
    const uid = String(user._id);
    return (
      matches.find((m) => {
        if (m.status === 'completed') return false;
        if (m.kind === 'br_lobby') {
          return (m.brTeams || []).some((slot) =>
            (slot.players || []).some((p) => String(p?._id || p) === uid)
          );
        }
        const p1 = m.player1?._id ?? m.player1;
        const p2 = m.player2?._id ?? m.player2;
        return (p1 != null && String(p1) === uid) || (p2 != null && String(p2) === uid);
      }) || null
    );
  }, [matches, user?._id]);

  const memberSlots = (tournament?.squadSize || 4) - 1;

  useEffect(() => {
    // Reset squad state when changing tournaments.
    setInviteCodeInput('');
    setCreatedInviteCode('');
    setCreatedTeamId('');
    setSquadRoster(null);
  }, [memberSlots, id]);

  useEffect(() => {
    async function bootstrapMySquad() {
      if (!isAuthenticated || !isPlayer || !isSquadTournament) return;
      try {
        const res = await tournamentApi.getMySquadForTournament(id);
        const code = res.data?.inviteCode;
        const teamId = res.data?.team?._id;
        if (code) setCreatedInviteCode(String(code));
        if (teamId) setCreatedTeamId(String(teamId));
        setSquadRoster(res.data);
      } catch {
        // No squad yet; ignore
      }
    }
    bootstrapMySquad();
  }, [id, isAuthenticated, isPlayer, isSquadTournament]);

  const loadRoster = async (code) => {
    const c = String(code || '').trim();
    if (!c) return;
    try {
      setRosterLoading(true);
      const res = await tournamentApi.getSquadRoster(id, c);
      setSquadRoster(res.data);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to load squad roster');
    } finally {
      setRosterLoading(false);
    }
  };

  const isRegistered = useMemo(() => {
    if (!user?._id || !tournament) return false;
    const uid = String(user._id);
    if (isSquadTournament) {
      const teams = tournament.registeredTeams || [];
      return teams.some((team) => {
        if (!team) return false;
        const cap = team.captain?._id || team.captain;
        if (String(cap) === uid) return true;
        return (team.members || []).some((m) => String(m._id || m) === uid);
      });
    }
    return tournament.registeredPlayers?.some((p) => String(p._id || p) === uid) ?? false;
  }, [tournament, user?._id, isSquadTournament]);
  const isOwner = tournament && user && String(tournament.organizer?._id || tournament.organizer) === String(user._id);

  const showActiveMatchPanel =
    isAuthenticated &&
    isRegistered &&
    tournament?.status === 'ongoing' &&
    myMatch != null;

  const showPlayerStreamHint =
    isAuthenticated &&
    isPlayer &&
    isRegistered &&
    !showActiveMatchPanel &&
    tournament?.status !== 'completed' &&
    tournament?.status !== 'cancelled';

  const opponentUsername = useMemo(() => {
    if (!myMatch || !user?._id) return '—';
    if (myMatch.kind === 'br_lobby') return 'Squad battle royale';
    const uid = String(user._id);
    const p1 = myMatch.player1?._id ?? myMatch.player1;
    const p2 = myMatch.player2?._id ?? myMatch.player2;
    if (p1 != null && String(p1) === uid) {
      return myMatch.player2?.username || 'TBD';
    }
    if (p2 != null && String(p2) === uid) {
      return myMatch.player1?.username || 'TBD';
    }
    return '—';
  }, [myMatch, user?._id]);

  const brLobbyMatch = useMemo(() => matches.find((m) => m.kind === 'br_lobby'), [matches]);

  const showBrWinnerPanel =
    isOrganizer &&
    isOwner &&
    tournament &&
    tournament.status === 'ongoing' &&
    brLobbyMatch &&
    brLobbyMatch.status !== 'completed';

  const openPayModal = (teamId = null) => {
    if (tournament && tournament.status !== 'registration') {
      toast.error('Registration is closed for this tournament');
      return;
    }
    setPendingTeamId(teamId);
    setPayModalOpen(true);
  };

  const submitEsewaForm = (actionUrl, payload) => {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = actionUrl;
    form.style.display = 'none';

    Object.entries(payload || {}).forEach(([k, v]) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = k;
      input.value = String(v ?? '');
      form.appendChild(input);
    });

    document.body.appendChild(form);
    form.submit();
    form.remove();
  };

  const handlePay = async (gateway) => {
    if (!tournament) return;
    setActionLoading(true);
    try {
      if (gateway === 'khalti') {
        const { data } = await paymentApi.initiateKhaltiPayment({
          tournamentId: id,
          teamId: pendingTeamId || undefined,
        });
        if (!data?.payment_url) throw new Error('Missing payment URL');
        window.location.href = data.payment_url;
        return;
      }

      if (gateway === 'esewa') {
        const { data } = await paymentApi.initiateEsewaPayment({
          tournamentId: id,
          teamId: pendingTeamId || undefined,
        });
        if (!data?.esewa_payment_url) throw new Error('Missing eSewa URL');
        const { esewa_payment_url, ...rest } = data;
        submitEsewaForm(esewa_payment_url, rest);
        return;
      }

      toast.error('Unknown gateway');
    } catch (e) {
      toast.error(e.response?.data?.message || e.message || 'Payment initiation failed');
    } finally {
      setActionLoading(false);
      setPayModalOpen(false);
    }
  };

  const handleRegister = async () => {
    if (tournament?.entryFee > 0) {
      openPayModal(null);
      return;
    }

    setActionLoading(true);
    try {
      await tournamentApi.registerForTournament(id);
      toast.success('Registered');
      const { data } = await tournamentApi.getTournamentById(id);
      setTournament(data.tournament);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Register failed');
    } finally {
      setActionLoading(false);
    }
  };

  const loadAdminStats = async () => {
    try {
      setAdminStatsLoading(true);
      const { data } = await tournamentApi.getAdminPlayerStats(id);
      setAdminStats(data);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to load admin stats');
    } finally {
      setAdminStatsLoading(false);
    }
  };

  const handleRegisterSquad = async () => {
    setActionLoading(true);
    try {
      const res = await tournamentApi.registerSquad(id, {
        name: squadName.trim(),
      });
      const tid = res.data.team?._id;
      const code = res.data.inviteCode;
      if (tid) setCreatedTeamId(String(tid));
      if (code) setCreatedInviteCode(String(code));
      toast.success(res.data?.message || 'Squad created');
      if (code) {
        await loadRoster(code);
      }

      if (res.data?.requiresPayment && res.data?.isFullTeam) {
        openPayModal(tid || null);
      }
      const { data } = await tournamentApi.getTournamentById(id);
      setTournament(data.tournament);
      setSquadName('');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Squad registration failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleJoinSquad = async () => {
    const code = String(inviteCodeInput || '').trim();
    if (!code) {
      toast.error('Enter an invite code');
      return;
    }
    setActionLoading(true);
    try {
      const res = await tournamentApi.joinSquadByInviteCode(id, code);
      toast.success(res.data?.message || 'Joined squad');
      if (res.data?.requiresPayment) {
        toast('Squad is full. Captain can now pay to register.', { duration: 6000 });
      }
      await loadRoster(code);
      const { data } = await tournamentApi.getTournamentById(id);
      setTournament(data.tournament);
      setInviteCodeInput('');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Could not join squad');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeclareBrWinner = async () => {
    if (!brWinnerTeamId) {
      toast.error('Select a winning squad');
      return;
    }
    setActionLoading(true);
    try {
      await tournamentApi.setBrWinner(id, brWinnerTeamId);
      toast.success('Winner recorded; prize credited to captain wallet');
      const [tRes, mRes] = await Promise.all([
        tournamentApi.getTournamentById(id),
        matchApi.getMatchesByTournament(id),
      ]);
      setTournament(tRes.data.tournament);
      setMatches(mRes.data.matches || []);
      await refetchLeaderboard();
      setBrWinnerTeamId('');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Could not set winner');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStart = async () => {
    setActionLoading(true);
    try {
      await tournamentApi.startTournament(id);
      toast.success('Tournament started');
      const [tRes, mRes] = await Promise.all([
        tournamentApi.getTournamentById(id),
        matchApi.getMatchesByTournament(id),
      ]);
      setTournament(tRes.data.tournament);
      setMatches(mRes.data.matches || []);
      await refetchLeaderboard();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Could not start');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-center">
        <p className="text-brand-muted">Tournament not found.</p>
        <Link to="/tournaments" className="mt-4 inline-block text-brand-orange hover:underline">
          Back to list
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Link to="/tournaments" className="text-sm text-brand-muted hover:text-brand-light">
        ← Tournaments
      </Link>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl font-black text-brand-light md:text-4xl">{tournament.name}</h1>
            <Badge variant={statusVariant[tournament.status] || 'gray'}>{tournament.status}</Badge>
          </div>
          <p className="mt-1 text-brand-orange">{tournament.game}</p>
          <p className="mt-2 text-sm text-brand-muted">
            Organizer: {tournament.organizer?.username || '—'} · Prize: ₹{tournament.prizePool}
            {isSquadTournament ? (
              <>
                {' '}
                · Squads {tournament.registeredTeams?.length ?? 0}/{tournament.maxTeams ?? '—'} ·{' '}
                {tournament.squadSize ?? 4} players per squad
              </>
            ) : (
              <>
                {' '}
                · Max {tournament.maxPlayers} players
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAuthenticated &&
          !isOrganizer &&
          isPlayer &&
          tournament.status === 'registration' &&
          !isRegistered &&
          !isSquadTournament ? (
            <Button variant="primary" disabled={actionLoading} onClick={handleRegister}>
              {tournament.entryFee > 0 ? `Pay ₹${tournament.entryFee} & register` : 'Register'}
            </Button>
          ) : null}
          {isOwner && tournament.status === 'registration' ? (
            <Button variant="secondary" disabled={actionLoading} onClick={handleStart}>
              Start tournament
            </Button>
          ) : null}
        </div>
      </div>

      <Modal
        open={payModalOpen && tournament.status === 'registration'}
        onClose={() => (!actionLoading ? setPayModalOpen(false) : null)}
        title="Choose payment gateway"
      >
        <p className="text-sm text-brand-muted">
          Entry fee: <span className="text-brand-light">₹{tournament.entryFee}</span>. You’ll be registered only after we
          verify the payment.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Button variant="primary" disabled={actionLoading} onClick={() => handlePay('khalti')}>
            Pay with Khalti
          </Button>
          <Button variant="secondary" disabled={actionLoading} onClick={() => handlePay('esewa')}>
            Pay with eSewa
          </Button>
        </div>
        <p className="mt-4 text-xs text-brand-muted">
          After payment, you’ll be redirected back to the site. If you close the gateway window, just try again.
        </p>
      </Modal>

      {isAuthenticated &&
      !isOrganizer &&
      tournament.status === 'registration' &&
      !isRegistered &&
      isSquadTournament ? (
        <div className="card-surface mt-8 space-y-4 p-5">
          <h3 className="font-display text-sm font-bold uppercase tracking-wide text-brand-light">
            Squad registration
          </h3>
          <p className="text-sm text-brand-muted">
            Squads are <strong className="text-brand-light">{tournament.squadSize ?? 4}</strong> players. Create a squad
            to get an invite code, then teammates join using that code (no Mongo IDs).
          </p>
          <div>
            <label className="mb-1 block text-xs font-medium text-brand-muted" htmlFor="squad-name">
              Squad tag / name (optional)
            </label>
            <input
              id="squad-name"
              className="input w-full"
              value={squadName}
              onChange={(e) => setSquadName(e.target.value)}
              placeholder="e.g. Team Alpha"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" disabled={actionLoading} onClick={handleRegisterSquad}>
              Create squad & get code
            </Button>
            {createdTeamId ? (
              <Button
                variant="secondary"
                disabled={actionLoading}
                onClick={() => openPayModal(createdTeamId)}
                title="Pay entry fee once squad is full"
              >
                Pay entry fee (captain)
              </Button>
            ) : null}
          </div>

          {createdInviteCode ? (
            <div className="rounded-xl border border-brand-border bg-brand-subtle/20 p-4">
              <p className="text-xs uppercase tracking-wider text-brand-muted">Invite code</p>
              <p className="mt-1 font-mono text-lg font-bold text-brand-light">{createdInviteCode}</p>
              <p className="mt-1 text-xs text-brand-muted">
                Share this code with teammates. They can join from this page using “Join with code”.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  variant="ghost"
                  disabled={rosterLoading}
                  onClick={() => loadRoster(createdInviteCode)}
                  className="!px-3 !py-2 text-xs"
                >
                  {rosterLoading ? 'Refreshing…' : 'Refresh roster'}
                </Button>
              </div>
            </div>
          ) : null}

          {squadRoster?.team ? (
            <div className="rounded-xl border border-brand-border bg-brand-subtle/10 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs uppercase tracking-wider text-brand-muted">Squad roster</p>
                <p className="text-xs text-brand-muted">
                  Slots left: <span className="text-brand-light">{squadRoster.membersNeeded ?? 0}</span>
                </p>
              </div>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-brand-muted">Captain</span>
                  <span className="text-brand-light">{squadRoster.team.captain?.username || '—'}</span>
                </div>
                <div className="border-t border-brand-border/60 pt-2">
                  <p className="text-brand-muted">Members</p>
                  <ul className="mt-2 space-y-1">
                    {(squadRoster.team.members || []).length ? (
                      (squadRoster.team.members || []).map((m) => (
                        <li key={m?._id || m} className="flex items-center justify-between">
                          <span className="text-brand-light">{m?.username || '—'}</span>
                          <span className="text-xs text-brand-muted">{String(m?._id || m).slice(-6)}</span>
                        </li>
                      ))
                    ) : (
                      <li className="text-brand-muted">No teammates joined yet.</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          ) : null}

          <div className="h-px bg-brand-border/70" />

          <div className="space-y-2">
            <p className="text-sm font-medium text-brand-light">Join with invite code</p>
            <input
              className="input w-full font-mono"
              value={inviteCodeInput}
              onChange={(e) => setInviteCodeInput(e.target.value)}
              placeholder="e.g. A1B2C3D4"
            />
            <Button variant="secondary" disabled={actionLoading} onClick={handleJoinSquad}>
              Join squad
            </Button>
          </div>
        </div>
      ) : null}

      {showBrWinnerPanel ? (
        <div className="card-surface mt-8 space-y-4 border border-violet-500/25 p-5">
          <h3 className="font-display text-sm font-bold uppercase tracking-wide text-violet-300">
            Declare battle royale winner
          </h3>
          <p className="text-sm text-brand-muted">
            The prize pool is credited to the winning captain&apos;s wallet. Splitting among the squad is manual.
          </p>
          <select
            className="input w-full max-w-md bg-brand-card"
            value={brWinnerTeamId}
            onChange={(e) => setBrWinnerTeamId(e.target.value)}
            aria-label="Winning squad"
          >
            <option value="">Select winning squad</option>
            {(brLobbyMatch.brTeams || []).map((slot) => {
              const tid = String(slot.team?._id || slot.team);
              const t = slot.team;
              const label =
                typeof t === 'object' && t != null
                  ? t.name?.trim() || t.captain?.username || `Squad ${tid.slice(-6)}`
                  : tid;
              return (
                <option key={tid} value={tid}>
                  {label}
                </option>
              );
            })}
          </select>
          <Button variant="primary" disabled={actionLoading} onClick={handleDeclareBrWinner}>
            Confirm winning squad
          </Button>
        </div>
      ) : null}

      {isOrganizer && isOwner ? (
        <div className="card-surface mt-8 space-y-4 border border-brand-border p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-sm font-bold uppercase tracking-wide text-brand-light">
              Admin player statistics
            </h3>
            <Button
              type="button"
              variant="secondary"
              disabled={adminStatsLoading}
              onClick={loadAdminStats}
              className="!px-3 !py-2 text-xs"
            >
              {adminStatsLoading ? 'Loading…' : adminStats ? 'Refresh stats' : 'Load stats'}
            </Button>
          </div>

          {!adminStats ? (
            <p className="text-sm text-brand-muted">
              View per-player totals and per-match breakdown for this tournament (organizer-only).
            </p>
          ) : (
            <div className="space-y-4">
              <p className="text-xs uppercase tracking-wider text-brand-muted">
                Players {adminStats.players?.length ?? 0} · Matches {adminStats.matchesCount ?? 0}
              </p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-brand-border text-xs uppercase tracking-wider text-brand-muted">
                      <th className="pb-2 pr-4">Player</th>
                      <th className="pb-2 pr-4">Points</th>
                      <th className="pb-2 pr-4">Score</th>
                      <th className="pb-2 pr-4">W</th>
                      <th className="pb-2 pr-4">L</th>
                      <th className="pb-2 pr-4">Kills</th>
                      <th className="pb-2 pr-4">Avg placement</th>
                      <th className="pb-2">Per-match</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(adminStats.players || []).map((p) => (
                      <tr key={p.playerId} className="border-b border-brand-border/60 align-top">
                        <td className="py-2 pr-4 text-brand-light">{p.player?.username || p.playerId}</td>
                        <td className="py-2 pr-4">{p.totals?.totalPoints ?? 0}</td>
                        <td className="py-2 pr-4">{p.totals?.totalScore ?? 0}</td>
                        <td className="py-2 pr-4">{p.totals?.wins ?? 0}</td>
                        <td className="py-2 pr-4">{p.totals?.losses ?? 0}</td>
                        <td className="py-2 pr-4">{p.totals?.kills ?? 0}</td>
                        <td className="py-2 pr-4">{p.totals?.avgPlacement ?? '—'}</td>
                        <td className="py-2">
                          <details className="rounded-lg border border-brand-border bg-brand-subtle/20 p-3">
                            <summary className="cursor-pointer text-xs font-semibold text-brand-orange">
                              View ({p.perMatch?.length ?? 0})
                            </summary>
                            <div className="mt-3 space-y-2 text-xs text-brand-muted">
                              {(p.perMatch || []).map((m) => (
                                <div key={m.matchId} className="rounded-md border border-brand-border/60 p-2">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="text-brand-light">
                                      {m.kind === 'br_lobby'
                                        ? 'BR lobby'
                                        : `Round ${m.round} · Match ${m.matchNumber}`}
                                    </span>
                                    <span>{m.status}</span>
                                  </div>
                                  <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-4">
                                    <span>Kills: {m.kills ?? 0}</span>
                                    <span>Placement: {m.placement ?? '—'}</span>
                                    <span>Score: {m.score ?? 0}</span>
                                    <span>Result: {m.isWinner == null ? '—' : m.isWinner ? 'W' : 'L'}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </details>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : null}

      <section className="mt-12">
        <h2 className="font-display mb-4 text-xl font-black uppercase tracking-wide text-brand-light">
          Bracket & matches
        </h2>
        <BracketView matches={matches} />

        {showPlayerStreamHint ? (
          <div className="mt-8 rounded-xl border border-dashed border-brand-border bg-brand-subtle/30 p-5">
            <h3 className="font-display text-sm font-bold uppercase tracking-wide text-brand-light">
              YouTube / Twitch / Facebook stream link
            </h3>
            {tournament.status === 'registration' ? (
              <p className="mt-2 text-sm leading-relaxed text-brand-muted">
                {isSquadTournament ? (
                  <>
                    After the organizer starts the event, each squad member can submit a stream link from this page when
                    the <strong className="text-brand-orange">YOUR ACTIVE MATCH</strong> panel appears for the BR lobby.
                  </>
                ) : (
                  <>
                    You submit your live stream URL only when you have an{' '}
                    <strong className="text-brand-light">active</strong> bracket match. After the organizer{' '}
                    <strong className="text-brand-light">starts</strong> this tournament, stay on{' '}
                    <strong className="text-brand-light">this page</strong>. A{' '}
                    <strong className="text-brand-orange">YOUR ACTIVE MATCH</strong> block will appear below the bracket
                    with the form (YouTube Live, Twitch, or Facebook Gaming).
                  </>
                )}
              </p>
            ) : (
              <p className="mt-2 text-sm leading-relaxed text-brand-muted">
                {isSquadTournament ? (
                  <>
                    You&apos;re registered, but you&apos;re not in the live lobby roster or the match has finished. When
                    you&apos;re part of the active BR lobby, <strong className="text-brand-orange">YOUR ACTIVE MATCH</strong>{' '}
                    will appear here.
                  </>
                ) : (
                  <>
                    This tournament is live, but you don&apos;t have a{' '}
                    <strong className="text-brand-light">pending or live</strong> match right now (you may be waiting for
                    the next round, or your matches are finished). When you&apos;re drawn into an active match,{' '}
                    <strong className="text-brand-orange">YOUR ACTIVE MATCH</strong> will show up here with the stream link
                    and proof upload.
                  </>
                )}
              </p>
            )}
          </div>
        ) : null}

        {showActiveMatchPanel ? (
          <div className="mt-10 space-y-8">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-red-600" />
              </span>
              <h3 className="font-display text-lg font-black uppercase tracking-wide text-brand-light">
                YOUR ACTIVE MATCH
              </h3>
            </div>

            <div className="card-surface space-y-6 p-5">
              <div className="space-y-1 border-b border-brand-border pb-4">
                <p className="text-sm text-brand-muted">
                  Round {myMatch.round} — Match {myMatch.matchNumber}
                </p>
                <p className="font-semibold text-brand-light">vs {opponentUsername}</p>
              </div>

              <StreamSubmitForm
                match={myMatch}
                currentUserId={user._id}
                onSubmitted={refetchMatches}
              />

              <div className="border-t border-brand-border pt-6">
                <h4 className="font-display text-base font-bold uppercase tracking-wide text-brand-light">
                  SUBMIT MATCH PROOF
                </h4>
                <p className="mt-1 text-sm text-brand-muted">
                  Upload a screenshot of your end-game results screen after the match
                </p>
                <div className="mt-4">
                  <MatchProofUpload matchId={myMatch._id} onSuccess={refetchMatches} />
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <section className="mt-12">
        <h2 className="font-display mb-4 text-xl font-black uppercase tracking-wide text-brand-light">
          Leaderboard
        </h2>
        {leaderboardLoadError ? (
          <p className="card-surface p-4 text-sm text-red-400">{leaderboardLoadError}</p>
        ) : leaderboard?.entries?.length ? (
          <div className="card-surface overflow-x-auto p-4">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-brand-border text-brand-muted">
                  <th className="pb-2 pr-4">#</th>
                  <th className="pb-2 pr-4">Player</th>
                  <th className="pb-2">Points</th>
                  <th className="pb-2 pl-4">Matches</th>
                  <th className="pb-2 pl-4">Wins</th>
                  <th className="pb-2 pl-4">Total points</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.entries.map((e, i) => (
                  <tr key={e.player?._id || i} className="border-b border-brand-border/60">
                    <td className="py-2 pr-4 text-brand-muted">{e.rank ?? i + 1}</td>
                    <td className="py-2 pr-4">
                      <div className="font-semibold text-brand-light">{e.player?.username || '—'}</div>
                      <div className="text-xs text-brand-muted">
                        Games: {e.player?.stats?.gamesPlayed ?? 0} · Wins: {e.player?.stats?.totalWins ?? 0}
                      </div>
                    </td>
                    <td className="py-2 font-semibold text-brand-light">{e.points ?? 0}</td>
                    <td className="py-2 pl-4 text-brand-light">{e.matchesPlayed ?? 0}</td>
                    <td className="py-2 pl-4 text-brand-light">{e.wins ?? 0}</td>
                    <td className="py-2 pl-4 text-brand-light">{e.player?.stats?.totalPoints ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="card-surface p-6">
            <EmptyState
              icon={Trophy}
              title="No standings yet"
              description={
                tournament.status === 'registration'
                  ? 'Standings fill in once players are registered and match results are recorded.'
                  : 'Points update when organizers submit match results (including BR lobby stats).'
              }
            />
          </div>
        )}
      </section>
    </div>
  );
}

function MatchProofUpload({ matchId, onSuccess }) {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const setImageFile = (f) => {
    if (f && f.type.startsWith('image/')) setFile(f);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    setImageFile(f);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file || !matchId) return;
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('screenshot', file);
      await matchApi.submitMatchProof(matchId, formData);
      toast.success('Proof submitted! Waiting for admin verification.');
      setFile(null);
      if (typeof onSuccess === 'function') onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit proof');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          setImageFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-brand-border bg-brand-subtle/40 px-4 py-10 text-center transition-colors hover:border-brand-red/50 hover:bg-brand-subtle/60 ${
          dragActive ? 'border-brand-red/60 bg-brand-subtle/70' : ''
        }`}
      >
        {preview ? (
          <img
            src={preview}
            alt="Screenshot preview"
            className="max-h-40 w-auto max-w-full rounded-lg border border-brand-border object-contain"
          />
        ) : (
          <>
            <Upload className="h-10 w-10 text-brand-muted" aria-hidden />
            <span className="text-sm text-brand-muted">
              Drop screenshot here or click to browse
            </span>
          </>
        )}
      </button>

      <Button
        type="submit"
        disabled={!file || submitting}
        className="flex w-full items-center justify-center gap-2"
      >
        {submitting ? (
          <>
            <LoadingSpinner size="sm" className="h-4 w-4 border-[1.5px]" />
            Submitting…
          </>
        ) : (
          'Submit proof'
        )}
      </Button>
    </form>
  );
}
