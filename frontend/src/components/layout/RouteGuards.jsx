import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { homePathFor, useAuth } from '../../context/AuthContext';

// Lets a page through only for a logged-in user with the right role. The
// backend checks the same rules again on every request; this only decides what
// to show.
export function RequireRole({ role }) {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  if (role && user?.role !== role) {
    return <Navigate to={homePathFor(user)} replace />;
  }
  return <Outlet />;
}

// Login and registration pages send logged-in users to their dashboard.
export function PublicOnly() {
  const { user, isAuthenticated } = useAuth();
  return isAuthenticated ? <Navigate to={homePathFor(user)} replace /> : <Outlet />;
}
