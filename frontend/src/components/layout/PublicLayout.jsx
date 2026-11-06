import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Button from '../ui/Button';
import { Logo, LogoMark, ThemeToggle } from './Brand';
import { homePathFor, useAuth } from '../../context/AuthContext';

export function PublicHeader() {
  const { user, isAuthenticated } = useAuth();
  return (
    <header className="public-header">
      <div className="public-header__inner">
        <Logo />
        <div className="public-header__actions">
          <ThemeToggle />
          {isAuthenticated ? (
            <Button as={Link} to={homePathFor(user)} variant="primary" size="sm">
              Open my library
            </Button>
          ) : (
            <>
              <Button as={Link} to="/login" variant="ghost" size="sm" className="public-header__login">
                Log in
              </Button>
              <Button as={Link} to="/register" variant="primary" size="sm">
                Create account
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <Logo />
        <p>A digital library for readers who take their time. © {new Date().getFullYear()} BookTracker</p>
      </div>
    </footer>
  );
}

const QUOTES = {
  default: { text: 'A room without books is like a body without a soul.', author: 'Marcus Tullius Cicero' },
  register: { text: 'I declare after all there is no enjoyment like reading!', author: 'Jane Austen' },
  verify: { text: 'There is no friend as loyal as a book.', author: 'Ernest Hemingway' },
};

// Two columns on large screens: a quotation on deep green, and the form.
export function AuthLayout({ quote = 'default', children }) {
  const { text, author } = QUOTES[quote] || QUOTES.default;
  return (
    <div className="auth-layout">
      <aside className="auth-aside on-dark" aria-hidden="true">
        <span className="logo">
          <LogoMark />
          <span className="logo__word">
            Book<em>Tracker</em>
          </span>
        </span>
        <figure className="auth-aside__quote">
          <blockquote>“{text}”</blockquote>
          <figcaption>{author}</figcaption>
        </figure>
        <p className="auth-aside__foot">Your catalogue, your shelves, your place in every book.</p>
      </aside>

      <main className="auth-main">
        <div className="auth-main__top">
          <Logo />
          <div className="public-header__actions">
            <Button as={Link} to="/" variant="ghost" size="sm" icon={ArrowLeft}>
              Home
            </Button>
            <ThemeToggle />
          </div>
        </div>
        <div className="auth-main__body">
          <div className="auth-card">{children}</div>
        </div>
      </main>
    </div>
  );
}
