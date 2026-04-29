import { Link } from 'react-router-dom';

export function TermsOfServicePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <p className="text-xs font-semibold uppercase tracking-wider text-brand-orange">Legal</p>
      <h1 className="mt-2 font-display text-3xl font-black uppercase text-brand-light">
        Terms of service
      </h1>
      <p className="mt-2 text-sm text-brand-muted">Last updated: April 2026</p>

      <div className="mt-10 space-y-6 text-sm leading-relaxed text-brand-muted">
        <section>
          <h2 className="mb-2 font-semibold text-brand-light">1. Acceptance</h2>
          <p>
            By accessing or using this Online Gaming Platform (“OGP”), you agree to these terms.
            If you do not agree, do not use the service.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-semibold text-brand-light">2. Eligibility & conduct</h2>
          <p>
            You agree to provide accurate registration information and to follow organizer rules
            for each tournament. Harassment, cheating, or abuse may result in disqualification or
            account restrictions.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-semibold text-brand-light">3. Tournaments & prizes</h2>
          <p>
            Event rules, entry fees, and prizes are defined by organizers within the platform.
            OGP facilitates registration and results; final interpretations of rules belong to
            the organizer unless stated otherwise.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-semibold text-brand-light">4. Streams & content</h2>
          <p>
            Stream links and screenshots you submit must comply with platform and third-party
            terms (e.g. YouTube, Twitch). You grant organizers reasonable use of submitted match
            evidence for scoring and moderation.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-semibold text-brand-light">5. Disclaimer</h2>
          <p>
            The service is provided “as is” for educational and demonstration purposes. We do not
            guarantee uninterrupted availability or error-free operation.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-semibold text-brand-light">6. Changes</h2>
          <p>
            We may update these terms; continued use after changes constitutes acceptance of the
            revised terms.
          </p>
        </section>
      </div>

      <Link to="/" className="mt-10 inline-block text-sm font-semibold text-brand-orange hover:underline">
        ← Back to home
      </Link>
    </div>
  );
}
