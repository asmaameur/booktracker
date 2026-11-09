import { useEffect, useState } from 'react';

function TypesetCover({ book }) {
  return (
    <span className="cover__typeset" aria-hidden="true">
      <span className="cover__ph-title">{book.title}</span>
      <span className="cover__ph-rule" />
      <span className="cover__ph-author">{book.author}</span>
    </span>
  );
}

// Shows a typeset cover in the brand colours straight away, and fades the
// real image in once it has loaded. Some cover hosts take several seconds;
// if the image fails or there is none, the typeset cover simply stays.
export default function BookCover({ book, eager = false, className = '' }) {
  const [state, setState] = useState('loading');

  useEffect(() => {
    setState('loading');
  }, [book?.coverImageUrl]);

  if (!book) return <div className={`cover ${className}`} aria-hidden="true" />;

  const hasImage = Boolean(book.coverImageUrl) && state !== 'failed';

  return (
    <div
      className={`cover ${state === 'loaded' ? 'cover--loaded' : ''} ${className}`}
      role={hasImage ? undefined : 'img'}
      aria-label={hasImage ? undefined : `Cover of ${book.title}`}
    >
      {state !== 'loaded' && <TypesetCover book={book} />}
      {hasImage && (
        <img
          className="cover__img"
          src={book.coverImageUrl}
          alt={`Cover of ${book.title} by ${book.author}`}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          ref={(img) => {
            if (img?.complete && img.naturalWidth > 0 && state === 'loading') setState('loaded');
          }}
          onLoad={() => setState('loaded')}
          onError={() => setState('failed')}
        />
      )}
    </div>
  );
}
