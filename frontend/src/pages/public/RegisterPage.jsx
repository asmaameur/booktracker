import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, Mail, UserRound } from 'lucide-react';
import Button from '../../components/ui/Button';
import { PasswordField, TextField } from '../../components/ui/FormFields';
import { Alert } from '../../components/ui/States';
import { AuthLayout } from '../../components/layout/PublicLayout';
import { authApi } from '../../api';
import { useDocumentTitle } from '../../hooks/misc';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// The same rules the backend applies, so most mistakes are caught before sending.
const PASSWORD_RULES = [
  { id: 'length', label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { id: 'letter', label: 'At least one letter', test: (p) => /[A-Za-z]/.test(p) },
  { id: 'number', label: 'At least one number', test: (p) => /\d/.test(p) },
];

function validate(values) {
  const errors = {};
  const name = values.name.trim();
  if (name.length < 2 || name.length > 100) errors.name = 'Name must be between 2 and 100 characters.';
  if (!EMAIL_PATTERN.test(values.email.trim())) errors.email = 'Please enter a valid email address.';
  if (!PASSWORD_RULES.every((rule) => rule.test(values.password))) {
    errors.password = 'Your password does not meet the requirements below.';
  }
  if (values.confirm !== values.password) errors.confirm = 'The two passwords do not match.';
  return errors;
}

export default function RegisterPage() {
  useDocumentTitle('Create an account');
  const navigate = useNavigate();
  const [values, setValues] = useState({ name: '', email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const update = (field) => (event) => {
    setValues((v) => ({ ...v, [field]: event.target.value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = validate(values);
    setErrors(nextErrors);
    setFormError(null);
    if (Object.keys(nextErrors).length) return;

    setSubmitting(true);
    try {
      const email = values.email.trim();
      const result = await authApi.register({ name: values.name.trim(), email, password: values.password });
      navigate(`/check-email?email=${encodeURIComponent(result.user.email)}`, {
        replace: true,
        state: { emailSent: result.emailSent, justRegistered: true },
      });
    } catch (error) {
      setSubmitting(false);
      if (error.errors && Object.keys(error.errors).length) setErrors(error.errors);
      else setFormError(error);
    }
  };

  return (
    <AuthLayout quote="register">
      <header className="auth-card__header">
        <span className="eyebrow">Join BookTracker</span>
        <h1 className="auth-card__title">Create your library</h1>
        <p className="muted">After signing up, we will email you a link to confirm your address.</p>
      </header>

      {formError && (
        <div className="auth-card__alert">
          <Alert type="error">{formError.message}</Alert>
        </div>
      )}

      <form className="form" onSubmit={onSubmit} noValidate>
        <TextField
          label="Full name"
          name="name"
          autoComplete="name"
          icon={UserRound}
          value={values.name}
          onChange={update('name')}
          error={errors.name}
          autoFocus
        />
        <TextField
          label="Email address"
          type="email"
          name="email"
          autoComplete="email"
          icon={Mail}
          value={values.email}
          onChange={update('email')}
          error={errors.email}
        />
        <div className="field-group">
          <PasswordField
            label="Password"
            name="password"
            autoComplete="new-password"
            value={values.password}
            onChange={update('password')}
            error={errors.password}
          />
          <ul className="password-rules" aria-label="Password requirements">
            {PASSWORD_RULES.map((rule) => {
              const ok = rule.test(values.password);
              return (
                <li key={rule.id} className={ok ? 'is-met' : ''}>
                  <Check aria-hidden="true" />
                  <span>{rule.label}</span>
                  <span className="visually-hidden">{ok ? '(met)' : '(not met yet)'}</span>
                </li>
              );
            })}
          </ul>
        </div>
        <PasswordField
          label="Confirm password"
          name="confirm"
          autoComplete="new-password"
          value={values.confirm}
          onChange={update('confirm')}
          error={errors.confirm}
        />
        <Button type="submit" size="lg" block loading={submitting}>
          Create my account
        </Button>
      </form>

      <p className="auth-card__footer">
        Already have an account?{' '}
        <Link to="/login" className="text-link">
          Log in
        </Link>
      </p>
    </AuthLayout>
  );
}
