import { useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { Mail, MailCheck, Send } from 'lucide-react';
import Button from '../../components/ui/Button';
import { TextField } from '../../components/ui/FormFields';
import { Alert } from '../../components/ui/States';
import { AuthLayout } from '../../components/layout/PublicLayout';
import { authApi } from '../../api';
import { useToast } from '../../context/ToastContext';
import { useDocumentTitle } from '../../hooks/misc';

const COOLDOWN_SECONDS = 60;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// "Email verification" page: shown after registering, and reachable from the
// login page when an account is not verified yet.
export default function CheckEmailPage() {
  useDocumentTitle('Check your email');
  const toast = useToast();
  const location = useLocation();
  const [params] = useSearchParams();
  const initialEmail = params.get('email') || '';
  const justRegistered = Boolean(location.state?.justRegistered);

  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(justRegistered ? COOLDOWN_SECONDS : 0);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const resend = async (event) => {
    event.preventDefault();
    if (!EMAIL_PATTERN.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    setError(null);
    setSending(true);
    try {
      const { message } = await authApi.resendVerification(email.trim());
      toast.success(message, 'Verification email');
      setCooldown(COOLDOWN_SECONDS);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <AuthLayout quote="verify">
      <div className="verify">
        <div className="verify__icon">
          <MailCheck aria-hidden="true" />
        </div>
        <span className="eyebrow eyebrow--plain">Email verification</span>
        <h1 className="auth-card__title">Check your inbox</h1>
        {initialEmail ? (
          <p className="lead">
            We sent a verification link to <strong className="verify__email">{initialEmail}</strong>. Open it to
            activate your account; the link stays valid for 24 hours.
          </p>
        ) : (
          <p className="lead">Enter your email address and we will send you a new verification link.</p>
        )}

        {location.state?.emailSent === false && (
          <Alert type="warning">
            Your account was created, but the email could not be sent. Use the button below to try again.
          </Alert>
        )}

        <form className="form verify__form" onSubmit={resend} noValidate>
          {!initialEmail && (
            <TextField
              label="Email address"
              type="email"
              icon={Mail}
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              error={error}
            />
          )}
          {initialEmail && error && <Alert type="error">{error}</Alert>}
          <Button
            type="submit"
            variant={initialEmail ? 'secondary' : 'primary'}
            icon={Send}
            loading={sending}
            disabled={cooldown > 0}
            block
          >
            {cooldown > 0 ? `Resend available in ${cooldown}s` : 'Resend the verification email'}
          </Button>
        </form>

        <p className="auth-card__footer">
          Already verified?{' '}
          <Link to="/login" className="text-link" state={{ email: initialEmail }}>
            Log in
          </Link>
          . Can’t find the email? Check your spam folder.
        </p>
      </div>
    </AuthLayout>
  );
}
