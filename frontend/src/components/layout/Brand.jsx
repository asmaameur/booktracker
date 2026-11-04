import { Link } from 'react-router-dom';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export function LogoMark({ className = 'logo__mark' }) {
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="10" fill="#183D32" />
      <rect x="1" y="1" width="62" height="62" rx="9" fill="none" stroke="#C5A46D" strokeOpacity="0.45" />
      <path d="M18 14h22a6 6 0 0 1 6 6v30H24a6 6 0 0 1-6-6V14z" fill="#F5F0E6" />
      <path d="M24 50a6 6 0 0 1 0-12h22" fill="none" stroke="#183D32" strokeWidth="3" />
      <path d="M30 14v18l5-4 5 4V14" fill="#C5A46D" />
    </svg>
  );
}

export function Logo({ to = '/', className = '' }) {
  return (
    <Link to={to} className={`logo ${className}`} aria-label="BookTracker home">
      <LogoMark />
      <span className="logo__word">
        Book<em>Tracker</em>
      </span>
    </Link>
  );
}

export function ThemeToggle({ className = '' }) {
  const { theme, toggleTheme } = useTheme();
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      type="button"
      className={`icon-btn theme-toggle ${className}`}
      onClick={toggleTheme}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
    >
      {theme === 'dark' ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
    </button>
  );
}
