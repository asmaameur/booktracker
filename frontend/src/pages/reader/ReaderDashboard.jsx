import { Link } from 'react-router-dom';
import { ArrowRight, BookMarked, BookOpen, BookOpenCheck, Bookmark, Library } from 'lucide-react';
import Button from '../../components/ui/Button';
import BookCard from '../../components/books/BookCard';
import BookCover from '../../components/books/BookCover';
import { PageHeader, ProgressMeter, StatTile } from '../../components/ui/Display';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';
import { booksApi, libraryApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useApi } from '../../hooks/useApi';
import { useDocumentTitle } from '../../hooks/misc';
import { firstName, formatRelative, greeting } from '../../utils/format';

function ContinueReading({ entry }) {
  const { book } = entry;
  const started = entry.currentPage > 0;
  return (
    <section className="continue panel" aria-labelledby="continue-title">
      <Link to={`/app/books/${book.id}`} className="continue__cover" tabIndex={-1} aria-hidden="true">
        <BookCover book={book} eager />
      </Link>
      <div className="continue__body">
        <span className="eyebrow">Continue reading</span>
        <h2 id="continue-title" className="continue__title">
          {book.title}
        </h2>
        <p className="continue__author">by {book.author}</p>
        <ProgressMeter
          currentPage={entry.currentPage}
          totalPages={entry.totalPages}
          percent={entry.progressPercent}
          status={entry.readingStatus}
        />
        <p className="continue__updated muted">Last opened {formatRelative(entry.updatedAt)}</p>
        <div className="continue__actions">
          {book.hasPdf && (
            <Button as={Link} to={`/app/read/${book.id}`} icon={BookOpen}>
              {started ? `Resume at page ${entry.currentPage}` : 'Start reading'}
            </Button>
          )}
          <Button as={Link} to={`/app/books/${book.id}`} variant="secondary">
            Book details
          </Button>
        </div>
      </div>
    </section>
  );
}

export default function ReaderDashboard() {
  useDocumentTitle('Dashboard');
  const { user } = useAuth();
  const library = useApi((signal) => libraryApi.list(undefined, signal), []);
  const recent = useApi((signal) => booksApi.list({ sort: 'newest', limit: 6 }, signal), []);

  const items = library.data?.items ?? [];
  const counts = library.data?.counts;
  const current = items.find((item) => item.readingStatus === 'reading');
  const upNext = items.filter((item) => item.readingStatus === 'to_read').slice(0, 4);

  return (
    <>
      <PageHeader
        eyebrow="Your reading room"
        title={`${greeting()}, ${firstName(user?.name)}`}
        description="Pick up where you left off, or find something new in the catalogue."
        actions={
          <Button as={Link} to="/app/catalogue" variant="secondary" iconAfter={ArrowRight}>
            Browse the catalogue
          </Button>
        }
      />

      {library.loading && !library.data ? (
        <LoadingState label="Opening your shelves…" />
      ) : library.error && !library.data ? (
        <ErrorState title="Your library could not be loaded" error={library.error} onRetry={library.reload} />
      ) : (
        <>
          {current ? (
            <ContinueReading entry={current} />
          ) : (
            <section className="panel">
              <EmptyState
                icon={BookMarked}
                title="Nothing on the go"
                text={
                  counts?.total
                    ? 'None of your books is marked as Reading. Open one from your library to begin.'
                    : 'Your shelves are empty for now. Choose a first book from the catalogue.'
                }
                compact
              >
                <Button as={Link} to={counts?.total ? '/app/library' : '/app/catalogue'}>
                  {counts?.total ? 'Go to my library' : 'Explore the catalogue'}
                </Button>
              </EmptyState>
            </section>
          )}

          <section className="dashboard-section" aria-label="Library summary">
            <div className="stat-row">
              <StatTile icon={Library} label="In my library" value={counts?.total ?? 0} />
              <StatTile icon={Bookmark} label="To Read" value={counts?.toRead ?? 0} />
              <StatTile icon={BookOpen} label="Reading" value={counts?.reading ?? 0} />
              <StatTile icon={BookOpenCheck} label="Read" value={counts?.read ?? 0} />
            </div>
          </section>

          {upNext.length > 0 && (
            <section className="dashboard-section" aria-labelledby="up-next-title">
              <div className="section-row">
                <h2 id="up-next-title">Up next</h2>
                <Link to="/app/library?status=to_read" className="text-link">
                  See all
                </Link>
              </div>
              <div className="book-grid book-grid--compact">
                {upNext.map((entry) => (
                  <BookCard key={entry.id} book={entry.book} to={`/app/books/${entry.bookId}`} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <section className="dashboard-section" aria-labelledby="new-title">
        <div className="section-row">
          <h2 id="new-title">New in the catalogue</h2>
          <Link to="/app/catalogue" className="text-link">
            Browse all books
          </Link>
        </div>
        {recent.loading && !recent.data ? (
          <LoadingState />
        ) : recent.error ? (
          <ErrorState title="New books could not be loaded" error={recent.error} onRetry={recent.reload} />
        ) : recent.data.books.length === 0 ? (
          <EmptyState icon={BookOpen} title="The catalogue is empty" text="Books added by the librarian will appear here." compact />
        ) : (
          <div className="book-grid">
            {recent.data.books.map((book) => (
              <BookCard key={book.id} book={book} to={`/app/books/${book.id}`} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
