import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Globe, Landmark, Lock, MapPin, Sparkles, TriangleAlert, X } from 'lucide-react';
import { useApi } from '../lib/useApi';

export type PublicCompany = {
  slug: string;
  name: string;
  initials: string;
  overview: string | null;
  website: string | null;
  headquarters: string | null;
  founded: string | null;
  mainBusiness: string | null;
  industries: string | null;
  logoUrl: string;
  logoStatus: string | null;
  sourceNote: string | null;
  mockSlug: string | null;
};

/** Minimal fields the marquee track itself needs; both the public landing
 *  payload and the authenticated dashboard payload satisfy this shape. */
export type MarqueeCompany = {
  slug: string;
  name: string;
  initials: string;
  logoUrl: string;
};

type FailingLogos = Record<string, boolean>;

/** The canonical "Top 25 Indian IT Companies" order, verified against
 *  Img-pdf/MOCK TEST.pdf.pdf ("Top 25 Indian IT Companies | Company-Style
 *  Mock Tests — 30 questions per company"). The showcase features exactly
 *  these 25; other verified workspace companies remain on the Companies
 *  page and are simply not part of this marquee sequence. */
const TOP25_SLUGS = [
  'tcs',
  'infosys',
  'hcltech',
  'wipro',
  'tech-mahindra',
  'ltimindtree',
  'zoho',
  'persistent-systems',
  'coforge',
  'mphasis',
  'ltts',
  'kpit-technologies',
  'hexaware',
  'zensar-technologies',
  'tata-elxsi',
  'ofss',
  'redington',
  'birlasoft',
  'cyient',
  'sonata-software',
  'intellect-design-arena',
  'newgen-software',
  'nucleus-software',
  'happiest-minds-technologies',
  'sasken-technologies',
] as const;

/** The workspace stores the OFSS profile under its longer legal-style name;
 *  the showcase displays the exact mock-PDF company name instead. */
const DISPLAY_NAMES: Record<string, string> = {
  ofss: 'Oracle Financial Services Software',
};

function marqueeName(company: MarqueeCompany): string {
  return DISPLAY_NAMES[company.slug] ?? company.name;
}

/** Order and trim any company list down to the canonical Top 25. Companies
 *  outside the list are skipped (they stay available on the Companies page);
 *  missing logos are reported through the normal fallback initials card. */
export function top25Order<T extends { slug: string }>(source: T[]): T[] {
  const bySlug = new Map(source.map((company) => [company.slug, company]));
  return TOP25_SLUGS.flatMap((slug) => {
    const company = bySlug.get(slug);
    return company ? [company] : [];
  });
}

function hueFrom(initials: string): number {
  return [...initials].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 360;
}

/** Company logo marquee on a premium dark band. The canonical Top 25 mock-PDF
 *  companies move continuously right-to-left on a seamless, doubled track —
 *  two identical halves, so a single -50% transform loops without a jump.
 *  Hovering or focusing the strip pauses the motion.
 *
 *  variant="landing" (default): each card opens a public company information
 *  panel; the panel's call to action preserves the intended workspace
 *  destination through the login redirect. Renders loading, error and empty
 *  states for the public fetch.
 *
 *  variant="app": used on the authenticated dashboard — the caller already
 *  has the company data, cards link straight to the company profile pages,
 *  and no login-gated panel is rendered. Static layout under
 *  prefers-reduced-motion (the strip becomes manually scrollable). */
export function CompanyMarquee({
  heading,
  variant = 'landing',
  companies: provided,
}: {
  heading?: string;
  variant?: 'landing' | 'app';
  companies?: MarqueeCompany[];
}) {
  const fetchPublicly = variant === 'landing' && !provided;
  const { data, loading, error, reload } = useApi<PublicCompany[]>(
    fetchPublicly ? '/api/public/companies' : null,
  );
  const [failed, setFailed] = useState<FailingLogos>({});
  const [panel, setPanel] = useState<PublicCompany | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const source = provided ?? data ?? [];
  const companies = top25Order(source as MarqueeCompany[]);
  const duration = `${Math.max(40, companies.length * 5)}s`;

  // close the info panel with Escape and move focus into its dialog
  useEffect(() => {
    if (!panel) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPanel(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [panel]);

  const track = (
    <div className="lq-marquee" tabIndex={-1}>
      <span className="lq-edge lq-edge-left" aria-hidden />
      <span className="lq-edge lq-edge-right" aria-hidden />
      <div className="lq-track-scroll">
        <div
          className="lq-track"
          role="list"
          aria-label="Participating companies"
          style={{ animationDuration: duration }}
        >
          {[false, true].map((isClone) => (
            <div key={isClone ? 'clone' : 'primary'} className="lq-track-half" aria-hidden={isClone}>
              {companies.map((company) => {
                const showFallback = failed[company.slug];
                const name = marqueeName(company);
                const cardInner = (
                  <>
                    {showFallback ? (
                      <span
                        className="lq-logo lq-logo-fallback"
                        style={{ background: `hsl(${hueFrom(company.initials)}, 42%, 30%)` }}
                      >
                        {company.initials}
                      </span>
                    ) : (
                      /* logos keep their original brand colours — the light
                         plate is what keeps dark-on-light marks readable on
                         the dark band (same convention as .company-mark-logo
                         on the mock-test and company pages) */
                      <span className="lq-logo-plate">
                        <img
                          className="lq-logo"
                          src={company.logoUrl}
                          alt={isClone ? '' : `${name} logo`}
                          /* The whole strip animates horizontally, so lazy
                             loading never fires for offscreen cards and they
                             pop in blank mid-scroll. Load all 50 small logo
                             PNGs eagerly instead. */
                          decoding="async"
                          onError={() => setFailed((current) => ({ ...current, [company.slug]: true }))}
                        />
                      </span>
                    )}
                    <span className="lq-name">{name}</span>
                  </>
                );
                return (
                  <div role="listitem" key={company.slug} className="lq-card">
                    {variant === 'app' ? (
                      <Link
                        to={`/app/companies/${company.slug}`}
                        className="lq-card-btn"
                        aria-label={`Open ${name} company profile`}
                        tabIndex={isClone ? -1 : undefined}
                      >
                        {cardInner}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        className="lq-card-btn"
                        onClick={() => !isClone && setPanel(company as PublicCompany)}
                        aria-label={`${name} logo, open company information`}
                        tabIndex={isClone ? -1 : undefined}
                      >
                        {cardInner}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {variant === 'landing' && panel && (
        <div className="lq-panel-backdrop" role="presentation" onClick={() => setPanel(null)}>
          <aside
            className="lq-panel"
            role="dialog"
            aria-modal="true"
            aria-label={`${panel.name} company information`}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="lq-panel-head">
              {failed[panel.slug] ? (
                <span
                  className="lq-panel-logo lq-logo-fallback"
                  style={{ background: `hsl(${hueFrom(panel.initials)}, 42%, 30%)` }}
                >
                  {panel.initials}
                </span>
              ) : (
                <span className="lq-panel-logo">
                  <img src={panel.logoUrl} alt={`${panel.name} logo`} onError={() => setFailed((current) => ({ ...current, [panel.slug]: true }))} />
                </span>
              )}
              <div>
                <p className="lq-panel-eyebrow">
                  <Sparkles size={12} /> Company profile
                </p>
                <h3>{panel.name}</h3>
              </div>
              <button
                type="button"
                ref={closeRef}
                className="lq-panel-close"
                onClick={() => setPanel(null)}
                aria-label={`Close ${panel.name} information`}
              >
                <X size={16} />
              </button>
            </header>

            {panel.overview ? (
              <p className="lq-panel-overview">{panel.overview}</p>
            ) : (
              <p className="lq-panel-overview muted">
                A verified profile sketch has not been authored for this company yet.
              </p>
            )}

            <dl className="lq-panel-facts">
              {panel.mainBusiness && (
                <div>
                  <dt><Building2 size={13} /> Main business</dt>
                  <dd>{panel.mainBusiness}</dd>
                </div>
              )}
              {panel.industries && (
                <div>
                  <dt><Sparkles size={13} /> Industries</dt>
                  <dd>{panel.industries}</dd>
                </div>
              )}
              {panel.headquarters && (
                <div>
                  <dt><MapPin size={13} /> Headquarters</dt>
                  <dd>{panel.headquarters}</dd>
                </div>
              )}
              {panel.founded && (
                <div>
                  <dt><Landmark size={13} /> Founded</dt>
                  <dd>{panel.founded}</dd>
                </div>
              )}
            </dl>

            <footer className="lq-panel-actions">
              {panel.website && (
                <a
                  href={panel.website}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="lq-panel-web"
                >
                  <Globe size={14} /> Official website
                </a>
              )}
              {/* only companies with a real published company mock advertise
                  that exact destination; others get the honest generic CTA */}
              {panel.mockSlug ? (
                <Link
                  to="/login"
                  state={{ from: `/app/mocks/${panel.mockSlug}` }}
                  className="lq-panel-cta"
                >
                  <Lock size={14} /> Sign in to start the {panel.name} mock test
                </Link>
              ) : (
                <Link to="/login" className="lq-panel-cta">
                  <Lock size={14} /> Sign in to practise and take mocks
                </Link>
              )}
            </footer>
            {panel.sourceNote && <small className="lq-panel-note">{panel.sourceNote}</small>}
          </aside>
        </div>
      )}
    </div>
  );

  if (variant === 'app') {
    // dashboard embedding: the caller supplies its own heading (SectionHead),
    // the company data comes from the dashboard payload, and no login-gated
    // panel is rendered.
    return (
      <section className="lq-band lq-band-app" aria-label="Company logo showcase">
        {track}
      </section>
    );
  }

  return (
    <section className="lq-band" id="companies" aria-label="Company logo showcase">
      <div className="lq-atmosphere" aria-hidden>
        <span className="lq-glow lq-glow-a" />
        <span className="lq-glow lq-glow-b" />
        <span className="lq-glow lq-glow-c" />
        <span className="lq-grid" />
      </div>

      <div className="lq-head">
        <p className="lq-eyebrow">
          <Sparkles size={13} /> {heading ?? 'Explore the verified IT companies'}
        </p>
        <h2>The ecosystem you will be hired by.</h2>
        <p className="lq-sub">
          Move through the company logos and open any of them for a verified profile sketch. Sign in to turn any
          company into a guided mock-test session.
        </p>
      </div>

      {loading && <div className="lq-status lq-loading" role="status">Loading company showcase…</div>}

      {!loading && error && (
        <div className="lq-status lq-error" role="alert">
          <TriangleAlert size={18} />
          <div>
            <strong>Company showcase could not load</strong>
            <p>{error}</p>
          </div>
          <button type="button" className="btn btn-outline-light btn-sm" onClick={reload}>
            Try again
          </button>
        </div>
      )}

      {!loading && !error && companies.length === 0 && (
        <div className="lq-status lq-error" role="status">
          <Building2 size={18} />
          <p>No company profiles are published in this workspace yet.</p>
        </div>
      )}

      {!loading && !error && companies.length > 0 && track}
    </section>
  );
}
