import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  ExternalLink,
  Layers3,
} from 'lucide-react';
import { apiData, messageFromError } from '../lib/api';
import { useApi, useDocumentTitle } from '../lib/useApi';
import { ErrorState, Loader, PageHeader, ProgressBar } from '../components/ui';

type Chapter = {
  key: string;
  title: string;
  page: number;
  excerpt: string;
  topicSlug: string | null;
  completed: boolean;
};

type Volume = {
  slug: string;
  title: string;
  filename: string;
  pageCount: number;
  sourcePath: string;
  referencePath?: string;
  resourceUrl: string;
  warnings?: string[];
  chapters: Chapter[];
};

const LAST_OPENED_KEY = 'titanapt-hub-last-opened';

export function LearningHubPage() {
  useDocumentTitle('Learning Hub');
  const { data, loading, error, reload, setData } = useApi<Volume[]>('/api/learning/volumes');
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{ volumeSlug: string; chapterIndex: number } | null>(null);

  // restore the last chapter the learner had open (survives refreshes)
  const volumes = data ?? [];
  const initialRestored = useMemo(() => {
    if (volumes.length === 0 || viewer !== null) return false;
    try {
      const stored = window.localStorage.getItem(LAST_OPENED_KEY);
      if (!stored) return false;
      const parsed = JSON.parse(stored) as { volumeSlug: string; chapterIndex: number };
      const volume = volumes.find((entry) => entry.slug === parsed.volumeSlug);
      if (volume && volume.chapters[parsed.chapterIndex]) {
        setViewer(parsed);
        setOpen(parsed.volumeSlug);
        return true;
      }
    } catch {
      // ignore malformed storage
    }
    return false;
  }, [volumes, viewer]);
  void initialRestored;

  useEffect(() => {
    if (!viewer) return;
    window.localStorage.setItem(LAST_OPENED_KEY, JSON.stringify(viewer));
  }, [viewer]);

  async function toggle(volume: Volume, chapter: Chapter) {
    const key = `${volume.slug}:${chapter.key}`;
    setBusy(key);
    setToggleError(null);
    try {
      await apiData('/api/learning/progress', {
        method: 'PATCH',
        body: { volumeSlug: volume.slug, chapterKey: chapter.key, completed: !chapter.completed },
      });
      setData((current) =>
        current?.map((entry) =>
          entry.slug === volume.slug
            ? {
                ...entry,
                chapters: entry.chapters.map((item) =>
                  item.key === chapter.key ? { ...item, completed: !item.completed } : item,
                ),
              }
            : entry,
        ) ?? null,
      );
    } catch (err) {
      setToggleError(messageFromError(err));
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <Loader label="Indexing the Learning Hub" />;
  if (error || !data) return <ErrorState message={error ?? 'Learning Hub unavailable.'} onRetry={reload} />;

  const totalChapters = data.reduce((sum, volume) => sum + volume.chapters.length, 0);
  const completedChapters = data.reduce((sum, volume) => sum + volume.chapters.filter((chapter) => chapter.completed).length, 0);

  const viewerVolume = viewer ? data.find((volume) => volume.slug === viewer.volumeSlug) ?? null : null;
  const viewerChapter = viewerVolume?.chapters[viewer?.chapterIndex ?? -1] ?? null;

  function openChapter(volumeSlug: string, chapterIndex: number) {
    setViewer({ volumeSlug, chapterIndex });
    setOpen(volumeSlug);
    try {
      document.getElementById('learning-viewer')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch {
      window.scrollTo({ top: 0 });
    }
  }

  function moveChapter(delta: number) {
    if (!viewer || !viewerVolume) return;
    const next = viewer.chapterIndex + delta;
    if (next < 0 || next >= viewerVolume.chapters.length) return;
    setViewer({ volumeSlug: viewer.volumeSlug, chapterIndex: next });
  }

  return (
    <div>
      <PageHeader
        eyebrow={`${data.length} source volumes`}
        title="Learning Hub"
        subtitle="Work through the supplied study volumes chapter by chapter. Progress is saved to your account."
        actions={<Link to="/app/learn" className="btn btn-secondary">Topic lessons <ArrowRight size={16} /></Link>}
      />

      {data.some((volume) => (volume.warnings?.length ?? 0) > 0) && (
        <div className="hub-warnings">
          {data
            .filter((volume) => (volume.warnings?.length ?? 0) > 0)
            .map((volume) => (
              <div className="form-error" role="alert" key={volume.slug}>{volume.title}: {volume.warnings?.join(' ')}</div>
            ))}
        </div>
      )}
      {toggleError && <div className="form-error" role="alert">{toggleError}</div>}

      <section className="learn-overview panel">
        <div>
          <span className="stat-label">Chapter completion</span>
          <h2>{completedChapters} <span className="muted">of {totalChapters}</span></h2>
          <ProgressBar value={completedChapters} max={Math.max(1, totalChapters)} label="Chapters completed" />
        </div>
        <div className="learn-legend">
          <div><Layers3 size={15} /><span>Volumes</span><strong>{data.length}</strong></div>
          <div><BookOpenCheck size={15} /><span>Pages indexed</span><strong>{data.reduce((sum, volume) => sum + volume.pageCount, 0)}</strong></div>
        </div>
      </section>

      {viewer && viewerVolume && viewerChapter && (
        <section className="panel learning-viewer" id="learning-viewer">
          <div className="learning-viewer-head">
            <div>
              <span className="eyebrow">{viewerVolume.title} · chapter {viewer.chapterIndex + 1} of {viewerVolume.chapters.length}</span>
              <h2>{viewerChapter.title}</h2>
              <small>Source page {viewerChapter.page} · PDF opens in the built-in viewer below</small>
            </div>
            <div className="learning-viewer-actions">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => moveChapter(-1)} disabled={viewer.chapterIndex === 0}>
                <ChevronLeft size={15} /> Prev chapter
              </button>
              <button
                type="button"
                className={`btn btn-sm ${viewerChapter.completed ? 'btn-secondary' : 'btn-accent'}`}
                onClick={() => void toggle(viewerVolume, viewerChapter)}
                disabled={busy === `${viewerVolume.slug}:${viewerChapter.key}`}
              >
                {viewerChapter.completed ? <CheckCircle2 size={15} /> : <Circle size={15} />}
                {viewerChapter.completed ? 'Completed' : 'Mark complete'}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => moveChapter(1)} disabled={viewer.chapterIndex >= viewerVolume.chapters.length - 1}>
                Next chapter <ChevronRight size={15} />
              </button>
            </div>
          </div>
          {viewerChapter.topicSlug && (
            <p className="learning-topic-link">
              Mapped lesson: <Link to={`/app/learn/${viewerChapter.topicSlug}`} className="text-link">open the topic lesson <ArrowRight size={13} /></Link>
            </p>
          )}
          <iframe
            key={`${viewerVolume.slug}-${viewerChapter.key}`}
            src={`${viewerVolume.resourceUrl}#page=${viewerChapter.page}`}
            title={`${viewerVolume.title} — ${viewerChapter.title}`}
            loading="lazy"
            className="learning-pdf-frame"
          />
          <a href={`${viewerVolume.resourceUrl}#page=${viewerChapter.page}`} target="_blank" rel="noreferrer noopener" className="text-link">
            Open the source PDF in a new tab <ExternalLink size={14} />
          </a>
        </section>
      )}

      <div className="learning-volume-list">
        {data.map((volume) => {
          const done = volume.chapters.filter((chapter) => chapter.completed).length;
          const isOpen = open === volume.slug;
          return (
            <section className={`panel learning-volume ${volume.chapters.length === 0 ? 'is-empty' : ''}`} key={volume.slug}>
              <button
                type="button"
                className="learning-volume-head"
                onClick={() => setOpen(isOpen ? null : volume.slug)}
                aria-expanded={isOpen}
              >
                <span className="learning-volume-icon"><BookOpenCheck size={20} /></span>
                <span className="learning-volume-copy">
                  <strong>{volume.title}</strong>
                  <small>{volume.filename} · {volume.pageCount} pages · {volume.chapters.length} chapters</small>
                </span>
                <span className="learning-volume-score">{done}/{volume.chapters.length}</span>
                <ChevronDown size={18} className={isOpen ? 'rotate-180' : ''} />
              </button>
              <ProgressBar value={done} max={Math.max(1, volume.chapters.length)} />
              {isOpen && (
                <div className="learning-chapters">
                  <div className="learning-chapter-tools">
                    <a href={volume.resourceUrl} target="_blank" rel="noreferrer noopener" className="text-link">
                      Open source PDF <ExternalLink size={14} />
                    </a>
                    <span className="muted">{volume.referencePath ?? volume.sourcePath}</span>
                  </div>
                  {volume.chapters.map((chapter, chapterIndex) => {
                    const key = `${volume.slug}:${chapter.key}`;
                    return (
                      <div className={`learning-chapter ${chapter.completed ? 'is-done' : ''}`} key={chapter.key}>
                        <button
                          type="button"
                          className="chapter-check"
                          aria-label={chapter.completed ? `Mark ${chapter.title} incomplete` : `Mark ${chapter.title} complete`}
                          aria-pressed={chapter.completed}
                          disabled={busy === key}
                          onClick={() => void toggle(volume, chapter)}
                        >
                          {chapter.completed ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                        </button>
                        <div>
                          <button type="button" className="chapter-open" onClick={() => openChapter(volume.slug, chapterIndex)}>
                            <strong>{chapter.title}</strong>
                            <small>Page {chapter.page}{chapter.excerpt ? ` · ${chapter.excerpt.slice(0, 110)}...` : ''}</small>
                          </button>
                        </div>
                        {chapter.topicSlug && <Link to={`/app/learn/${chapter.topicSlug}`} className="icon-link" aria-label={`Open ${chapter.title} lesson`}><ArrowRight size={15} /></Link>}
                      </div>
                    );
                  })}
                  {volume.chapters.length === 0 && <p className="muted">No chapter index is available for this volume yet — the source PDF is still openable above.</p>}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
