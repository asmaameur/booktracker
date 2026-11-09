import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Eye, Pencil, Trash2 } from 'lucide-react';
import Button from '../../components/ui/Button';
import BookCover from '../../components/books/BookCover';
import ReviewsSection from '../../components/books/ReviewsSection';
import { RatingSummary } from '../../components/books/Rating';
import DeleteBookDialog from '../../components/books/DeleteBookDialog';
import { BackLink } from '../../components/ui/Display';
import { Alert, ErrorState, LoadingState } from '../../components/ui/States';
import { booksApi } from '../../api';
import { useApi } from '../../hooks/useApi';
import { useDocumentTitle } from '../../hooks/misc';
import { formatDate, plural } from '../../utils/format';

export default function AdminBookDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const details = useApi((signal) => booksApi.get(id, signal), [id]);
  const [deleting, setDeleting] = useState(false);
  useDocumentTitle(details.data?.book.title || 'Book');

  if (details.loading && !details.data) return <LoadingState label="Opening the book…" />;
  if (details.error) {
    return (
      <>
        <BackLink to="/admin/books">Back to the catalogue</BackLink>
        <ErrorState
          title={details.error.status === 404 ? 'Book not found' : 'This book could not be loaded'}
          error={details.error}
          onRetry={details.error.status === 404 ? undefined : details.reload}
        />
      </>
    );
  }

  const { book, readerCount } = details.data;
  const setSummary = ({ averageRating, ratingCount }) =>
    details.setData((data) => ({ ...data, book: { ...data.book, averageRating, ratingCount } }));

  return (
    <>
      <BackLink to="/admin/books">Back to the catalogue</BackLink>
      <article className="book-detail">
        <div className="book-detail__cover">
          <BookCover book={book} eager />
        </div>

        <div className="book-detail__body">
          <span className="eyebrow">{book.genre}</span>
          <h1 className="book-detail__title">{book.title}</h1>
          <p className="book-detail__author">by {book.author}</p>
          <a href="#reviews-title" className="book-detail__rating">
            <RatingSummary averageRating={book.averageRating} ratingCount={book.ratingCount} />
          </a>

          <div className="book-detail__admin-actions">
            <Button as={Link} to={`/admin/books/${book.id}/edit`} icon={Pencil}>
              Edit
            </Button>
            {book.hasPdf && (
              <Button as={Link} to={`/admin/books/${book.id}/read`} variant="secondary" icon={Eye}>
                Preview PDF
              </Button>
            )}
            <Button variant="danger-ghost" icon={Trash2} onClick={() => setDeleting(true)}>
              Delete
            </Button>
          </div>

          <dl className="book-detail__facts">
            <div>
              <dt>On readers' shelves</dt>
              <dd>{plural(readerCount, 'reader')}</dd>
            </div>
            <div>
              <dt>Publication year</dt>
              <dd className="tabular">{book.publicationYear ?? 'Not set'}</dd>
            </div>
            <div>
              <dt>PDF</dt>
              <dd>{book.hasPdf ? 'Available' : 'Missing'}</dd>
            </div>
          </dl>

          {!book.hasPdf && (
            <Alert type="warning" title="Readers cannot open this book yet">
              Add a PDF link so it can be read in BookTracker.
            </Alert>
          )}

          <section className="book-detail__section">
            <h2 className="book-detail__section-title">Description</h2>
            {book.description ? (
              <div className="book-detail__description">
                {book.description.split(/\n{2,}/).map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>
            ) : (
              <p className="muted">No description yet.</p>
            )}
          </section>

          <ReviewsSection bookId={book.id} canModerate onSummaryChange={setSummary} />

          <section className="book-detail__section panel panel__body">
            <h2 className="book-detail__section-title">Record</h2>
            <dl className="details-list">
              <dt>Genre</dt>
              <dd>{book.genre}</dd>
              <dt>Book ID</dt>
              <dd className="tabular">{book.id}</dd>
              <dt>Added</dt>
              <dd>{formatDate(book.createdAt)}</dd>
              <dt>Last updated</dt>
              <dd>{formatDate(book.updatedAt)}</dd>
              <dt>Cover URL</dt>
              <dd>{book.coverImageUrl || <span className="muted">None</span>}</dd>
              <dt>PDF URL</dt>
              <dd>{book.pdfUrl || <span className="muted">None</span>}</dd>
            </dl>
          </section>
        </div>
      </article>

      <DeleteBookDialog
        book={deleting ? book : null}
        readerCount={readerCount}
        onClose={() => setDeleting(false)}
        onDeleted={() => navigate('/admin/books', { replace: true })}
      />
    </>
  );
}
