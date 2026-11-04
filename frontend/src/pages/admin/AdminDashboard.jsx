import { Link } from 'react-router-dom';
import { BookPlus, FileText, Library, LibraryBig, UsersRound } from 'lucide-react';
import Button from '../../components/ui/Button';
import BookCover from '../../components/books/BookCover';
import { RankedBars, SegmentedBar } from '../../components/charts/Charts';
import { PageHeader, StatTile } from '../../components/ui/Display';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';
import { adminApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useApi } from '../../hooks/useApi';
import { useDocumentTitle } from '../../hooks/misc';
import { firstName, formatNumber, formatShortDate, plural } from '../../utils/format';

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

  const { totals, readingStatus, booksByCategory, recentBooks, recentReaders, popularBooks } = stats.data;
  const uncategorised = totals.books - booksByCategory.reduce((sum, c) => sum + c.count, 0);

  return (
    <>
      {header}

      <section className="stat-row dashboard-section" aria-label="Totals">
        <StatTile icon={LibraryBig} label="Books in the catalogue" value={totals.books} note={plural(totals.categories, 'category', 'categories')} />
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

        <section className="panel" aria-labelledby="category-title">
          <div className="panel__header">
            <div>
              <h2 id="category-title" className="panel__title">
                Books by category
              </h2>
              <p className="panel__subtitle">Number of titles in each category</p>
            </div>
          </div>
          <div className="panel__body">
            {booksByCategory.length === 0 ? (
              <p className="muted">No categories yet.</p>
            ) : (
              <RankedBars
                caption="Number of books in each category"
                labelHeader="Category"
                valueHeader="Books"
                rows={[
                  ...booksByCategory.map((c) => ({ label: c.name, value: c.count })),
                  ...(uncategorised > 0 ? [{ label: 'No category', value: uncategorised }] : []),
                ]}
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

      <section className="panel dashboard-section" aria-labelledby="readers-title">
        <div className="panel__header">
          <div>
            <h2 id="readers-title" className="panel__title">
              Newest readers
            </h2>
            <p className="panel__subtitle">{plural(totals.readersJoinedLast30Days, 'reader')} joined in the last 30 days</p>
          </div>
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
