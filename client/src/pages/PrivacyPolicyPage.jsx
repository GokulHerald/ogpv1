import { Link } from 'react-router-dom';

export function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <p className="text-xs font-semibold uppercase tracking-wider text-brand-orange">Legal</p>
      <h1 className="mt-2 font-display text-3xl font-black uppercase text-brand-light">
        Privacy policy
      </h1>
      <p className="mt-2 text-sm text-brand-muted">Last updated: April 2026</p>

      <div className="mt-10 space-y-6 text-sm leading-relaxed text-brand-muted">
        <section>
          <h2 className="mb-2 font-semibold text-brand-light">1. Who we are</h2>
          <p>
            This Online Gaming Platform (“OGP”) is operated for educational and demonstration
            purposes. It provides tournament listings, registration, and related features for
            esports-style events.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-semibold text-brand-light">2. Information we collect</h2>
          <p>We may process:</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>Account data you provide (e.g. phone number, username, role).</li>
            <li>Authentication data from Firebase when you sign in with phone OTP.</li>
            <li>Tournament participation, match results, and organizer-submitted statistics.</li>
            <li>Technical data such as IP address and browser type, as typical for web hosting.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 font-semibold text-brand-light">3. How we use information</h2>
          <p>
            We use this information to run tournaments, authenticate users, display leaderboards,
            communicate about events you join, and improve platform reliability and security.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-semibold text-brand-light">4. Sharing</h2>
          <p>
            We use service providers as needed to operate the site (for example: hosting,
            database, authentication, and media storage). We do not sell your personal data.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-semibold text-brand-light">5. Your choices</h2>
          <p>
            You may request correction or deletion of your account data where applicable. Contact
            the project maintainer using the support email shown in the Google OAuth consent
            screen for this application.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-semibold text-brand-light">6. Contact</h2>
          <p>
            For privacy questions, use the support email listed in the Google Cloud OAuth consent
            screen for this project.
          </p>
        </section>
      </div>

      <Link to="/" className="mt-10 inline-block text-sm font-semibold text-brand-orange hover:underline">
        ← Back to home
      </Link>
    </div>
  );
}
