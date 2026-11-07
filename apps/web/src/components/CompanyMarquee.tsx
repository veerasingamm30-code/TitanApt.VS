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
};

type FailingLogos = Record<string, boolean>;

function hueFrom(initials: string): number {
  return [...initials].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 360;
}

/** Pre-login company logo marquee. Every verified company from the workspace
 *  database moves continuously right-to-left on a seamless, doubled track.
 *  Hovering or focusing the strip pauses the motion; each logo card is a
 *  button that opens a public company information panel. A mock-test call to
 *  action preserves the intended workspace destination through the login
 *  redirect. Renders loading, error and empty states for the public fetch;
 *  static layout under prefers-reduced-motion. */
export function CompanyMarquee({ heading }: { heading?: string }) {
  const { data, loading, error, reload } = useApi<PublicCompany[]>('/api/public/companies');
  const [failed, setFailed] = useState<FailingLogos>({});
  const [panel, setPanel] = useState<PublicCompany | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const companies = data ?? [];
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
          <Sparkles size={13} /> {heading ?? 'Explore 26 verified IT companies'}
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

      {!loading && !error && companies.length > 0 && (
        <div className="lq-marquee" tabIndex={-1}>
          <span className="lq-edge lq-edge-left" aria-hidden />
          <span className="lq-edge lq-edge-right" aria-hidden />
          <div className="lq-track-scroll">
            <div
              className="lq-track"
              role="list"
              aria-label="Participating companies"
              style={{ animationDuration: duration }}
              onMouseEnter={(event) => (event.currentTarget.style.animationPlayState = 'paused')}
              onMouseLeave={(event) => (event.currentTarget.style.animationPlayState = 'running')}
            >
              {[false, true].map((isClone) => (
                <div key={isClone ? 'clone' : 'primary'} className="lq-track-half" aria-hidden={isClone}>
                  {companies.map((company, index) => {
                    const showFallback = failed[company.slug];
                    return (
                      <div role="listitem" key={company.slug} className="lq-card">
                        <button
                          type="button"
                          className="lq-card-btn"
                          onClick={() => !isClone && setPanel(company)}
                          aria-label={`${company.name} logo, open company information`}
                          tabIndex={isClone ? -1 : undefined}
                        >
                          {showFallback ? (
                            <span
                              className="lq-logo lq-logo-fallback"
                              style={{ background: `hsl(${hueFrom(company.initials)}, 42%, 30%)` }}
                            >
                              {company.initials}
                            </span>
                          ) : (
                            <img
                              className="lq-logo"
                              src={company.logoUrl}
                              alt={isClone ? '' : `${company.name} logo`}
                              loading="lazy"
                              decoding="async"
                              onError={() => setFailed((current) => ({ ...current, [company.slug]: true }))}
                            />
                          )}
                          <span className="lq-name">{company.name}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {panel && (
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
                  <Link
                    to="/login"
                    state={{ from: `/app/mocks/company-mock-${panel.slug}` }}
                    className="lq-panel-cta"
                  >
                    <Lock size={14} /> Sign in to start the {panel.name} mock test
                  </Link>
                </footer>
                {panel.sourceNote && <small className="lq-panel-note">{panel.sourceNote}</small>}
              </aside>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
