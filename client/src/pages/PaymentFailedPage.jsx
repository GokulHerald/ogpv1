import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button.jsx';

export function PaymentFailedPage() {
  return (
    <div className="mx-auto flex min-h-[55vh] max-w-3xl flex-col justify-center px-4 py-16">
      <div className="card-surface p-8">
        <h1 className="font-display text-3xl font-black uppercase tracking-wide text-brand-light">
          Payment failed
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-brand-muted">
          We couldn’t confirm your payment. You have not been registered for the tournament. Please try again.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/tournaments">
            <Button variant="primary">Back to tournaments</Button>
          </Link>
          <Link to="/profile">
            <Button variant="secondary">View profile</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

