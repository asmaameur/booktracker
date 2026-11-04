import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BookOpen, Plus, Trash2 } from 'lucide-react';
import Button from '../../components/ui/Button';
import BookCover from '../../components/books/BookCover';
import StatusPicker from '../../components/books/StatusPicker';
import { ConfirmDialog } from '../../components/ui/Modal';
import { BackLink, ProgressMeter } from '../../components/ui/Display';
import { Alert, ErrorState, LoadingState } from '../../components/ui/States';
import { booksApi, libraryApi } from '../../api';
import { useToast } from '../../context/ToastContext';
import { useApi } from '../../hooks/useApi';
import { useDocumentTitle } from '../../hooks/misc';
import { STATUS_LABELS, formatDate } from '../../utils/format';

function LibraryPanel({ book, entry, onChange }) {
  const toast = useToast();
  const [busy, setBusy] = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const run = async (action, work) => {
    setBusy(action);
    try {
      await work();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(null);
    }
  };

  const add = () =>
    run('add', async () => {
      const { entry: created, message } = await libraryApi.add(book.id);
      onChange(created);
      toast.success(message);
    });

  const changeStatus = (status) =>
    run('status', async () => {
      const { entry: updated } = await libraryApi.updateStatus(book.id, status);
      onChange(updated);
      toast.success(`Moved to ${STATUS_LABELS[status]}.`);
    });

  const remove = () =>
    run('remove', async () => {
      const { message } = await libraryApi.remove(book.id);
      setConfirmRemove(false);
      onChange(null);
      toast.success(message);
    });

  const readLabel = entry?.currentPage > 0 ? `Resume at page ${entry.currentPage}` : 'Start reading';
  const readButton = book.hasPdf ? (
    <Button as={Link} to={`/app/read/${book.id}`} icon={BookOpen} variant={entry ? 'primary' : 'secondary'}>
      {readLabel}
    </Button>
  ) : null;

  if (!entry) {
    return (
      <section className="library-panel panel" aria-labelledby="library-panel-title">
        <h2 id="library-panel-title" className="library-panel__title">
          Not in your library yet
        </h2>
        <p className="muted">Add it to your To Read shelf, or open it now: reading adds it automatically.</p>
        <div className="library-panel__actions">
          <Button icon={Plus} onClick={add} loading={busy === 'add'}>
            Add to my library
          </Button>
          {readButton}
        </div>
      </section>
    );
  }

  return (
    <section className="library-panel panel" aria-labelledby="library-panel-title">
      <h2 id="library-panel-title" className="library-panel__title">
        In your library
      </h2>
      <StatusPicker value={entry.readingStatus} onChange={changeStatus} disabled={busy === 'status'} />
      <ProgressMeter
        currentPage={entry.currentPage}
        totalPages={entry.totalPages}
        percent={entry.progressPercent}
        status={entry.readingStatus}
      />
      <div className="library-panel__actions">
        {readButton}
        <Button variant="danger-ghost" icon={Trash2} onClick={() => setConfirmRemove(true)}>
          Remove from library
        </Button>
      </div>

      <ConfirmDialog
        open={confirmRemove}
        title="Remove this book?"
        confirmLabel="Remove"
        loading={busy === 'remove'}
        onConfirm={remove}
        onCancel={() => setConfirmRemove(false)}
      >
        “{book.title}” will leave your library
        {entry.currentPage > 0 ? ' and your saved page will be forgotten' : ''}. You can add it again at any time.
      </ConfirmDialog>
    </section>
  );
}

export default function BookDetailsPage() {
  const { id } = useParams();
  const details = useApi((signal) => booksApi.get(id, signal), [id]);
  useDocumentTitle(details.data?.book.title || 'Book');

  if (details.loading && !details.data) return <LoadingState label="Opening the book…" />;
  if (details.error) {
    return (
      <>
        <BackLink to="/app/catalogue">Back to the catalogue</BackLink>
        <ErrorState
          title={details.error.status === 404 ? 'Book not found' : 'This book could not be loaded'}
          error={details.error}
          onRetry={details.error.status === 404 ? undefined : details.reload}
        />
      </>
    );
  }

  const { book, libraryEntry } = details.data;
  const setEntry = (entry) => details.setData((data) => ({ ...data, libraryEntry: entry }));

  return (
    <>
      <BackLink to="/app/catalogue">Back to the catalogue</BackLink>
      <article className="book-detail">
        <div className="book-detail__cover">
          <BookCover book={book} eager />
        </div>

        <div className="book-detail__body">
          {book.category && <span className="eyebrow">{book.category}</span>}
          <h1 className="book-detail__title">{book.title}</h1>
          <p className="book-detail__author">by {book.author}</p>

          <dl className="book-detail__facts">
            {book.publicationYear && (
              <div>
                <dt>First published</dt>
                <dd className="tabular">{book.publicationYear}</dd>
              </div>
            )}
            <div>
              <dt>Format</dt>
              <dd>{book.hasPdf ? 'PDF, readable here' : 'No PDF yet'}</dd>
            </div>
            <div>
              <dt>In the catalogue since</dt>
              <dd>{formatDate(book.createdAt)}</dd>
            </div>
          </dl>

          {book.description ? (
            <div className="book-detail__description">
              {book.description.split(/\n{2,}/).map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
          ) : (
            <p className="muted">No description has been written for this book yet.</p>
          )}

          {!book.hasPdf && (
            <Alert type="info" title="Not available to read yet">
              The librarian has not added a PDF for this book.
            </Alert>
          )}

          <LibraryPanel book={book} entry={libraryEntry} onChange={setEntry} />
        </div>
      </article>
    </>
  );
}
