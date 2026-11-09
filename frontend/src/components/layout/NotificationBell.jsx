import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, X } from 'lucide-react';
import BookCover from '../books/BookCover';
import { Spinner } from '../ui/States';
import { notificationsApi } from '../../api';
import { useToast } from '../../context/ToastContext';
import { formatRelative } from '../../utils/format';

// How often the unread counter is refreshed while the tab is visible. It is
// also refreshed straight away when the reader comes back to the tab.
const POLL_MS = 20000;
// How long the pop-up with new notifications stays on screen (paused while
// the pointer or keyboard focus is on it).
const PEEK_MS = 10000;
const PEEK_COUNT = 3;

// Readers are notified of new books; admins of new ratings. Clicking a
// notification opens the book in the reader's or the admin's section.
export default function NotificationBell({ variant = 'user' }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const lastUnread = useRef(null);
  // Pop-up shown without clicking the bell: { notifications, unreadCount }.
  const [peek, setPeek] = useState(null);
  const [peekPaused, setPeekPaused] = useState(false);
  const openRef = useRef(false);
  openRef.current = open;

  // Shows the newest unread notifications in the pop-up (not while the full
  // list is already open).
  const showPeek = useCallback(async (signal) => {
    try {
      const data = await notificationsApi.list({ limit: PEEK_COUNT, unread: 'true' }, signal);
      if (data.notifications.length && !openRef.current) {
        setPeek({ notifications: data.notifications, unreadCount: data.unreadCount });
      }
    } catch {
      // The bell's counter still shows them; the pop-up is only a bonus.
    }
  }, []);

  // Hide the pop-up after a while, unless the user is reading it.
  useEffect(() => {
    if (!peek || peekPaused) return undefined;
    const timer = setTimeout(() => setPeek(null), PEEK_MS);
    return () => clearTimeout(timer);
  }, [peek, peekPaused]);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await notificationsApi.list({ limit: 20 });
      setItems(data.notifications);
      setUnread(data.unreadCount);
      lastUnread.current = data.unreadCount;
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Poll the unread counter; when it changes, the open list is refreshed and
  // the cached list is dropped so it reloads on the next opening.
  // The pop-up appears on the first check (just after login or a page
  // refresh) if anything is unread, and again whenever a new one arrives.
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const refresh = async () => {
      if (document.visibilityState === 'hidden') return;
      try {
        const { unreadCount } = await notificationsApi.unreadCount(controller.signal);
        if (cancelled) return;
        const firstCheck = lastUnread.current === null;
        const hasNew = !firstCheck && unreadCount > lastUnread.current;
        if (hasNew) setItems(null);
        if ((firstCheck && unreadCount > 0) || hasNew) showPeek(controller.signal);
        lastUnread.current = unreadCount;
        setUnread(unreadCount);
      } catch {
        // Network hiccups are ignored; the next tick tries again.
      }
    };

    refresh();
    const timer = setInterval(refresh, POLL_MS);
    const onVisible = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', refresh);
    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', refresh);
    };
  }, [showPeek]);

  useEffect(() => {
    // After a failed load, the "Try again" button reloads instead of a loop.
    if (open && items === null && !loading && !error) loadList();
  }, [open, items, loading, error, loadList]);

  // Close on outside click and on Escape (focus goes back to the bell).
  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const openNotification = async (notification) => {
    setOpen(false);
    setPeek(null);
    if (!notification.isRead) {
      setItems((list) => list?.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n)) ?? list);
      setUnread((count) => Math.max(0, count - 1));
      lastUnread.current = Math.max(0, (lastUnread.current ?? 1) - 1);
      notificationsApi
        .markRead(notification.id)
        .then(({ unreadCount }) => {
          setUnread(unreadCount);
          lastUnread.current = unreadCount;
        })
        .catch(() => {});
    }
    if (notification.book) navigate(`${bookBase}/${notification.book.id}`);
  };

  const markAll = async () => {
    try {
      await notificationsApi.markAllRead();
      setItems((list) => list?.map((n) => ({ ...n, isRead: true })) ?? list);
      setUnread(0);
      lastUnread.current = 0;
    } catch (err) {
      toast.error(err.message);
    }
  };

  const bookBase = variant === 'admin' ? '/admin/books' : '/app/books';
  const emptyText =
    variant === 'admin'
      ? "You're all caught up. New ratings from readers will appear here."
      : "You're all caught up. New books will appear here.";

  const badge = unread > 99 ? '99+' : String(unread);

  return (
    <div className="notif" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="icon-btn notif__button"
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => {
          setError(null);
          setPeek(null);
          setOpen((value) => !value);
        }}
      >
        <Bell aria-hidden="true" />
        {unread > 0 && (
          <span className="notif__count" aria-hidden="true">
            {badge}
          </span>
        )}
      </button>

      {peek && !open && (
        <div
          className="notif__peek"
          role="status"
          aria-live="polite"
          onMouseEnter={() => setPeekPaused(true)}
          onMouseLeave={() => setPeekPaused(false)}
          onFocus={() => setPeekPaused(true)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setPeekPaused(false);
          }}
        >
          <div className="notif__peek-header">
            <strong className="notif__peek-title">
              <Bell aria-hidden="true" />
              {peek.unreadCount === 1 ? 'You have a new notification' : `You have ${peek.unreadCount} new notifications`}
            </strong>
            <button
              type="button"
              className="icon-btn notif__peek-close"
              onClick={() => {
                setPeek(null);
                setPeekPaused(false);
              }}
              aria-label="Close"
            >
              <X aria-hidden="true" />
            </button>
          </div>
          <ul className="notif__list">
            {peek.notifications.map((notification) => (
              <li key={notification.id}>
                <button
                  type="button"
                  className="notif__item notif__item--unread"
                  onClick={() => {
                    setPeekPaused(false);
                    openNotification(notification);
                  }}
                >
                  <span className="notif__cover">
                    {notification.book && <BookCover book={notification.book} />}
                  </span>
                  <span className="notif__text">
                    <span className="notif__book">{notification.book?.title ?? 'A book'}</span>
                    <span className="notif__message">{notification.message}</span>
                    <span className="notif__time">{formatRelative(notification.createdAt)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {peek.unreadCount > peek.notifications.length && (
            <button
              type="button"
              className="text-link notif__peek-more"
              onClick={() => {
                setPeek(null);
                setPeekPaused(false);
                setOpen(true);
              }}
            >
              See all {peek.unreadCount} notifications
            </button>
          )}
        </div>
      )}

      {open && (
        <div className="notif__panel" role="region" aria-label="Notifications">
          <div className="notif__header">
            <h2 className="notif__title">Notifications</h2>
            {unread > 0 && (
              <button type="button" className="text-link notif__mark-all" onClick={markAll}>
                <CheckCheck aria-hidden="true" />
                Mark all as read
              </button>
            )}
          </div>

          {loading && !items ? (
            <div className="notif__state">
              <Spinner label="Loading notifications" />
            </div>
          ) : error && !items ? (
            <div className="notif__state">
              <p>{error.message}</p>
              <button type="button" className="text-link" onClick={loadList}>
                Try again
              </button>
            </div>
          ) : !items?.length ? (
            <div className="notif__state">
              <Bell aria-hidden="true" />
              <p>{emptyText}</p>
            </div>
          ) : (
            <ul className="notif__list">
              {items.map((notification) => (
                <li key={notification.id}>
                  <button
                    type="button"
                    className={`notif__item ${notification.isRead ? '' : 'notif__item--unread'}`}
                    onClick={() => openNotification(notification)}
                  >
                    <span className="notif__cover">
                      {notification.book && <BookCover book={notification.book} />}
                    </span>
                    <span className="notif__text">
                      <span className="notif__book">{notification.book?.title ?? 'A book'}</span>
                      <span className="notif__message">{notification.message}</span>
                      <span className="notif__time">{formatRelative(notification.createdAt)}</span>
                    </span>
                    {!notification.isRead && (
                      <span className="notif__dot">
                        <span className="visually-hidden">Unread</span>
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
