import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X } from 'lucide-react';

type SearchHit = { type: string; title: string; subtitle?: string; route: string };
type SearchGroup = { label: string; hits: SearchHit[] };

const DEBOUNCE_MS = 180;

/** Dashboard search bar: searches real application data (topics, lessons,
 *  practice categories, companies, mock tests, study volumes and navigation
 *  destinations) through the /api/search endpoint. Case-insensitive partial
 *  matching, keyboard navigation (↑/↓/Enter/Escape) and grouping happen here. */
export function SearchBar() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const flat = useMemo(() => groups.flatMap((group) => group.hits), [groups]);
  const total = flat.length;

  useEffect(() => {
    const term = query.trim();
    if (term.length === 0) {
      setGroups([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, {
          credentials: 'include',
          signal: controller.signal,
        });
        const body = (await res.json()) as { data?: { groups: SearchGroup[] } };
        const nextGroups = body.data?.groups ?? [];
        setGroups(nextGroups);
        setActiveIndex(0);
        setOpen(true);
      } catch {
        // aborted or network hiccup: keep previous results
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && document.activeElement === inputRef.current) setOpen(false);
      if ((event.key === '/' || event.key === 'k') && (document.activeElement === document.body) && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  function go(hit: SearchHit) {
    setOpen(false);
    setQuery('');
    setGroups([]);
    navigate(hit.route);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (!open && total > 0) setOpen(true);
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((value) => (total === 0 ? 0 : (value + 1) % total));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((value) => (total === 0 ? 0 : (value - 1 + total) % total));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const hit = flat[activeIndex];
      if (hit) go(hit);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div className={`search-bar ${open ? 'is-open' : ''}`} ref={containerRef}>
      <Search size={17} className="search-icon" aria-hidden />
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          if (event.target.value.trim()) setOpen(true);
        }}
        onKeyDown={onKeyDown}
        onFocus={() => { if (groups.length > 0) setOpen(true); }}
        placeholder="Search topics, lessons, companies, mock tests… (press /)"
        aria-label="Search TitanApt"
        aria-expanded={open && total > 0}
        role="combobox"
        aria-controls="search-results"
        autoComplete="off"
      />
      {loading && <span className="search-spinner" aria-hidden />}
      {query && (
        <button
          type="button"
          className="icon-btn search-clear"
          aria-label="Clear search"
          onClick={() => { setQuery(''); setGroups([]); inputRef.current?.focus(); }}
        >
          <X size={14} />
        </button>
      )}
      {open && query.trim() && (
        <div className="search-results" id="search-results" role="listbox" aria-label="Search results">
          {total === 0 && !loading ? (
            <p className="search-empty">No matches for “{query.trim()}”. Try a topic name, a company or a section of the app.</p>
          ) : (
            groups.map((group) => (
              <div className="search-group" key={group.label}>
                <span className="search-group-label">{group.label}</span>
                {group.hits.map((hit) => {
                  const index = flat.indexOf(hit);
                  return (
                    <button
                      type="button"
                      role="option"
                      aria-selected={index === activeIndex}
                      className={`search-hit ${index === activeIndex ? 'active' : ''}`}
                      key={`${group.label}-${hit.route}-${hit.title}`}
                      onClick={() => go(hit)}
                      onPointerEnter={() => setActiveIndex(index)}
                    >
                      <span className="search-hit-copy">
                        <strong>{hit.title}</strong>
                        {hit.subtitle && <small>{hit.subtitle}</small>}
                      </span>
                      <span className="search-hit-type">{hit.type}</span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
