import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Bookmark, Library } from 'lucide-react';
import Button from '../../components/ui/Button';
import { PublicHeader, SiteFooter } from '../../components/layout/PublicLayout';
import { homePathFor, useAuth } from '../../context/AuthContext';
import { useDocumentTitle } from '../../hooks/misc';

// Spine widths are percentages of the shelf so the illustration scales down to
// the smallest phones without overflowing.
const SPINES = [
  { title: 'Persuasion', author: 'Austen', height: 82, width: 10.5, tone: 'forest' },
  { title: 'Middlemarch', author: 'Eliot', height: 94, width: 13.5, tone: 'ivory' },
  { title: 'Dracula', author: 'Stoker', height: 76, width: 9.5, tone: 'burgundy' },
  { title: 'Walden', author: 'Thoreau', height: 70, width: 9, tone: 'gold' },
  { title: 'Jane Eyre', author: 'Brontë', height: 88, width: 12, tone: 'slate' },
  { title: 'The Odyssey', author: 'Homer', height: 98, width: 14, tone: 'deep' },
  { title: 'Emma', author: 'Austen', height: 66, width: 8.5, tone: 'sage', leaning: true },
];

function Bookshelf() {
  return (
    <div className="shelf" aria-hidden="true">
      <div className="shelf__books">
        {SPINES.map((spine) => (
          <div
            key={spine.title}
            className={`spine spine--${spine.tone} ${spine.leaning ? 'spine--leaning' : ''}`}
            style={{ '--h': `${spine.height}%`, '--w': `${spine.width}%` }}
          >
            <span className="spine__band" />
            <span className="spine__title">{spine.title}</span>
            <span className="spine__author">{spine.author}</span>
            <span className="spine__band spine__band--bottom" />
          </div>
        ))}
      </div>
      <div className="shelf__plank" />

      <div className="shelf__card">
        <span className="tag">Currently reading</span>
        <strong className="shelf__card-title">Pride and Prejudice</strong>
        <span className="shelf__card-meta">Page 142 of 380</span>
        <span className="shelf__card-track">
          <span style={{ width: '37%' }} />
        </span>
      </div>
    </div>
  );
}

const FEATURES = [
  {
    numeral: 'I',
    icon: BookOpen,
    title: 'Browse the catalogue',
    text: "Search by title or author, filter by category, and open each book's page for its description, year and cover.",
  },
  {
    numeral: 'II',
    icon: Library,
    title: 'Keep your own shelves',
    text: 'Sort your books into To Read, Reading and Read, and move them along as you go. Your library is visible only to you.',
  },
  {
    numeral: 'III',
    icon: Bookmark,
    title: 'Read, and resume',
    text: 'Open any book in the built-in reader. BookTracker saves your page as you read and opens it there next time, on any device.',
  },
];

export default function LandingPage() {
  useDocumentTitle('A private digital library');
  const { user, isAuthenticated } = useAuth();

  return (
    <div className="landing">
      <PublicHeader />

      <main id="main">
        <section className="hero">
          <div className="hero__inner">
            <div className="hero__text">
              <span className="eyebrow">A private reading room</span>
              <h1 className="hero__title">
                Every book you mean to read, <em>kept in one quiet place.</em>
              </h1>
              <p className="lead">
                BookTracker brings together a curated catalogue, your personal shelves and an elegant reader in the
                browser, and remembers the exact page where you stopped.
              </p>
              <div className="hero__actions">
                {isAuthenticated ? (
                  <Button as={Link} to={homePathFor(user)} size="lg" iconAfter={ArrowRight}>
                    Open my library
                  </Button>
                ) : (
                  <>
                    <Button as={Link} to="/register" size="lg" iconAfter={ArrowRight}>
                      Start your library
                    </Button>
                    <Button as={Link} to="/login" variant="secondary" size="lg">
                      Log in
                    </Button>
                  </>
                )}
              </div>
            </div>
            <Bookshelf />
          </div>
        </section>

        <section className="features" aria-labelledby="features-title">
          <div className="section-inner">
            <div className="section-heading">
              <span className="eyebrow">How it works</span>
              <h2 id="features-title">A library that keeps pace with you</h2>
            </div>
            <ol className="features__list">
              {FEATURES.map(({ numeral, icon: Icon, title, text }) => (
                <li key={numeral} className="feature">
                  <span className="feature__numeral" aria-hidden="true">
                    {numeral}
                  </span>
                  <Icon className="feature__icon" aria-hidden="true" />
                  <h3 className="feature__title">{title}</h3>
                  <p className="feature__text">{text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="quote-band">
          <figure className="section-inner quote-band__figure">
            <blockquote>“I declare after all there is no enjoyment like reading!”</blockquote>
            <figcaption>Jane Austen, Pride and Prejudice</figcaption>
          </figure>
        </section>

        {!isAuthenticated && (
          <section className="cta">
            <div className="section-inner cta__inner">
              <h2>Your next chapter is waiting.</h2>
              <p className="muted">Create a free account in under a minute, then confirm your email to begin.</p>
              <Button as={Link} to="/register" size="lg" iconAfter={ArrowRight}>
                Create my account
              </Button>
            </div>
          </section>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
