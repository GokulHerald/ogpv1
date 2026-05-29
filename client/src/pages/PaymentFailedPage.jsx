import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/Button.jsx';

const REASON_HINTS = {
  verify:
    'Payment may have gone through at eSewa, but our server could not verify it. Check SERVER_URL and ESEWA_* env vars on your API host, then try again.',
  server_config:
    'The API is missing eSewa configuration (merchant ID, secret, or status URL).',
};

export function PaymentFailedPage() {
  const [searchParams] = useSearchParams();
  const reason = searchParams.get('reason');
  const hint = REASON_HINTS[reason];

  return (
    <div className="mx-auto flex min-h-[55vh] max-w-3xl flex-col justify-center px-4 py-16">
      <div className="card-surface p-8">
        <h1 className="font-display text-3xl font-black uppercase tracking-wide text-brand-light">
          Payment failed
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-brand-muted">
          We couldn’t confirm your payment. You have not been registered for the tournament. Please try again.
        </p>
        {hint ? (
          <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200/90">
            {hint}
          </p>
        ) : null}
        <p className="mt-3 text-xs text-brand-muted">
          On the eSewa test page use ID <span className="font-mono text-brand-light">9806800002</span>, password{' '}
          <span className="font-mono text-brand-light">Nepal@123</span>, OTP{' '}
          <span className="font-mono text-brand-light">123456</span>. MPIN is for the mobile app only.
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

