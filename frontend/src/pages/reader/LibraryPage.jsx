import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BookOpen, Library, Trash2 } from 'lucide-react';
import Button from '../../components/ui/Button';
import BookCover from '../../components/books/BookCover';
import { ConfirmDialog } from '../../components/ui/Modal';
import { PageHeader, ProgressMeter, StatusBadge } from '../../components/ui/Display';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';
import { libraryApi } from '../../api';
import { useToast } from '../../context/ToastContext';
import { useApi } from '../../hooks/useApi';
import { useDocumentTitle } from '../../hooks/misc';
import { READING_STATUSES, STATUS_LABELS, formatRelative } from '../../utils/format';

const TABS = [{ value: '', label: 'All books', countKey: 'total' }].concat(
  READING_STATUSES.map((s) => ({ value: s.value, label: s.label, countKey: { to_read: 'toRead', reading: 'reading', read: 'read' }[s.value] }))
);

const EMPTY_TEXT = {
  '': 'Your library is empty. Add books from the catalogue to start your shelves.',
  to_read: 'No books waiting. Add one from the catalogue when something catches your eye.',
  reading: 'You are not reading anything right now. Open a book from your To Read shelf.',
  read: 'Books you finish will gather here.',
};

function LibraryItem({ entry, onStatusChange, onRemove, busy }) {
  const { book } = entry;
  const started = entry.currentPage > 0;
  const statusId = `status-${entry.id}`;
  return (
    <li className="library-item">
      <Link to={`/app/books/${book.id}`} className="library-item__cover" tabIndex={-1} aria-hidden="true">
        <BookCover book={book} />
      </Link>

      <div className="library-item__main">
        <div className="library-item__heading">
          <h2 className="library-item__title">
            <Link to={`/app/books/${book.id}`}>{book.title}</Link>
          </h2>
          <p className="library-item__author">{book.author}</p>
        </div>
        <div className="library-item__status">
          <StatusBadge status={entry.readingStatus} />
          <span className="muted library-item__updated">Updated {formatRelative(entry.updatedAt)}</span>
        </div>
        <ProgressMeter
          currentPage={entry.currentPage}
          totalPages={entry.totalPages}
          percent={entry.progressPercent}
          status={entry.readingStatus}
        />
      </div>

      <div className="library-item__actions">
        <label htmlFor={statusId} className="visually-hidden">
          Reading status for {book.title}
        </label>
        <select
          id={statusId}
          className="select library-item__select"
          value={entry.readingStatus}
          disabled={busy}
          onChange={(event) => onStatusChange(entry, event.target.value)}
        >
          {READING_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        {book.hasPdf ? (
          <Button as={Link} to={`/app/read/${book.id}`} icon={BookOpen} size="sm">
            {started ? 'Continue' : 'Read'}
          </Button>
        ) : (
          <span className="badge badge--muted">No PDF yet</span>
        )}
        <Button
          variant="danger-ghost"
          size="sm"
          icon={Trash2}
          onClick={() => onRemove(entry)}
          aria-label={`Remove ${book.title} from my library`}
        >
          Remove
        </Button>
      </div>
    </li>
  );
}

export default function LibraryPage() {
  useDocumentTitle('My Library');
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || '';
  const library = useApi((signal) => libraryApi.list(status || undefined, signal), [status]);
  const [busyId, setBusyId] = useState(null);
  const [toRemove, setToRemove] = useState(null);
  const [removing, setRemoving] = useState(false);

  const changeStatus = async (entry, readingStatus) => {
    setBusyId(entry.id);
    try {
      await libraryApi.updateStatus(entry.bookId, readingStatus);
      toast.success(`“${entry.book.title}” moved to ${STATUS_LABELS[readingStatus]}.`);
      library.reload();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusyId(null);
    }
  };

  const confirmRemove = async () => {
    setRemoving(true);
    try {
      const { message } = await libraryApi.remove(toRemove.bookId);
      toast.success(message, toRemove.book.title);
      setToRemove(null);
      library.reload();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setRemoving(false);
    }
  };

  const counts = library.data?.counts;
  const items = library.data?.items ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Your shelves"
        title="My Library"
        description="Only you can see this library. Change a book's status as you read; your page is saved automatically."
        actions={
          <Button as={Link} to="/app/catalogue" variant="secondary">
            Find more books
          </Button>
        }
      />

      <div className="tabs" role="tablist" aria-label="Filter by reading status">
        {TABS.map((tab) => (
          <button
            key={tab.value || 'all'}
            type="button"
            role="tab"
            className="tab"
            aria-selected={status === tab.value}
            onClick={() => setParams(tab.value ? { status: tab.value } : {}, { replace: true })}
          >
            {tab.value && <span className={`dot dot--${tab.value}`} aria-hidden="true" />}
            {tab.label}
            {counts && <span className="tab__count">{counts[tab.countKey]}</span>}
          </button>
        ))}
      </div>

      <div role="tabpanel" aria-label={TABS.find((t) => t.value === status)?.label}>
        {library.loading && !library.data ? (
          <LoadingState label="Opening your shelves…" />
        ) : library.error && !library.data ? (
          <ErrorState title="Your library could not be loaded" error={library.error} onRetry={library.reload} />
        ) : items.length === 0 ? (
          <EmptyState icon={Library} title="Nothing on this shelf" text={EMPTY_TEXT[status]}>
            <Button as={Link} to="/app/catalogue">
              Browse the catalogue
            </Button>
          </EmptyState>
        ) : (
          <ul className={`library-list ${library.loading ? 'is-refreshing' : ''}`}>
            {items.map((entry) => (
              <LibraryItem
                key={entry.id}
                entry={entry}
                busy={busyId === entry.id}
                onStatusChange={changeStatus}
                onRemove={setToRemove}
              />
            ))}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(toRemove)}
        title="Remove this book?"
        confirmLabel="Remove"
        loading={removing}
        onConfirm={confirmRemove}
        onCancel={() => setToRemove(null)}
      >
        “{toRemove?.book.title}” will leave your library
        {toRemove?.currentPage > 0 ? ' and your saved page will be forgotten' : ''}. You can add it again at any time.
      </ConfirmDialog>
    </>
  );
}
