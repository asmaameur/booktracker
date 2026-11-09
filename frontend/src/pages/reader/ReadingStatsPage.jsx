import { Link } from 'react-router-dom';
import { BookOpen, BookOpenCheck, FileText, MessageSquareText } from 'lucide-react';
import BookCover from '../../components/books/BookCover';
import ReadingGoal from '../../components/books/ReadingGoal';
import { ColumnBars, RankedBars } from '../../components/charts/Charts';
import { PageHeader, StatTile } from '../../components/ui/Display';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';
import { statsApi } from '../../api';
import { useApi } from '../../hooks/useApi';
import { useDocumentTitle } from '../../hooks/misc';
import { formatShortDate } from '../../utils/format';

const monthShort = new Intl.DateTimeFormat('en-GB', { month: 'short' });
const monthLong = new Intl.DateTimeFormat('en-GB', { month: 'long' });
const dayShort = new Intl.DateTimeFormat('en-GB', { weekday: 'short' });
const dayLong = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

// "YYYY-MM-DD" from the API, read as a local date (no time-zone shift).
function localDate(day) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// "My reading": the reader's goal, books finished per month, pages read this
// week, favourite genres and latest finished books.
export default function ReadingStatsPage() {
  useDocumentTitle('My reading');
  const stats = useApi((signal) => statsApi.reading(undefined, signal), []);

  const header = (
    <PageHeader
      eyebrow="Your reading life"
      title="My reading"
      description="Your goal for the year, the books you finished and how much you read lately."
    />
  );

  if (stats.loading && !stats.data) {
    return (
      <>
        {header}
        <LoadingState label="Counting your pages…" />
      </>
    );
  }
  if (stats.error && !stats.data) {
    return (
      <>
        {header}
        <ErrorState title="Your statistics could not be loaded" error={stats.error} onRetry={stats.reload} />
      </>
    );
  }

  const s = stats.data.stats;
  const setStats = (next) => stats.setData({ stats: next });
  const thisMonth = new Date().getFullYear() === s.year ? new Date().getMonth() : undefined;

  const months = s.byMonth.map((value, i) => {
    const date = new Date(s.year, i, 1);
    return { label: monthShort.format(date), fullLabel: `${monthLong.format(date)} ${s.year}`, value };
  });
  const days = s.pages.lastWeek.map(({ day, pages }) => {
    const date = localDate(day);
    return { label: dayShort.format(date), fullLabel: dayLong.format(date), value: pages };
  });

  return (
    <>
      {header}

      <ReadingGoal stats={s} onChange={setStats} />

      <section className="stat-row dashboard-section" aria-label="Summary">
        <StatTile icon={BookOpenCheck} label={`Finished in ${s.year}`} value={s.finishedThisYear} />
        <StatTile icon={FileText} label="Pages this week" value={s.pages.thisWeek} note={`${s.pages.total} pages read in all`} />
        <StatTile icon={BookOpen} label="Reading now" value={s.shelf.reading} />
        <StatTile
          icon={MessageSquareText}
          label="Reviews written"
          value={s.reviews.count}
          note={s.reviews.averageGiven ? `Average ${s.reviews.averageGiven.toFixed(1)} ★ given` : undefined}
        />
      </section>

      <div className="dashboard-grid">
        <section className="panel" aria-labelledby="months-title">
          <div className="panel__header">
            <div>
              <h2 id="months-title" className="panel__title">
                Books finished per month
              </h2>
              <p className="panel__subtitle">{s.year}</p>
            </div>
          </div>
          <div className="panel__body">
            <ColumnBars
              rows={months}
              caption={`Books finished each month of ${s.year}`}
              valueLabel="books finished"
              highlight={thisMonth}
            />
          </div>
        </section>

        <section className="panel" aria-labelledby="pages-title">
          <div className="panel__header">
            <div>
              <h2 id="pages-title" className="panel__title">
                Pages read this week
              </h2>
              <p className="panel__subtitle">Counted when you read in BookTracker's reader</p>
            </div>
          </div>
          <div className="panel__body">
            <ColumnBars rows={days} caption="Pages read on each of the last 7 days" valueLabel="pages" highlight={6} />
          </div>
        </section>

        <section className="panel" aria-labelledby="genres-title">
          <div className="panel__header">
            <div>
              <h2 id="genres-title" className="panel__title">
                Your genres
              </h2>
              <p className="panel__subtitle">Books you have finished, by genre</p>
            </div>
          </div>
          <div className="panel__body">
            {s.topGenres.length === 0 ? (
              <p className="muted">Finish a book to see your favourite genres here.</p>
            ) : (
              <RankedBars
                rows={s.topGenres.map((g) => ({ label: g.name, value: g.count }))}
                caption="Books finished in each genre"
                labelHeader="Genre"
                valueHeader="Books"
              />
            )}
          </div>
        </section>

        <section className="panel" aria-labelledby="finished-title">
          <div className="panel__header">
            <div>
              <h2 id="finished-title" className="panel__title">
                Recently finished
              </h2>
              <p className="panel__subtitle">Your latest finished books in {s.year}</p>
            </div>
            <Link to="/app/library?status=read" className="text-link">
              See all
            </Link>
          </div>
          <div>
            {s.recentlyFinished.length === 0 ? (
              <EmptyState
                icon={BookOpenCheck}
                title="Nothing finished yet this year"
                text="Mark a book as Read, or reach its last page in the reader."
                compact
              />
            ) : (
              <ul className="mini-books">
                {s.recentlyFinished.map((book) => (
                  <li key={book.id}>
                    <Link to={`/app/books/${book.id}`} className="mini-book">
                      <span className="mini-book__cover">
                        <BookCover book={book} />
                      </span>
                      <span className="mini-book__text">
                        <span className="mini-book__title">{book.title}</span>
                        <span className="mini-book__author">
                          {book.author} · {book.genre}
                        </span>
                      </span>
                      <span className="mini-book__meta">{formatShortDate(book.finishedAt)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
