import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/TextLayer.css';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CloudUpload,
  Eye,
  FileX,
  Save,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import Button from '../../components/ui/Button';
import { ThemeToggle } from '../../components/layout/Brand';
import { EmptyState, ErrorState, LoadingState, Spinner } from '../../components/ui/States';
import { booksApi, libraryApi } from '../../api';
import { useToast } from '../../context/ToastContext';
import { useApi } from '../../hooks/useApi';
import { useDocumentTitle } from '../../hooks/misc';
import { formatRelative } from '../../utils/format';

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const DEFAULT_ZOOM = 2;
const MAX_PAGE_WIDTH = 860;
const AUTOSAVE_DELAY_MS = 1200;

// Downloads the PDF through the API (which checks the login) and exposes it
// as a local blob URL for PDF.js.
function usePdfFile(bookId, enabled) {
  const [state, setState] = useState({ status: 'idle', progress: 0, url: null, error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) return undefined;
    const controller = new AbortController();
    let objectUrl = null;
    setState({ status: 'loading', progress: 0, url: null, error: null });
    booksApi
      .pdf(bookId, {
        signal: controller.signal,
        onProgress: (progress) => setState((s) => ({ ...s, progress })),
      })
      .then((data) => {
        objectUrl = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
        setState({ status: 'ready', progress: 1, url: objectUrl, error: null });
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setState({ status: 'error', progress: 0, url: null, error });
      });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [bookId, enabled, attempt]);

  return { ...state, retry: () => setAttempt((n) => n + 1) };
}

function useElementWidth(ref) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

function SaveStatus({ save, isPreview, onRetry }) {
  if (isPreview) {
    return (
      <span className="save-status">
        <Eye aria-hidden="true" /> Preview: progress is not saved for administrators
      </span>
    );
  }
  switch (save.status) {
    case 'pending':
      return <span className="save-status">Unsaved changes</span>;
    case 'saving':
      return (
        <span className="save-status">
          <Spinner /> Saving…
        </span>
      );
    case 'saved':
      return (
        <span className="save-status save-status--ok">
          <CircleCheck aria-hidden="true" /> Saved {formatRelative(save.at)}
        </span>
      );
    case 'error':
      return (
        <span className="save-status save-status--error">
          <CircleAlert aria-hidden="true" /> Not saved.{' '}
          <button type="button" className="text-link" onClick={onRetry}>
            Retry
          </button>
        </span>
      );
    case 'resumed':
      return (
        <span className="save-status">
          <CloudUpload aria-hidden="true" /> Resumed at page {save.page}
        </span>
      );
    default:
      return (
        <span className="save-status">
          <CloudUpload aria-hidden="true" /> Your page is saved automatically
        </span>
      );
  }
}

export default function ReaderPage({ mode = 'reader' }) {
  const isPreview = mode === 'preview';
  const { id } = useParams();
  const bookId = Number(id);
  const toast = useToast();
  const backTo = isPreview ? `/admin/books/${id}` : `/app/books/${id}`;

  // 1. The book and, for readers, their saved position.
  const meta = useApi(
    async (signal) => {
      const [{ book }, progress] = await Promise.all([
        booksApi.get(id, signal),
        isPreview ? null : libraryApi.getProgress(id, signal).then((r) => r.progress),
      ]);
      return { book, progress };
    },
    [id, isPreview]
  );
  const book = meta.data?.book;
  useDocumentTitle(book ? `Reading ${book.title}` : 'Reader');

  // 2. The PDF itself.
  const pdf = usePdfFile(bookId, Boolean(book?.hasPdf));

  // 3. Position, zoom and saving.
  const [numPages, setNumPages] = useState(null);
  const [page, setPage] = useState(1);
  const [pageInput, setPageInput] = useState('1');
  const [zoomIndex, setZoomIndex] = useState(DEFAULT_ZOOM);
  const [documentError, setDocumentError] = useState(null);
  const [save, setSave] = useState({ status: 'idle' });

  const pageRef = useRef(page);
  const numPagesRef = useRef(numPages);
  const savedPageRef = useRef(null);
  const statusRef = useRef(null);
  pageRef.current = page;
  numPagesRef.current = numPages;

  const stageRef = useRef(null);
  const stageWidth = useElementWidth(stageRef);
  const pageWidth = Math.max(
    200,
    Math.round(Math.min(Math.max(stageWidth - 32, 200), MAX_PAGE_WIDTH) * ZOOM_STEPS[zoomIndex])
  );

  useEffect(() => {
    setPageInput(String(page));
  }, [page]);

  const onDocumentLoad = ({ numPages: total }) => {
    const saved = meta.data?.progress?.currentPage || 0;
    const start = Math.min(Math.max(1, saved), total);
    statusRef.current = meta.data?.progress?.readingStatus ?? null;
    savedPageRef.current = saved > 0 ? start : null;
    setDocumentError(null);
    setNumPages(total);
    setPage(start);
    if (saved > 1) setSave({ status: 'resumed', page: start });
  };

  const persist = useCallback(
    async (targetPage, { manual = false } = {}) => {
      if (isPreview || !numPagesRef.current) return;
      setSave({ status: 'saving' });
      try {
        const { progress } = await libraryApi.saveProgress(bookId, {
          currentPage: targetPage,
          totalPages: numPagesRef.current,
        });
        savedPageRef.current = progress.currentPage;
        setSave({ status: pageRef.current === progress.currentPage ? 'saved' : 'pending', at: progress.updatedAt });
        if (manual) toast.success(`Your place is saved at page ${targetPage}.`, 'Progress saved');
        if (progress.readingStatus === 'read' && statusRef.current !== 'read') {
          toast.success('You reached the last page. The book is now marked as Read.', 'Finished!');
        }
        statusRef.current = progress.readingStatus;
      } catch (error) {
        setSave({ status: 'error', error });
        if (manual) toast.error(error.message);
      }
    },
    [bookId, isPreview, toast]
  );

  // Automatic saving, shortly after the reader stops turning pages.
  useEffect(() => {
    if (isPreview || !numPages || page === savedPageRef.current) return undefined;
    setSave((s) => (s.status === 'saving' ? s : { status: 'pending' }));
    const timer = setTimeout(() => persist(page), AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [page, numPages, isPreview, persist]);

  // Save one last time when the reader leaves the page or closes the tab.
  useEffect(() => {
    if (isPreview) return undefined;
    const flush = () => {
      const current = pageRef.current;
      if (!numPagesRef.current || current === savedPageRef.current) return;
      savedPageRef.current = current;
      libraryApi
        .saveProgress(bookId, { currentPage: current, totalPages: numPagesRef.current }, { keepalive: true })
        .catch(() => {});
    };
    const onVisibility = () => document.visibilityState === 'hidden' && flush();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [bookId, isPreview]);

  // Closing the reader with the back arrow saves first, so the book page it
  // returns to already shows the new position.
  const navigate = useNavigate();
  const closeReader = async (event) => {
    if (isPreview || !numPagesRef.current || pageRef.current === savedPageRef.current) return;
    event.preventDefault();
    await persist(pageRef.current);
    navigate(backTo);
  };

  const goTo = useCallback((target) => {
    const total = numPagesRef.current || 1;
    setPage(Math.min(Math.max(1, target), total));
  }, []);

  // Keyboard: arrows and Page Up/Down turn pages, + and - zoom.
  useEffect(() => {
    const onKey = (event) => {
      if (event.target.closest('input, select, textarea, [contenteditable]') || event.metaKey || event.ctrlKey) return;
      if (event.key === 'ArrowRight' || event.key === 'PageDown') goTo(pageRef.current + 1);
      else if (event.key === 'ArrowLeft' || event.key === 'PageUp') goTo(pageRef.current - 1);
      else if (event.key === '+' || event.key === '=') setZoomIndex((z) => Math.min(z + 1, ZOOM_STEPS.length - 1));
      else if (event.key === '-') setZoomIndex((z) => Math.max(z - 1, 0));
      else return;
      event.preventDefault();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [goTo]);

  // Turning the page brings the reader back to its top.
  useEffect(() => {
    stageRef.current?.scrollTo({ top: 0 });
  }, [page]);

  const submitPageInput = (event) => {
    event.preventDefault();
    const target = Number(pageInput);
    if (Number.isInteger(target)) goTo(target);
    else setPageInput(String(page));
  };

  const percent = numPages ? Math.round((page / numPages) * 100) : 0;

  let stageContent;
  if (meta.loading && !meta.data) {
    stageContent = <LoadingState label="Opening the book…" />;
  } else if (meta.error) {
    stageContent = (
      <ErrorState
        title={meta.error.status === 404 ? 'Book not found' : 'This book could not be opened'}
        error={meta.error}
        onRetry={meta.error.status === 404 ? undefined : meta.reload}
      >
        <Button as={Link} to={isPreview ? '/admin/books' : '/app/catalogue'} variant="ghost">
          Back to the catalogue
        </Button>
      </ErrorState>
    );
  } else if (!book.hasPdf) {
    stageContent = (
      <EmptyState icon={FileX} title="No PDF for this book yet" text="The librarian has not added a file for this title.">
        <Button as={Link} to={backTo} variant="secondary">
          Back to the book
        </Button>
      </EmptyState>
    );
  } else if (pdf.status === 'error') {
    stageContent = <ErrorState title="The PDF could not be loaded" error={pdf.error} onRetry={pdf.retry} />;
  } else if (pdf.status !== 'ready') {
    const loaded = Math.round(pdf.progress * 100);
    stageContent = (
      <div className="reader-loading" role="status">
        <Spinner large />
        <p>Fetching “{book.title}”…</p>
        <div className="meter__track reader-loading__track" aria-hidden="true">
          <div className="meter__fill" style={{ width: `${loaded}%` }} />
        </div>
        <span className="muted tabular">{loaded}%</span>
      </div>
    );
  } else if (documentError) {
    stageContent = (
      <ErrorState
        title="This PDF could not be opened"
        message="The file seems to be damaged or is not a valid PDF."
        onRetry={() => {
          setDocumentError(null);
          pdf.retry();
        }}
      />
    );
  } else {
    stageContent = (
      <Document
        file={pdf.url}
        onLoadSuccess={onDocumentLoad}
        onLoadError={(error) => setDocumentError(error)}
        loading={<LoadingState label="Preparing pages…" />}
        className="reader-document"
      >
        {numPages && (
          <Page
            pageNumber={page}
            width={pageWidth}
            renderAnnotationLayer={false}
            className="reader-page"
            loading={<div className="reader-page__placeholder" style={{ width: pageWidth, height: pageWidth * 1.41 }} />}
          />
        )}
      </Document>
    );
  }

  const ready = Boolean(numPages) && pdf.status === 'ready' && !documentError;

  return (
    <div className="reader">
      <header className="reader-bar">
        <Link
          to={backTo}
          onClick={closeReader}
          className="icon-btn reader-bar__back"
          aria-label="Close the reader and go back to the book"
        >
          <ArrowLeft aria-hidden="true" />
        </Link>
        <div className="reader-bar__title">
          <strong>{book?.title || 'Loading…'}</strong>
          {book && <span>{book.author}</span>}
        </div>
        <div className="reader-bar__tools">
          <div className="zoom" role="group" aria-label="Zoom">
            <button
              type="button"
              className="icon-btn"
              onClick={() => setZoomIndex((z) => Math.max(z - 1, 0))}
              disabled={!ready || zoomIndex === 0}
              aria-label="Zoom out"
            >
              <ZoomOut aria-hidden="true" />
            </button>
            <button
              type="button"
              className="zoom__value tabular"
              onClick={() => setZoomIndex(DEFAULT_ZOOM)}
              disabled={!ready}
              aria-label={`Zoom ${Math.round(ZOOM_STEPS[zoomIndex] * 100)}%. Reset to 100%`}
            >
              {Math.round(ZOOM_STEPS[zoomIndex] * 100)}%
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setZoomIndex((z) => Math.min(z + 1, ZOOM_STEPS.length - 1))}
              disabled={!ready || zoomIndex === ZOOM_STEPS.length - 1}
              aria-label="Zoom in"
            >
              <ZoomIn aria-hidden="true" />
            </button>
          </div>
          <ThemeToggle />
          {!isPreview && (
            <Button
              variant="secondary"
              size="sm"
              icon={Save}
              className="reader-bar__save"
              onClick={() => persist(page, { manual: true })}
              disabled={!ready}
              loading={save.status === 'saving'}
              aria-label="Save my progress"
            >
              <span className="reader-bar__save-label">Save progress</span>
            </Button>
          )}
        </div>
      </header>

      <main className="reader-stage" ref={stageRef} aria-label="Book page" tabIndex={-1}>
        {stageContent}
      </main>

      <footer className="reader-nav">
        <div className="reader-nav__progress">
          <div
            className="meter__track"
            role="progressbar"
            aria-label="Reading progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
          >
            <div className="meter__fill" style={{ width: `${percent}%` }} />
          </div>
        </div>
        <div className="reader-nav__row">
          <Button variant="secondary" size="sm" icon={ChevronLeft} onClick={() => goTo(page - 1)} disabled={!ready || page <= 1}>
            <span className="reader-nav__label">Previous</span>
          </Button>

          <form className="page-jump" onSubmit={submitPageInput}>
            <label htmlFor="page-input" className="page-jump__label">
              Page
            </label>
            <input
              id="page-input"
              className="input page-jump__input tabular"
              inputMode="numeric"
              value={pageInput}
              onChange={(event) => setPageInput(event.target.value.replace(/\D/g, ''))}
              onBlur={submitPageInput}
              disabled={!ready}
              aria-describedby="page-total"
            />
            <span id="page-total" className="page-jump__total tabular">
              of {numPages ?? '–'}
            </span>
            <span className="page-jump__percent tabular">· {percent}%</span>
          </form>

          <Button
            variant="secondary"
            size="sm"
            iconAfter={ChevronRight}
            onClick={() => goTo(page + 1)}
            disabled={!ready || page >= numPages}
          >
            <span className="reader-nav__label">Next</span>
          </Button>
        </div>
        <div className="reader-nav__status" aria-live="polite">
          <SaveStatus save={save} isPreview={isPreview} onRetry={() => persist(page, { manual: true })} />
        </div>
      </footer>
    </div>
  );
}
