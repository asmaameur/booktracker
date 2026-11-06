import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Mail } from 'lucide-react';
import Button from '../../components/ui/Button';
import { PasswordField, TextField } from '../../components/ui/FormFields';
import { Alert } from '../../components/ui/States';
import { AuthLayout } from '../../components/layout/PublicLayout';
import { homePathFor, useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useDocumentTitle } from '../../hooks/misc';
import { firstName } from '../../utils/format';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function LoginPage() {
  useDocumentTitle('Log in');
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [values, setValues] = useState({ email: location.state?.email || '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const update = (field) => (event) => {
    setValues((v) => ({ ...v, [field]: event.target.value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = {};
    if (!EMAIL_PATTERN.test(values.email.trim())) nextErrors.email = 'Please enter a valid email address.';
    if (!values.password) nextErrors.password = 'Please enter your password.';
    setErrors(nextErrors);
    setFormError(null);
    if (Object.keys(nextErrors).length) return;

    setSubmitting(true);
    try {
      const user = await login({ email: values.email.trim(), password: values.password });
      toast.success(`Welcome back, ${firstName(user.name)}.`);
      const from = location.state?.from;
      const allowed = from && from.startsWith(homePathFor(user));
      navigate(allowed ? from : homePathFor(user), { replace: true });
    } catch (error) {
      setSubmitting(false);
      if (error.code === 'VALIDATION_ERROR') setErrors(error.errors);
      setFormError(error);
    }
  };

  return (
    <AuthLayout>
      <header className="auth-card__header">
        <span className="eyebrow">Welcome back</span>
        <h1 className="auth-card__title">Log in to your library</h1>
      </header>

      {location.state?.notice && !formError && (
        <div className="auth-card__alert">
          <Alert type="success">{location.state.notice}</Alert>
        </div>
      )}

      {formError && (
        <div className="auth-card__alert">
          {formError.code === 'EMAIL_NOT_VERIFIED' ? (
            <Alert type="warning" title="Your email is not verified yet">
              <p>{formError.message}</p>
              <Link
                className="text-link"
                to={`/check-email?email=${encodeURIComponent(values.email.trim())}`}
              >
                Send me a new verification link
              </Link>
            </Alert>
          ) : (
            <Alert type="error">{formError.message}</Alert>
          )}
        </div>
      )}

      <form className="form" onSubmit={onSubmit} noValidate>
        <TextField
          label="Email address"
          type="email"
          name="email"
          autoComplete="email"
          icon={Mail}
          value={values.email}
          onChange={update('email')}
          error={errors.email}
          autoFocus
        />
        <PasswordField
          label="Password"
          name="password"
          autoComplete="current-password"
          value={values.password}
          onChange={update('password')}
          error={errors.password}
        />
        <Button type="submit" size="lg" block loading={submitting}>
          Log in
        </Button>
      </form>

      <p className="auth-card__footer">
        New to BookTracker?{' '}
        <Link to="/register" className="text-link">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  );
}
