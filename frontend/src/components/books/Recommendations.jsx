import { useState } from 'react';
import { Heart, Sparkles } from 'lucide-react';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import BookCard from './BookCard';
import FavouriteGenresForm from './FavouriteGenres';
import { EmptyState, ErrorState, LoadingState } from '../ui/States';
import { recommendationsApi } from '../../api';
import { useApi } from '../../hooks/useApi';

function basedOnText({ preferredGenres, hasHistory }) {
  const parts = [];
  if (preferredGenres.length) parts.push(`your favourite genres (${preferredGenres.join(', ')})`);
  if (hasHistory) parts.push('your reading history and ratings');
  return parts.length ? `Based on ${parts.join(' and ')}.` : null;
}

// "Recommended for you" on the reader dashboard. Readers without favourite
// genres are invited to choose some; the list reloads once they are saved.
export default function Recommendations({ limit = 6 }) {
  const recs = useApi((signal) => recommendationsApi.list(limit, signal), [limit]);
  const [choosing, setChoosing] = useState(false);

  const onSaved = () => {
    setChoosing(false);
    recs.reload();
  };

  const data = recs.data;

  return (
    <section className="dashboard-section" aria-labelledby="recommended-title">
      <div className="section-row">
        <h2 id="recommended-title">Recommended for you</h2>
        {data?.hasPreferences && (
          <button type="button" className="text-link" onClick={() => setChoosing(true)}>
            Edit favourite genres
          </button>
        )}
      </div>

      {recs.loading && !data ? (
        <LoadingState label="Finding books for you…" />
      ) : recs.error && !data ? (
        <ErrorState title="Recommendations could not be loaded" error={recs.error} onRetry={recs.reload} />
      ) : (
        <div className={recs.loading ? 'is-refreshing' : ''}>
          {!data.hasPreferences && (
            <div className="panel recommend-invite">
              <span className="recommend-invite__icon" aria-hidden="true">
                <Sparkles />
              </span>
              <div className="recommend-invite__text">
                <h3>Tell us what you like to read</h3>
                <p className="muted">
                  Choose your favourite genres and we will suggest books that match them
                  {data.hasHistory ? ', together with what you have already read and rated.' : '.'}
                </p>
              </div>
              <Button icon={Heart} onClick={() => setChoosing(true)}>
                Choose my favourite genres
              </Button>
            </div>
          )}

          {data.hasPreferences && basedOnText(data) && <p className="results-summary">{basedOnText(data)}</p>}

          {data.books.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="No recommendations yet"
              text="Books added by the librarian will appear here."
              compact
            />
          ) : (
            <>
              {!data.hasPreferences && (
                <p className="results-summary">
                  {data.hasHistory ? 'Picked from your reading history and ratings.' : 'Popular picks while you decide.'}
                </p>
              )}
              <div className="book-grid">
                {data.books.map((book) => (
                  <BookCard key={book.id} book={book} to={`/app/books/${book.id}`}>
                    <p className="recommend-reason">{book.recommendation.reason}</p>
                  </BookCard>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <Modal open={choosing} title="Your favourite genres" onClose={() => setChoosing(false)}>
        <p className="muted favourite-genres__intro">
          Pick as many as you like. Recommendations put these genres first.
        </p>
        <FavouriteGenresForm onSaved={onSaved} onCancel={() => setChoosing(false)} />
      </Modal>
    </section>
  );
}
