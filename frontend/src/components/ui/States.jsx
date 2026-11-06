import { CircleAlert, CircleCheck, Info, RefreshCw, TriangleAlert } from 'lucide-react';
import Button from './Button';

export function Spinner({ large = false, label }) {
  return (
    <span className={`spinner ${large ? 'spinner--lg' : ''}`} role={label ? 'status' : undefined} aria-label={label} />
  );
}

export function LoadingState({ label = 'Loading…' }) {
  return (
    <div className="loading-state" role="status">
      <Spinner large />
      <span>{label}</span>
    </div>
  );
}

export function FullscreenLoader() {
  return (
    <div className="fullscreen-loader">
      <LoadingState label="Opening your library…" />
    </div>
  );
}

export function ErrorState({ title = 'Something went wrong', error, message, onRetry, children }) {
  return (
    <div className="state state--error" role="alert">
      <div className="state__icon">
        <CircleAlert aria-hidden="true" />
      </div>
      <h2 className="state__title">{title}</h2>
      <p className="state__text">{message || error?.message || 'Please try again in a moment.'}</p>
      <div className="state__actions">
        {onRetry && (
          <Button variant="secondary" icon={RefreshCw} onClick={onRetry}>
            Try again
          </Button>
        )}
        {children}
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon = Info, title, text, children, compact = false }) {
  return (
    <div className={`state ${compact ? 'state--compact' : ''}`}>
      <div className="state__icon">
        <Icon aria-hidden="true" />
      </div>
      <h2 className="state__title">{title}</h2>
      {text && <p className="state__text">{text}</p>}
      {children && <div className="state__actions">{children}</div>}
    </div>
  );
}

const ALERT_ICONS = { error: CircleAlert, success: CircleCheck, info: Info, warning: TriangleAlert };

export function Alert({ type = 'info', title, children }) {
  const Icon = ALERT_ICONS[type];
  return (
    <div className={`alert alert--${type}`} role={type === 'error' ? 'alert' : 'status'}>
      <Icon aria-hidden="true" />
      <div>
        {title && <strong className="alert__title">{title}</strong>}
        {children}
      </div>
    </div>
  );
}
