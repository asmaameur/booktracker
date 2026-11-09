import { useRef } from 'react';
import { Star } from 'lucide-react';
import { plural } from '../../utils/format';

// Five stars filled to `value` (fractions show as a partly filled star).
export function Stars({ value = 0, size = 'md' }) {
  return (
    <span className={`stars stars--${size}`} aria-hidden="true">
      {[1, 2, 3, 4, 5].map((n) => {
        const fill = Math.max(0, Math.min(1, value - (n - 1)));
        return (
          <span key={n} className="stars__star">
            <Star className="stars__empty" />
            <span className="stars__fill" style={{ width: `${fill * 100}%` }}>
              <Star />
            </span>
          </span>
        );
      })}
    </span>
  );
}

// "★★★★☆ 4.2 (12)" on cards, or "4.2 · 12 ratings" on the details page.
export function RatingSummary({ averageRating, ratingCount, compact = false }) {
  if (!ratingCount) {
    return <span className="rating-summary rating-summary--empty">{compact ? 'No ratings yet' : 'Not rated yet'}</span>;
  }
  const label = `Rated ${averageRating.toFixed(1)} out of 5 by ${plural(ratingCount, 'reader')}`;
  return (
    <span className="rating-summary" role="img" aria-label={label} title={label}>
      <Stars value={averageRating} size={compact ? 'sm' : 'md'} />
      <span className="rating-summary__value tabular">{averageRating.toFixed(1)}</span>
      <span className="rating-summary__count tabular">
        {compact ? `(${ratingCount})` : plural(ratingCount, 'rating')}
      </span>
    </span>
  );
}

const STAR_LABELS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

// A 1–5 star picker built as a radio group: arrow keys change the rating.
export function StarInput({ value, onChange, disabled = false, id, invalid = false }) {
  const refs = useRef([]);

  const onKeyDown = (event) => {
    const step = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const next = Math.max(1, Math.min(5, (value || 0) + step));
    onChange(next);
    refs.current[next - 1]?.focus();
  };

  return (
    <div
      id={id}
      className="star-input"
      role="radiogroup"
      aria-label="Your rating"
      aria-invalid={invalid || undefined}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          ref={(el) => {
            refs.current[n - 1] = el;
          }}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${plural(n, 'star')}: ${STAR_LABELS[n]}`}
          tabIndex={value === n || (!value && n === 1) ? 0 : -1}
          className={`star-input__star ${n <= (value || 0) ? 'is-on' : ''}`}
          disabled={disabled}
          onClick={() => onChange(n)}
          onKeyDown={onKeyDown}
        >
          <Star aria-hidden="true" />
        </button>
      ))}
      <span className="star-input__label" aria-hidden="true">
        {value ? STAR_LABELS[value] : 'Choose a rating'}
      </span>
    </div>
  );
}
