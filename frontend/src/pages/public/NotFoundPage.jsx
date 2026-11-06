import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Button from '../../components/ui/Button';
import { PublicHeader } from '../../components/layout/PublicLayout';
import { homePathFor, useAuth } from '../../context/AuthContext';
import { useDocumentTitle } from '../../hooks/misc';

export default function NotFoundPage() {
  useDocumentTitle('Page not found');
  const { user, isAuthenticated } = useAuth();
  return (
    <div className="landing">
      <PublicHeader />
      <main id="main" className="not-found">
        <span className="not-found__code" aria-hidden="true">
          404
        </span>
        <span className="eyebrow eyebrow--plain">Page not found</span>
        <h1>This page is not on our shelves</h1>
        <p className="lead">The address may be mistyped, or the page may have moved.</p>
        <Button as={Link} to={isAuthenticated ? homePathFor(user) : '/'} icon={ArrowLeft}>
          {isAuthenticated ? 'Back to my library' : 'Back to the home page'}
        </Button>
      </main>
    </div>
  );
}
