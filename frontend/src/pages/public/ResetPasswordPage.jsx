import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Check, CircleAlert, KeyRound } from 'lucide-react';
import Button from '../../components/ui/Button';
import { PasswordField } from '../../components/ui/FormFields';
import { Alert } from '../../components/ui/States';
import { AuthLayout } from '../../components/layout/PublicLayout';
import { authApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useDocumentTitle } from '../../hooks/misc';

// Same rules as registration (backend/src/middleware/validators/rules.js).
const PASSWORD_RULES = [
  { id: 'length', label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { id: 'letter', label: 'At least one letter', test: (p) => /[A-Za-z]/.test(p) },
  { id: 'number', label: 'At least one number', test: (p) => /\d/.test(p) },
];

const LINK_PROBLEMS = new Set(['INVALID_RESET_TOKEN', 'RESET_TOKEN_EXPIRED']);

function BadLink({ title, message }) {
  return (
    <AuthLayout quote="verify">
      <div className="verify">
        <div className="verify__icon verify__icon--error">
          <CircleAlert aria-hidden="true" />
        </div>
        <span className="eyebrow eyebrow--plain">Password reset</span>
        <h1 className="auth-card__title">{title}</h1>
        <p className="lead">{message}</p>
        <Button as={Link} to="/forgot-password" size="lg" block>
          Request a new link
        </Button>
      </div>
    </AuthLayout>
  );
}

// Opened from the link in the "Reset your password" email.
export default function ResetPasswordPage() {
  useDocumentTitle('Choose a new password');
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const navigate = useNavigate();
  const { isAuthenticated, logout } = useAuth();

  const [values, setValues] = useState({ password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [linkError, setLinkError] = useState(null);
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  if (!/^[a-f0-9]{64}$/.test(token)) {
    return (
      <BadLink
        title="This link is incomplete"
        message="Open the link from the email again, making sure it was copied in full, or request a new one."
      />
    );
  }
  if (linkError) {
    return (
      <BadLink
        title={linkError.code === 'RESET_TOKEN_EXPIRED' ? 'This link has expired' : 'This link no longer works'}
        message={linkError.message}
      />
    );
  }

  const update = (field) => (event) => {
    setValues((v) => ({ ...v, [field]: event.target.value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = {};
    if (!PASSWORD_RULES.every((rule) => rule.test(values.password))) {
      nextErrors.password = 'Your password does not meet the requirements below.';
    }
    if (values.confirm !== values.password) nextErrors.confirm = 'The two passwords do not match.';
    setErrors(nextErrors);
    setFormError(null);
    if (Object.keys(nextErrors).length) return;

    setSaving(true);
    try {
      const { message } = await authApi.resetPassword({ token, password: values.password });
      // Every existing session was signed out by the reset, this one included.
      if (isAuthenticated) logout();
      navigate('/login', { replace: true, state: { notice: message } });
    } catch (error) {
      setSaving(false);
      if (LINK_PROBLEMS.has(error.code)) setLinkError(error);
      else if (error.errors?.password) setErrors({ password: error.errors.password });
      else setFormError(error);
    }
  };

  return (
    <AuthLayout>
      <header className="auth-card__header">
        <span className="eyebrow">Password reset</span>
        <h1 className="auth-card__title">Choose a new password</h1>
        <p className="muted">After saving, you will be signed out on every device and can log in with the new password.</p>
      </header>

      {formError && (
        <div className="auth-card__alert">
          <Alert type="error">{formError.message}</Alert>
        </div>
      )}

      <form className="form" onSubmit={onSubmit} noValidate>
        <div className="field-group">
          <PasswordField
            label="New password"
            name="password"
            autoComplete="new-password"
            value={values.password}
            onChange={update('password')}
            error={errors.password}
            autoFocus
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
          label="Confirm new password"
          name="confirm"
          autoComplete="new-password"
          value={values.confirm}
          onChange={update('confirm')}
          error={errors.confirm}
        />
        <Button type="submit" size="lg" block icon={KeyRound} loading={saving}>
          Save my new password
        </Button>
      </form>
    </AuthLayout>
  );
}
