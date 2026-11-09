import BookCard from './BookCard';
import { booksApi } from '../../api';
import { useApi } from '../../hooks/useApi';

// "Readers also liked" on a book's page: books rated highly by the readers who
// rated this one highly, or books of the same genre when there are none yet.
// Hidden while loading and when there is nothing to show.
export default function AlsoLiked({ bookId }) {
  const similar = useApi((signal) => booksApi.similar(bookId, signal), [bookId]);
  const books = similar.data?.books ?? [];
  if (books.length === 0) return null;

  const basedOnReaders = similar.data.basedOnReaders;
  return (
    <section className="dashboard-section also-liked" aria-labelledby="also-liked-title">
      <div className="section-row">
        <h2 id="also-liked-title">{basedOnReaders ? 'Readers also liked' : 'More in this genre'}</h2>
      </div>
      <div className="book-grid">
        {books.map((book) => (
          <BookCard key={book.id} book={book} to={`/app/books/${book.id}`}>
            <p className="recommend-reason">{book.similarity.reason}</p>
          </BookCard>
        ))}
      </div>
    </section>
  );
}
