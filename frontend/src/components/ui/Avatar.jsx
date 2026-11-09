import { useEffect, useState } from 'react';
import { initials } from '../../utils/format';

// A round profile picture, or the person's initials when there is none (or
// when the image cannot be loaded). Decorative: the name is always written
// next to it, so it is hidden from screen readers.
export default function Avatar({ name, url, size, className = '' }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);

  const classes = ['avatar', size && `avatar--${size}`, className].filter(Boolean).join(' ');
  return (
    <span className={classes} aria-hidden="true">
      {url && !failed ? (
        <img className="avatar__img" src={url} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
      ) : (
        initials(name)
      )}
    </span>
  );
}
