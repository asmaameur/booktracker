import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { STATUS_LABELS, formatNumber } from '../../utils/format';

export function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <header className="page-header">
      <div className="page-header__text">
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1 className="page-header__title">{title}</h1>
        {description && <p className="page-header__description">{description}</p>}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </header>
  );
}

export function BackLink({ to, children }) {
  return (
    <Link to={to} className="back-link">
      <ArrowLeft aria-hidden="true" />
      {children}
    </Link>
  );
}

export function StatusBadge({ status }) {
  if (!status) return null;
  return (
    <span className={`badge badge--${status}`}>
      <span className="badge__dot" aria-hidden="true" />
      {STATUS_LABELS[status]}
    </span>
  );
}

export function StatTile({ icon: Icon, label, value, note }) {
  return (
    <div className="stat">
      <span className="stat__label">
        {Icon && <Icon aria-hidden="true" />}
        {label}
      </span>
      <span className="stat__value">{typeof value === 'number' ? formatNumber(value) : value}</span>
      {note && <span className="stat__note">{note}</span>}
    </div>
  );
}

export function ProgressMeter({ currentPage, totalPages, percent, status, label }) {
  const value = Math.max(0, Math.min(100, percent ?? 0));
  const pages = totalPages ? `Page ${formatNumber(currentPage)} of ${formatNumber(totalPages)}` : 'Not started';
  return (
    <div className={`meter ${status === 'read' ? 'meter--read' : ''}`}>
      <div className="meter__labels">
        <span>{label || pages}</span>
        <span className="tabular">{value}%</span>
      </div>
      <div
        className="meter__track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        aria-valuetext={`${value}% read. ${pages}`}
      >
        <div className="meter__fill" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function pageList(page, totalPages) {
  const pages = new Set([1, totalPages, page - 1, page, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const result = [];
  sorted.forEach((p, index) => {
    if (index > 0 && p - sorted[index - 1] > 1) result.push(`gap-${p}`);
    result.push(p);
  });
  return result;
}

export function Pagination({ page, totalPages, onChange }) {
  if (!totalPages || totalPages <= 1) return null;
  return (
    <nav className="pagination" aria-label="Pages">
      <button
        type="button"
        className="icon-btn"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        aria-label="Previous page"
      >
        <ChevronLeft aria-hidden="true" />
      </button>
      {pageList(page, totalPages).map((item) =>
        typeof item === 'string' ? (
          <span key={item} className="pagination__gap" aria-hidden="true">
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            className="pagination__page"
            aria-current={item === page ? 'page' : undefined}
            aria-label={`Page ${item}`}
            onClick={() => onChange(item)}
          >
            {item}
          </button>
        )
      )}
      <button
        type="button"
        className="icon-btn"
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        aria-label="Next page"
      >
        <ChevronRight aria-hidden="true" />
      </button>
    </nav>
  );
}
