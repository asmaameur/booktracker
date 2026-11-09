import { Link } from 'react-router-dom';
import { BookPlus, FileText, Library, LibraryBig, MessageSquareText, UsersRound } from 'lucide-react';
import { Stars } from '../../components/books/Rating';
import Button from '../../components/ui/Button';
import BookCover from '../../components/books/BookCover';
import { RankedBars, SegmentedBar } from '../../components/charts/Charts';
import { PageHeader, StatTile } from '../../components/ui/Display';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';
import { adminApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useApi } from '../../hooks/useApi';
import { useDocumentTitle } from '../../hooks/misc';
import { firstName, formatNumber, formatRelative, formatShortDate, plural } from '../../utils/format';

function BookList({ books, emptyText, meta }) {
  if (books.length === 0) return <p className="muted panel__body">{emptyText}</p>;
  return (
    <ul className="mini-books">
      {books.map((book) => (
        <li key={book.id}>
          <Link to={`/admin/books/${book.id}`} className="mini-book">
            <span className="mini-book__cover">
              <BookCover book={book} />
            </span>
            <span className="mini-book__text">
              <span className="mini-book__title">{book.title}</span>
              <span className="mini-book__author">{book.author}</span>
            </span>
            <span className="mini-book__meta">{meta(book)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

// The latest reviews across the catalogue, newest first.
function LatestReviews({ reviews }) {
  if (reviews.length === 0) {
    return <EmptyState icon={MessageSquareText} title="No reviews yet" text="Ratings from readers will appear here." compact />;
  }
  return (
    <ul className="mini-books">
      {reviews.map((review) => (
        <li key={review.id}>
          <Link to={`/admin/books/${review.book.id}`} className="mini-book">
            <span className="mini-book__cover">
              <BookCover book={review.book} />
            </span>
            <span className="mini-book__text">
              <span className="mini-book__title">{review.book.title}</span>
              <span className="mini-book__author">
                {review.userName}
                {review.comment && ` · “${review.comment.length > 60 ? `${review.comment.slice(0, 57)}…` : review.comment}”`}
              </span>
            </span>
            <span className="mini-book__meta activity__rating">
              <span role="img" aria-label={`${plural(review.rating, 'star')} out of 5`}>
                <Stars value={review.rating} size="sm" />
              </span>
              <span>{formatRelative(review.createdAt)}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

const ratingMeta = (book) => `${book.averageRating.toFixed(1)} ★ · ${plural(book.ratingCount, 'rating')}`;

export default function AdminDashboard() {
  useDocumentTitle('Admin dashboard');
  const { user } = useAuth();
  const stats = useApi((signal) => adminApi.stats(signal), []);

  const header = (
    <PageHeader
      eyebrow="Administration"
      title={`The library at a glance, ${firstName(user?.name)}`}
      description="Catalogue and reader activity, updated each time you open this page."
      actions={
        <>
          <Button as={Link} to="/admin/books" variant="secondary">
            Manage catalogue
          </Button>
          <Button as={Link} to="/admin/books/new" icon={BookPlus}>
            Add a book
          </Button>
        </>
      }
    />
  );

  if (stats.loading && !stats.data) {
    return (
      <>
        {header}
        <LoadingState label="Counting the shelves…" />
      </>
    );
  }
  if (stats.error) {
    return (
      <>
        {header}
        <ErrorState title="Statistics could not be loaded" error={stats.error} onRetry={stats.reload} />
      </>
    );
  }

  const { totals, readingStatus, booksByGenre, recentBooks, recentReaders, popularBooks } = stats.data;
  const { latestReviews, topRatedBooks, lowestRatedBooks } = stats.data;

  return (
    <>
      {header}

      <section className="stat-row dashboard-section" aria-label="Totals">
        <StatTile icon={LibraryBig} label="Books in the catalogue" value={totals.books} note={plural(totals.genres, 'genre')} />
        <StatTile
          icon={UsersRound}
          label="Registered users"
          value={totals.users}
          note={`${plural(totals.readers, 'reader')} · ${plural(totals.admins, 'admin')}`}
        />
        <StatTile icon={Library} label="Books on readers' shelves" value={totals.libraryEntries} note={`${formatNumber(stats.data.libraryUpdatesLast7Days)} updated this week`} />
        <StatTile icon={FileText} label="Books with a PDF" value={totals.booksWithPdf} note={`of ${formatNumber(totals.books)} in the catalogue`} />
      </section>

      <div className="dashboard-grid">
        <section className="panel" aria-labelledby="status-title">
          <div className="panel__header">
            <div>
              <h2 id="status-title" className="panel__title">
                Reading status
              </h2>
              <p className="panel__subtitle">All books on readers' shelves, by status</p>
            </div>
          </div>
          <div className="panel__body">
            {totals.libraryEntries === 0 ? (
              <p className="muted">No reader has added a book yet.</p>
            ) : (
              <SegmentedBar
                label="Reading status of books on readers' shelves"
                parts={[
                  { key: 'to_read', label: 'To Read', value: readingStatus.toRead, color: 'var(--chart-to-read)' },
                  { key: 'reading', label: 'Reading', value: readingStatus.reading, color: 'var(--chart-reading)' },
                  { key: 'read', label: 'Read', value: readingStatus.read, color: 'var(--chart-read)' },
                ]}
              />
            )}
          </div>
        </section>

        <section className="panel" aria-labelledby="genre-title">
          <div className="panel__header">
            <div>
              <h2 id="genre-title" className="panel__title">
                Books by genre
              </h2>
              <p className="panel__subtitle">Number of titles in each genre</p>
            </div>
          </div>
          <div className="panel__body">
            {booksByGenre.length === 0 ? (
              <p className="muted">No books yet.</p>
            ) : (
              <RankedBars
                caption="Number of books in each genre"
                labelHeader="Genre"
                valueHeader="Books"
                rows={booksByGenre.map((g) => ({ label: g.name, value: g.count }))}
              />
            )}
          </div>
        </section>

        <section className="panel" aria-labelledby="popular-title">
          <div className="panel__header">
            <div>
              <h2 id="popular-title" className="panel__title">
                Most shelved
              </h2>
              <p className="panel__subtitle">Books found in the most libraries</p>
            </div>
          </div>
          <BookList
            books={popularBooks}
            emptyText="Readers have not added any books yet."
            meta={(book) => plural(book.readerCount, 'reader')}
          />
        </section>

        <section className="panel" aria-labelledby="recent-books-title">
          <div className="panel__header">
            <div>
              <h2 id="recent-books-title" className="panel__title">
                Recently added
              </h2>
              <p className="panel__subtitle">The latest books in the catalogue</p>
            </div>
            <Link to="/admin/books" className="text-link">
              See all
            </Link>
          </div>
          <BookList
            books={recentBooks}
            emptyText="The catalogue is empty. Add the first book."
            meta={(book) => formatShortDate(book.createdAt)}
          />
        </section>
      </div>

      <section className="panel dashboard-section activity__reviews" aria-labelledby="latest-reviews-title">
        <div className="panel__header">
          <div>
            <h2 id="latest-reviews-title" className="panel__title">
              Latest reviews
            </h2>
            <p className="panel__subtitle">
              {plural(totals.reviewsLast7Days, 'review')} and {plural(totals.readersJoinedLast7Days, 'new reader')} this week
            </p>
          </div>
        </div>
        <LatestReviews reviews={latestReviews} />
      </section>

      <div className="dashboard-grid">
        <section className="panel" aria-labelledby="top-rated-title">
          <div className="panel__header">
            <div>
              <h2 id="top-rated-title" className="panel__title">
                Best rated
              </h2>
              <p className="panel__subtitle">Highest average rating from readers</p>
            </div>
          </div>
          <BookList books={topRatedBooks} emptyText="No book has been rated yet." meta={ratingMeta} />
        </section>

        <section className="panel" aria-labelledby="low-rated-title">
          <div className="panel__header">
            <div>
              <h2 id="low-rated-title" className="panel__title">
                Lowest rated
              </h2>
              <p className="panel__subtitle">Books averaging under 3 stars, worth a look</p>
            </div>
          </div>
          <BookList books={lowestRatedBooks} emptyText="No book averages under 3 stars." meta={ratingMeta} />
        </section>
      </div>

      <section className="panel dashboard-section" aria-labelledby="readers-title">
        <div className="panel__header">
          <div>
            <h2 id="readers-title" className="panel__title">
              Newest readers
            </h2>
            <p className="panel__subtitle">{plural(totals.readersJoinedLast30Days, 'reader')} joined in the last 30 days</p>
          </div>
          <Link to="/admin/users" className="text-link">
            Manage readers
          </Link>
        </div>
        {recentReaders.length === 0 ? (
          <EmptyState icon={UsersRound} title="No readers yet" text="Readers appear here once they create an account." compact />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Email</th>
                  <th scope="col">Email verified</th>
                  <th scope="col">Joined</th>
                </tr>
              </thead>
              <tbody>
                {recentReaders.map((reader) => (
                  <tr key={reader.id}>
                    <td>{reader.name}</td>
                    <td className="muted">{reader.email}</td>
                    <td>
                      <span className={`badge ${reader.isVerified ? '' : 'badge--muted'}`}>
                        {reader.isVerified ? 'Verified' : 'Pending'}
                      </span>
                    </td>
                    <td className="tabular">{formatShortDate(reader.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
