import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Globe, MapPin, Rocket, Sparkles, X } from 'lucide-react';

export type OrbitCompany = {
  id: string;
  slug: string;
  name: string;
  initials: string;
  logoUrl: string;
  industry: string;
  overview?: string | null;
  website?: string | null;
  headquarters?: string | null;
  founded?: string | null;
  mainBusiness?: string | null;
};

type CompanyLogos = Record<string, boolean>;

/** Canonical showcase order for the premium Top-10 orbit. Companies missing
 *  from the database are silently skipped — the orbit only ever renders real
 *  records, never invented ones. */
const TOP_TEN_SLUGS = [
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
] as const;

function hueFrom(initials: string): number {
  return [...initials].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 360;
}

/** Premium 3D company orbit: ten official logo cards circle a glowing
 *  TitanApt core on a tilted orbital plane. Rotation runs on CSS transforms;
 *  hovering a card pauses the whole system, highlights it and reveals its
 *  name. Clicking (or pressing Enter) opens an information panel built from
 *  the company's verified database profile. Keyboard focusable, touch friendly,
 *  and rendered static under prefers-reduced-motion. */
export function CompanyOrbit({ companies }: { companies: OrbitCompany[] }) {
  const [failed, setFailed] = useState<CompanyLogos>({});
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [panelSlug, setPanelSlug] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  const topTen = useMemo(() => {
    const bySlug = new Map(companies.map((company) => [company.slug, company]));
    return TOP_TEN_SLUGS.map((slug) => bySlug.get(slug)).filter(
      (company): company is OrbitCompany => Boolean(company),
    );
  }, [companies]);

  const panelCompany = panelSlug ? topTen.find((company) => company.slug === panelSlug) ?? null : null;

  // close the info panel on Escape and keep focus in its dialog
  useEffect(() => {
    if (!panelCompany) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPanelSlug(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [panelCompany]);

  if (topTen.length === 0) return null;

  const step = 360 / topTen.length;

  return (
    <div
      className={`orbit-scene ${paused ? 'is-paused' : ''} ${panelCompany ? 'has-panel' : ''}`}
      aria-label="Explore the top 10 IT companies"
    >
      <div className="orbit-stage">
        {/* decorative ecliptic rings behind the logo plane */}
        <div className="orbit-ring orbit-ring-outer" aria-hidden />
        <div className="orbit-ring orbit-ring-inner" aria-hidden />
        <div className="orbit-shadow" aria-hidden />

        <div className="orbit-core" aria-hidden={!panelCompany}>
          <div className="orbit-core-glow" />
          <img src="/titanapt-logo-small.png" alt="" />
          <div className="orbit-core-copy">
            <strong>TitanApt</strong>
            <span>TOP 10 IT COMPANIES</span>
            <small>
              LEARN <i>•</i> PRACTICE <i>•</i> ACHIEVE
            </small>
          </div>
        </div>

        <div className="orbit-tilt">
          <div className="orbit-spin orbit-forward">
            {topTen.map((company, index) => {
              const angle = step * index;
              const showFallback = failed[company.slug];
              const isActive = activeSlug === company.slug;
              return (
                <div
                  className="orbit-point"
                  key={company.id}
                  style={{ transform: `rotate(${angle}deg) translateY(calc(var(--orbit-radius) * -1))` }}
                >
                  <div className="orbit-counter orbit-reverse">
                    <div className="orbit-logo-static" style={{ transform: `rotate(${-angle}deg)` }}>
                      <button
                        type="button"
                        className={`orbit-logo ${isActive ? 'hovered' : ''}`}
                        onMouseEnter={() => { setActiveSlug(company.slug); setPaused(true); }}
                        onMouseLeave={() => { setActiveSlug((current) => (current === company.slug ? null : current)); setPaused(false); }}
                        onFocus={() => { setActiveSlug(company.slug); setPaused(true); }}
                        onBlur={() => { setActiveSlug((current) => (current === company.slug ? null : current)); setPaused(false); }}
                        onClick={() => setPanelSlug(company.slug)}
                        onTouchEnd={() => { setActiveSlug(company.slug); setPanelSlug(company.slug); }}
                        title={company.name}
                        aria-haspopup="dialog"
                        aria-expanded={panelSlug === company.slug}
                        aria-label={`${company.name}, show company information`}
                      >
                        {showFallback ? (
                          <span
                            className="orbit-initials"
                            style={{ background: `hsl(${hueFrom(company.initials)}, 45%, 32%)` }}
                          >
                            {company.initials}
                          </span>
                        ) : (
                          <img
                            src={company.logoUrl}
                            alt={`${company.name} logo`}
                            width={56}
                            height={56}
                            loading={index < 4 ? 'eager' : 'lazy'}
                            onError={() => setFailed((current) => ({ ...current, [company.slug]: true }))}
                          />
                        )}
                      </button>
                      <span className={`orbit-tooltip ${isActive ? 'visible' : ''}`} aria-hidden>
                        <strong>{company.name}</strong>
                        {company.industry && <small>{company.industry}</small>}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <p className="orbit-hint">
        Hover a logo to pause the orbit and reveal the company. Click it for a verified snapshot from its
        TitanApt profile.
      </p>

      {panelCompany && (
        <div
          className="orbit-panel-backdrop"
          role="presentation"
          onClick={() => setPanelSlug(null)}
        >
          <aside
            className="orbit-panel"
            role="dialog"
            aria-modal="true"
            aria-label={`${panelCompany.name} company information`}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="orbit-panel-head">
              <span className="orbit-panel-logo">
                {failed[panelCompany.slug] ? (
                  <span
                    className="orbit-initials"
                    style={{ background: `hsl(${hueFrom(panelCompany.initials)}, 45%, 32%)` }}
                  >
                    {panelCompany.initials}
                  </span>
                ) : (
                  <img src={panelCompany.logoUrl} alt={`${panelCompany.name} logo`} width={54} height={54} />
                )}
              </span>
              <div>
                <p className="orbit-panel-eyebrow">
                  <Sparkles size={12} /> TOP 10 IT COMPANIES
                </p>
                <h3>{panelCompany.name}</h3>
              </div>
              <button
                type="button"
                ref={closeRef}
                className="icon-btn orbit-panel-close"
                onClick={() => setPanelSlug(null)}
                aria-label={`Close ${panelCompany.name} information`}
              >
                <X size={16} />
              </button>
            </header>

            {panelCompany.overview && <p className="orbit-panel-overview">{panelCompany.overview}</p>}

            <dl className="orbit-panel-facts">
              {panelCompany.mainBusiness && (
                <div>
                  <dt><Building2 size={13} /> Main business</dt>
                  <dd>{panelCompany.mainBusiness}</dd>
                </div>
              )}
              {panelCompany.industry && (
                <div>
                  <dt><Rocket size={13} /> Industries</dt>
                  <dd>{panelCompany.industry}</dd>
                </div>
              )}
              {panelCompany.headquarters && (
                <div>
                  <dt><MapPin size={13} /> Headquarters</dt>
                  <dd>{panelCompany.headquarters}</dd>
                </div>
              )}
              {panelCompany.founded && (
                <div>
                  <dt><Sparkles size={13} /> Founded</dt>
                  <dd>{panelCompany.founded}</dd>
                </div>
              )}
            </dl>

            <footer className="orbit-panel-actions">
              <Link to={`/app/companies/${panelCompany.slug}`} className="btn btn-accent btn-sm" onClick={() => setPanelSlug(null)}>
                Learning topics & placement prep <Globe size={14} />
              </Link>
              {panelCompany.website && (
                <a href={panelCompany.website} target="_blank" rel="noreferrer noopener" className="btn btn-ghost btn-sm">
                  Official website
                </a>
              )}
            </footer>
            <small className="orbit-panel-note">
              Profile facts come from this workspace's verified company database.
            </small>
          </aside>
        </div>
      )}
    </div>
  );
}
