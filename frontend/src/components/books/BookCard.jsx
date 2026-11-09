import { Link } from 'react-router-dom';
import BookCover from './BookCover';
import { RatingSummary } from './Rating';
import { StatusBadge } from '../ui/Display';

export default function BookCard({ book, to, status, children }) {
  return (
    <article className="book-card">
      {status && (
        <span className="book-card__badge">
          <StatusBadge status={status} />
        </span>
      )}
      <Link to={to} className="book-card__cover-link" tabIndex={-1} aria-hidden="true">
        <BookCover book={book} />
      </Link>
      <div className="book-card__body">
        <h3 className="book-card__title">
          <Link to={to}>{book.title}</Link>
        </h3>
        <p className="book-card__author">{book.author}</p>
        {book.ratingCount !== undefined && (
          <RatingSummary averageRating={book.averageRating} ratingCount={book.ratingCount} compact />
        )}
        {(book.genre || book.publicationYear) && (
          <div className="book-card__meta">
            {book.genre && <span className="tag">{book.genre}</span>}
            {book.publicationYear && <span className="muted tabular">{book.publicationYear}</span>}
          </div>
        )}
        {children}
      </div>
    </article>
  );
}
