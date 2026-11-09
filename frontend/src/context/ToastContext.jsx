import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { CircleCheck, CircleAlert, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

const ICONS = { success: CircleCheck, error: CircleAlert, info: Info };
const DURATIONS = { success: 4500, info: 5000, error: 7000 };

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(
    ({ type = 'info', title, message }) => {
      const id = nextId.current++;
      setToasts((current) => [...current.slice(-3), { id, type, title, message }]);
      setTimeout(() => dismiss(id), DURATIONS[type] || 5000);
      return id;
    },
    [dismiss]
  );

  const value = useMemo(
    () => ({
      notify,
      success: (message, title) => notify({ type: 'success', message, title }),
      error: (message, title) => notify({ type: 'error', message, title }),
      info: (message, title) => notify({ type: 'info', message, title }),
    }),
    [notify]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toaster" role="region" aria-label="Notifications" aria-live="polite">
        {toasts.map((toast) => {
          const Icon = ICONS[toast.type] || Info;
          return (
            <div key={toast.id} className={`toast toast--${toast.type}`} role={toast.type === 'error' ? 'alert' : 'status'}>
              <Icon className="toast__icon" aria-hidden="true" />
              <div>
                {toast.title && <strong className="toast__title">{toast.title}</strong>}
                <p className="toast__message">{toast.message}</p>
              </div>
              <button type="button" className="icon-btn toast__close" onClick={() => dismiss(toast.id)} aria-label="Dismiss notification">
                <X aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside ToastProvider');
  return context;
}
