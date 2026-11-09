import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Mail, MailCheck, Send } from 'lucide-react';
import Button from '../../components/ui/Button';
import { TextField } from '../../components/ui/FormFields';
import { Alert } from '../../components/ui/States';
import { AuthLayout } from '../../components/layout/PublicLayout';
import { authApi } from '../../api';
import { useDocumentTitle } from '../../hooks/misc';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// "Forgot your password?": sends a reset link by email. The answer is the same
// whether or not the address has an account.
export default function ForgotPasswordPage() {
  useDocumentTitle('Forgot password');
  const location = useLocation();
  const [email, setEmail] = useState(location.state?.email || '');
  const [error, setError] = useState(null);
  const [formError, setFormError] = useState(null);
  const [sending, setSending] = useState(false);
  const [sentMessage, setSentMessage] = useState(null);

  const onSubmit = async (event) => {
    event.preventDefault();
    setFormError(null);
    if (!EMAIL_PATTERN.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    setError(null);
    setSending(true);
    try {
      const { message } = await authApi.forgotPassword(email.trim());
      setSentMessage(message);
    } catch (err) {
      if (err.errors?.email) setError(err.errors.email);
      else setFormError(err);
    } finally {
      setSending(false);
    }
  };

  if (sentMessage) {
    return (
      <AuthLayout quote="verify">
        <div className="verify">
          <div className="verify__icon verify__icon--success">
            <MailCheck aria-hidden="true" />
          </div>
          <span className="eyebrow eyebrow--plain">Check your inbox</span>
          <h1 className="auth-card__title">Reset link sent</h1>
          <p className="lead">{sentMessage}</p>
          <p className="muted">Can't find it? Look in your spam folder, or try again in a minute.</p>
          <Button as={Link} to="/login" state={{ email: email.trim() }} size="lg" block>
            Back to log in
          </Button>
          <button type="button" className="text-link" onClick={() => setSentMessage(null)}>
            Use another email address
          </button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <header className="auth-card__header">
        <span className="eyebrow">Forgot your password?</span>
        <h1 className="auth-card__title">Reset your password</h1>
        <p className="muted">Enter the email address of your account and we will send you a link to choose a new password.</p>
      </header>

      {formError && (
        <div className="auth-card__alert">
          <Alert type="error">{formError.message}</Alert>
        </div>
      )}

      <form className="form" onSubmit={onSubmit} noValidate>
        <TextField
          label="Email address"
          type="email"
          name="email"
          autoComplete="email"
          icon={Mail}
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setError(null);
          }}
          error={error}
          autoFocus
        />
        <Button type="submit" size="lg" block icon={Send} loading={sending}>
          Send me a reset link
        </Button>
      </form>

      <p className="auth-card__footer">
        Remembered it?{' '}
        <Link to="/login" className="text-link">
          Back to log in
        </Link>
      </p>
    </AuthLayout>
  );
}
