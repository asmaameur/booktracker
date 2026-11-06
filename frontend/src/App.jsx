import { lazy, Suspense, useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';

import AppLayout from './components/layout/AppLayout';
import { PublicOnly, RequireRole } from './components/layout/RouteGuards';
import { FullscreenLoader } from './components/ui/States';

import LandingPage from './pages/public/LandingPage';
import LoginPage from './pages/public/LoginPage';
import RegisterPage from './pages/public/RegisterPage';
import CheckEmailPage from './pages/public/CheckEmailPage';
import VerifyEmailPage from './pages/public/VerifyEmailPage';
import NotFoundPage from './pages/public/NotFoundPage';

import ReaderDashboard from './pages/reader/ReaderDashboard';
import CataloguePage from './pages/reader/CataloguePage';
import BookDetailsPage from './pages/reader/BookDetailsPage';
import LibraryPage from './pages/reader/LibraryPage';

import AdminDashboard from './pages/admin/AdminDashboard';
import AdminBooksPage from './pages/admin/AdminBooksPage';
import BookFormPage from './pages/admin/BookFormPage';
import AdminBookDetailsPage from './pages/admin/AdminBookDetailsPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';

import ProfilePage from './pages/shared/ProfilePage';

// The PDF reader carries the PDF.js library, so it loads only when opened.
const ReaderPage = lazy(() => import('./pages/shared/ReaderPage'));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<FullscreenLoader />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route element={<PublicOnly />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
          </Route>
          <Route path="/check-email" element={<CheckEmailPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />

          <Route element={<RequireRole role="user" />}>
            <Route path="/app" element={<AppLayout variant="user" />}>
              <Route index element={<ReaderDashboard />} />
              <Route path="catalogue" element={<CataloguePage />} />
              <Route path="books/:id" element={<BookDetailsPage />} />
              <Route path="library" element={<LibraryPage />} />
              <Route path="profile" element={<ProfilePage />} />
            </Route>
            <Route path="/app/read/:id" element={<ReaderPage mode="reader" />} />
          </Route>

          <Route element={<RequireRole role="admin" />}>
            <Route path="/admin" element={<AppLayout variant="admin" />}>
              <Route index element={<AdminDashboard />} />
              <Route path="books" element={<AdminBooksPage />} />
              <Route path="books/new" element={<BookFormPage key="new" />} />
              <Route path="books/:id" element={<AdminBookDetailsPage />} />
              <Route path="books/:id/edit" element={<BookFormPage key="edit" />} />
              <Route path="users" element={<AdminUsersPage />} />
              <Route path="profile" element={<ProfilePage />} />
            </Route>
            <Route path="/admin/books/:id/read" element={<ReaderPage mode="preview" />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </>
  );
}
