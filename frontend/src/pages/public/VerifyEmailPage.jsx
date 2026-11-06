import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CircleAlert, CircleCheck, Mail, Send } from 'lucide-react';
import Button from '../../components/ui/Button';
import { TextField } from '../../components/ui/FormFields';
import { Alert, LoadingState } from '../../components/ui/States';
import { AuthLayout } from '../../components/layout/PublicLayout';
import { authApi } from '../../api';
import { homePathFor, useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useDocumentTitle } from '../../hooks/misc';

function ResendForm() {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    setSending(true);
    setError(null);
    try {
      const { message } = await authApi.resendVerification(email.trim());
      toast.success(message, 'Verification email');
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <form className="form verify__form" onSubmit={onSubmit} noValidate>
      <TextField
        label="Email address"
        type="email"
        icon={Mail}
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        error={error}
      />
      <Button type="submit" icon={Send} loading={sending} block>
        Send a new link
      </Button>
    </form>
  );
}

// "Verification result" page, opened from the link in the email.
export default function VerifyEmailPage() {
  useDocumentTitle('Email verification');
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const { user, isAuthenticated, updateUser } = useAuth();
  const [state, setState] = useState({ status: token ? 'loading' : 'error', result: null, error: null });
  const started = useRef(false);

  useEffect(() => {
    // A verification link works only once, so make sure it is sent only once
    // (React's development mode runs effects twice).
    if (!token || started.current) return;
    started.current = true;
    authApi
      .verifyEmail(token)
      .then((result) => {
        setState({ status: 'success', result, error: null });
        if (isAuthenticated && result.user.id === user?.id) updateUser(result.user);
      })
      .catch((error) => setState({ status: 'error', result: null, error }));
  }, [token, isAuthenticated, user?.id, updateUser]);

  if (state.status === 'loading') {
    return (
      <AuthLayout quote="verify">
        <LoadingState label="Confirming your email address…" />
      </AuthLayout>
    );
  }

  if (state.status === 'success') {
    const isEmailChange = state.result.purpose === 'email-change';
    return (
      <AuthLayout quote="verify">
        <div className="verify">
          <div className="verify__icon verify__icon--success">
            <CircleCheck aria-hidden="true" />
          </div>
          <span className="eyebrow eyebrow--plain">Verification complete</span>
          <h1 className="auth-card__title">{isEmailChange ? 'New address confirmed' : 'Welcome to BookTracker'}</h1>
          <p className="lead">{state.result.message}</p>
          {isAuthenticated ? (
            <Button as={Link} to={isEmailChange ? `${homePathFor(user)}/profile` : homePathFor(user)} size="lg" block>
              {isEmailChange ? 'Back to my profile' : 'Open my library'}
            </Button>
          ) : (
            <Button
              as={Link}
              to="/login"
              state={{ email: state.result.user.email, notice: state.result.message }}
              size="lg"
              block
            >
              Log in
            </Button>
          )}
        </div>
      </AuthLayout>
    );
  }

  const code = state.error?.code;
  const expired = code === 'VERIFICATION_TOKEN_EXPIRED';
  const title = !token
    ? 'This link is incomplete'
    : expired
      ? 'This link has expired'
      : code === 'EMAIL_TAKEN'
        ? 'This address is already in use'
        : 'This link cannot be used';
  const message = !token
    ? 'The verification link is missing its code. Open the link from your email again, or request a new one.'
    : state.error?.message;

  return (
    <AuthLayout quote="verify">
      <div className="verify">
        <div className="verify__icon verify__icon--error">
          <CircleAlert aria-hidden="true" />
        </div>
        <span className="eyebrow eyebrow--plain">Email verification</span>
        <h1 className="auth-card__title">{title}</h1>
        <p className="lead">{message}</p>
        {code === 'INVALID_VERIFICATION_TOKEN' && (
          <Alert type="info">
            If you already opened this link, your address is probably verified.{' '}
            <Link to="/login" className="text-link">
              Try logging in
            </Link>
            .
          </Alert>
        )}
        {code !== 'EMAIL_TAKEN' && code !== 'NETWORK_ERROR' && <ResendForm />}
        {code === 'NETWORK_ERROR' && (
          <Button variant="secondary" onClick={() => window.location.reload()} block>
            Try again
          </Button>
        )}
      </div>
    </AuthLayout>
  );
}
