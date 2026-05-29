import { Link, useLocation } from 'react-router-dom';
import { useMemo } from 'react';
import { Button } from '../components/ui/Button.jsx';

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export function PaymentSuccessPage() {
  const q = useQuery();
  const tournamentId = q.get('tournament');
  const tournamentHref = tournamentId
    ? `/tournaments/${tournamentId}?registered=1`
    : null;

  return (
    <div className="mx-auto flex min-h-[55vh] max-w-3xl flex-col justify-center px-4 py-16">
      <div className="card-surface p-8">
        <h1 className="font-display text-3xl font-black uppercase tracking-wide text-brand-light">
          Payment successful
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-brand-muted">
          Your payment was verified. Your registration is confirmed — check My tournaments or open the
          tournament page to see your registered status.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          {tournamentHref ? (
            <Link to={tournamentHref}>
              <Button variant="primary">Back to tournament</Button>
            </Link>
          ) : (
            <Link to="/tournaments">
              <Button variant="primary">Browse tournaments</Button>
            </Link>
          )}
          <Link to="/my-tournaments">
            <Button variant="secondary">My tournaments</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
