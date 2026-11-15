import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  LoaderCircle,
  Maximize2,
  Minus,
  Plus,
  RotateCcw,
} from 'lucide-react';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = workerUrl;

const ZOOM_STEP = 0.25;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;

type Status = 'loading' | 'ready' | 'error';

type PdfViewerProps = {
  /** Same-origin PDF resource URL (e.g. /resources/volume-1.pdf). */
  src: string;
  title: string;
  /** Chapter's source page to open first (1-based). */
  initialPage?: number;
  /** File name suggested for the download button. */
  downloadName?: string;
};

/**
 * Canvas-based PDF viewer built on PDF.js. Chrome on Android cannot render
 * PDFs inside iframes, so the Learning Hub renders pages itself on a
 * responsive canvas (fit-to-width, zoomable, with navigation controls).
 */
export function PdfViewer({ src, title, initialPage = 1, downloadName }: PdfViewerProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const docRef = useRef<PDFDocumentProxy | null>(null);
  const renderTokenRef = useRef(0);

  const [status, setStatus] = useState<Status>('loading');
  const [errorText, setErrorText] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [page, setPage] = useState(() => Math.max(1, initialPage));
  const [zoom, setZoom] = useState(1);
  const [busy, setBusy] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const loadDocument = useCallback(async () => {
    const token = ++renderTokenRef.current;
    setBusy(true);
    setStatus('loading');
    setErrorText(null);
    try {
      const doc = await getDocument(src).promise;
      if (renderTokenRef.current !== token) {
        void doc.destroy();
        return;
      }
      docRef.current?.destroy().catch(() => undefined);
      docRef.current = doc;
      setPageCount(doc.numPages);
      setPage((current) => Math.min(Math.max(1, current), doc.numPages));
      setStatus('ready');
    } catch (err) {
      if (renderTokenRef.current !== token) return;
      setErrorText(err instanceof Error ? err.message : 'The PDF could not be loaded.');
      setStatus('error');
    } finally {
      if (renderTokenRef.current === token) setBusy(false);
    }
  }, [src]);

  useEffect(() => {
    void loadDocument();
    return () => {
      renderTokenRef.current += 1;
      const doc = docRef.current;
      docRef.current = null;
      doc?.destroy().catch(() => undefined);
    };
  }, [loadDocument]);

  // Render the current page onto the canvas whenever anything relevant changes.
  // All renders are serialized through a promise chain: ResizeObserver callbacks
  // can fire while a render is in flight, and PDF.js rejects concurrent renders
  // on the same canvas.
  useEffect(() => {
    const doc = docRef.current;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (status !== 'ready' || !doc || !canvas || !wrap) return;

    const token = ++renderTokenRef.current;
    let cancelled = false;

    async function renderNow(
      pdfDoc: PDFDocumentProxy,
      canvasEl: HTMLCanvasElement,
      wrapEl: HTMLElement,
    ) {
      if (cancelled || renderTokenRef.current !== token) return;
      try {
        const pdfPage = await pdfDoc.getPage(Math.min(Math.max(1, page), pdfDoc.numPages));
        if (cancelled || renderTokenRef.current !== token) return;
        const base = pdfPage.getViewport({ scale: 1 });
        const available = wrapEl.clientWidth - 24; // inner horizontal padding
        const fitScale = Math.max(0.1, available / base.width);
        const dpr = window.devicePixelRatio || 1;
        const viewport = pdfPage.getViewport({ scale: fitScale * zoom * dpr });
        const context = canvasEl.getContext('2d');
        if (!context) throw new Error('Canvas rendering is not available in this browser.');
        canvasEl.width = Math.floor(viewport.width);
        canvasEl.height = Math.floor(viewport.height);
        canvasEl.style.width = `${Math.floor(viewport.width / dpr)}px`;
        canvasEl.style.height = `${Math.floor(viewport.height / dpr)}px`;
        setBusy(true);
        const task = pdfPage.render({ canvasContext: context, viewport }) as unknown as {
          cancel: () => void;
          promise: Promise<unknown>;
        };
        try {
          await task.promise;
        } finally {
          setBusy(false);
        }
      } catch (err) {
        const isCancelled = err instanceof Error && err.name === 'RenderingCancelledException';
        if (!cancelled && renderTokenRef.current === token && !isCancelled) {
          setErrorText(err instanceof Error ? err.message : 'The page could not be rendered.');
          setStatus('error');
        }
      }
    }

    let chain: Promise<void> = Promise.resolve();
    const schedule = () => {
      chain = chain.then(() => renderNow(doc, canvas, wrap)).catch(() => undefined);
    };

    schedule();
    const observer = new ResizeObserver(schedule);
    observer.observe(wrap);

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [status, page, zoom]);

  useEffect(() => {
    function onChange() {
      setIsFullscreen(document.fullscreenElement === wrapRef.current);
    }
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  function go(delta: number) {
    setPage((current) => Math.min(Math.max(1, current + delta), pageCount));
  }

  function toggleFullscreen() {
    const wrap = wrapRef.current;
    if (!wrap) return;
    if (document.fullscreenElement === wrap) void document.exitFullscreen();
    else void wrap.requestFullscreen().catch(() => undefined);
  }

  return (
    <div className={`pdf-viewer ${isFullscreen ? 'is-fullscreen' : ''}`} ref={wrapRef}>
      <div className="pdf-viewer-toolbar">
        <div className="pdf-viewer-nav">
          <button type="button" className="pdf-btn" onClick={() => go(-1)} disabled={status !== 'ready' || page <= 1} aria-label="Previous page">
            <ChevronLeft size={16} />
          </button>
          <span className="pdf-page-indicator" aria-live="polite">
            {status === 'ready' ? `Page ${page} of ${pageCount}` : '—'}
          </span>
          <button type="button" className="pdf-btn" onClick={() => go(1)} disabled={status !== 'ready' || page >= pageCount} aria-label="Next page">
            <ChevronRight size={16} />
          </button>
        </div>
        <div className="pdf-viewer-zoom">
          <button type="button" className="pdf-btn" onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP))} disabled={status !== 'ready' || zoom <= MIN_ZOOM} aria-label="Zoom out">
            <Minus size={16} />
          </button>
          <span className="pdf-page-indicator">{Math.round(zoom * 100)}%</span>
          <button type="button" className="pdf-btn" onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP))} disabled={status !== 'ready' || zoom >= MAX_ZOOM} aria-label="Zoom in">
            <Plus size={16} />
          </button>
        </div>
        <div className="pdf-viewer-tools">
          <button type="button" className="pdf-btn" onClick={toggleFullscreen} aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
            <Maximize2 size={15} />
          </button>
          <a href={src} target="_blank" rel="noreferrer noopener" className="pdf-btn" aria-label="Open PDF in a new tab">
            <ExternalLink size={15} />
          </a>
          <a href={src} download={downloadName} className="pdf-btn" aria-label="Download PDF">
            <Download size={15} />
          </a>
        </div>
      </div>

      <div className="pdf-viewer-body">
        {status === 'loading' && (
          <div className="pdf-viewer-status" role="status" aria-live="polite">
            <LoaderCircle className="spin" size={26} aria-hidden />
            <p>Loading “{title}”…</p>
          </div>
        )}
        {status === 'error' && (
          <div className="pdf-viewer-status state-error" role="alert">
            <p>{errorText ?? 'The PDF could not be loaded.'}</p>
            <button type="button" className="btn btn-secondary" onClick={() => void loadDocument()}>
              <RotateCcw size={15} /> Retry
            </button>
            <a href={src} target="_blank" rel="noreferrer noopener" className="text-link">
              Open the PDF in a new tab instead <ExternalLink size={14} />
            </a>
          </div>
        )}
        <canvas
          ref={canvasRef}
          className={`pdf-viewer-canvas ${status === 'ready' ? '' : 'is-hidden'}`}
          aria-label={`PDF page viewer: ${title}`}
        />
      </div>
      {busy && status === 'ready' && (
        <span className="pdf-viewer-busy" role="status" aria-live="polite">
          <LoaderCircle className="spin" size={14} aria-hidden /> Rendering…
        </span>
      )}
    </div>
  );
}
