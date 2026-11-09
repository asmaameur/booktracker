import { useEffect, useState } from 'react';
import { Check, KeyRound, Mail, Save, UserRound } from 'lucide-react';
import Button from '../../components/ui/Button';
import { PasswordField, TextField } from '../../components/ui/FormFields';
import { PageHeader } from '../../components/ui/Display';
import { Alert } from '../../components/ui/States';
import FavouriteGenresForm from '../../components/books/FavouriteGenres';
import { profileApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useApi } from '../../hooks/useApi';
import { useDocumentTitle } from '../../hooks/misc';
import { formatDate, initials } from '../../utils/format';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PASSWORD_RULES = [
  { id: 'length', label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { id: 'letter', label: 'At least one letter', test: (p) => /[A-Za-z]/.test(p) },
  { id: 'number', label: 'At least one number', test: (p) => /\d/.test(p) },
];

function DetailsForm({ user, onSaved }) {
  const toast = useToast();
  const [values, setValues] = useState({ name: user.name, email: user.email, currentPassword: '' });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValues((v) => ({ ...v, name: user.name, email: user.email }));
  }, [user.name, user.email]);

  const emailChanged = values.email.trim().toLowerCase() !== user.email;
  const nameChanged = values.name.trim() !== user.name;

  const update = (field) => (event) => {
    setValues((v) => ({ ...v, [field]: event.target.value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
    setMessage(null);
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = {};
    const name = values.name.trim();
    if (name.length < 2 || name.length > 100) nextErrors.name = 'Name must be between 2 and 100 characters.';
    if (!EMAIL_PATTERN.test(values.email.trim())) nextErrors.email = 'Please enter a valid email address.';
    if (emailChanged && !values.currentPassword) {
      nextErrors.currentPassword = 'Enter your current password to change your email address.';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    if (!nameChanged && !emailChanged) {
      setMessage({ type: 'info', text: 'Nothing to save: your details are unchanged.' });
      return;
    }

    setSaving(true);
    try {
      const payload = {};
      if (nameChanged) payload.name = name;
      if (emailChanged) {
        payload.email = values.email.trim();
        payload.currentPassword = values.currentPassword;
      }
      const result = await profileApi.update(payload);
      onSaved(result);
      setValues((v) => ({ ...v, email: result.user.email, currentPassword: '' }));
      if (result.emailSent === false) {
        setMessage({ type: 'error', text: result.message });
      } else {
        setMessage({ type: 'success', text: result.message });
        toast.success(result.message, 'Profile');
      }
    } catch (error) {
      if (error.errors && Object.keys(error.errors).length) setErrors(error.errors);
      else setMessage({ type: 'error', text: error.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="panel" aria-labelledby="details-title">
      <div className="panel__header">
        <div>
          <h2 id="details-title" className="panel__title">
            Personal details
          </h2>
          <p className="panel__subtitle">Your name appears in your library; your email is used to log in.</p>
        </div>
      </div>
      <form className="form panel__body" onSubmit={onSubmit} noValidate>
        {message && <Alert type={message.type}>{message.text}</Alert>}
        <TextField label="Full name" icon={UserRound} autoComplete="name" value={values.name} onChange={update('name')} error={errors.name} />
        <TextField
          label="Email address"
          type="email"
          icon={Mail}
          autoComplete="email"
          value={values.email}
          onChange={update('email')}
          error={errors.email}
          hint={emailChanged ? 'We will send a confirmation link to this new address.' : undefined}
        />
        {emailChanged && (
          <PasswordField
            label="Current password"
            autoComplete="current-password"
            value={values.currentPassword}
            onChange={update('currentPassword')}
            error={errors.currentPassword}
            hint="Required to change your email address."
          />
        )}
        <div className="form-actions">
          <Button type="submit" icon={Save} loading={saving}>
            Save details
          </Button>
        </div>
      </form>
    </section>
  );
}

function PasswordForm() {
  const toast = useToast();
  const { replaceToken } = useAuth();
  const empty = { currentPassword: '', newPassword: '', confirm: '' };
  const [values, setValues] = useState(empty);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);

  const update = (field) => (event) => {
    setValues((v) => ({ ...v, [field]: event.target.value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
    setMessage(null);
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = {};
    if (!values.currentPassword) nextErrors.currentPassword = 'Please enter your current password.';
    if (!PASSWORD_RULES.every((rule) => rule.test(values.newPassword))) {
      nextErrors.newPassword = 'Your new password does not meet the requirements below.';
    } else if (values.newPassword === values.currentPassword) {
      nextErrors.newPassword = 'Your new password must be different from the current one.';
    }
    if (values.confirm !== values.newPassword) nextErrors.confirm = 'The two passwords do not match.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSaving(true);
    try {
      const result = await profileApi.changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      replaceToken(result);
      setValues(empty);
      setMessage({ type: 'success', text: result.message });
      toast.success(result.message, 'Password changed');
    } catch (error) {
      if (error.errors && Object.keys(error.errors).length) setErrors(error.errors);
      else setMessage({ type: 'error', text: error.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="panel" aria-labelledby="password-title">
      <div className="panel__header">
        <div>
          <h2 id="password-title" className="panel__title">
            Password
          </h2>
          <p className="panel__subtitle">Changing it signs you out on your other devices.</p>
        </div>
      </div>
      <form className="form panel__body" onSubmit={onSubmit} noValidate>
        {message && <Alert type={message.type}>{message.text}</Alert>}
        <PasswordField
          label="Current password"
          autoComplete="current-password"
          value={values.currentPassword}
          onChange={update('currentPassword')}
          error={errors.currentPassword}
        />
        <div className="field-group">
          <PasswordField
            label="New password"
            autoComplete="new-password"
            value={values.newPassword}
            onChange={update('newPassword')}
            error={errors.newPassword}
          />
          <ul className="password-rules" aria-label="Password requirements">
            {PASSWORD_RULES.map((rule) => {
              const ok = rule.test(values.newPassword);
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
          autoComplete="new-password"
          value={values.confirm}
          onChange={update('confirm')}
          error={errors.confirm}
        />
        <div className="form-actions">
          <Button type="submit" icon={KeyRound} loading={saving}>
            Change password
          </Button>
        </div>
      </form>
    </section>
  );
}

export default function ProfilePage() {
  useDocumentTitle('Profile');
  const { user, updateUser } = useAuth();
  const profile = useApi((signal) => profileApi.get(signal), []);
  const [pendingEmail, setPendingEmail] = useState(null);

  useEffect(() => {
    if (!profile.data) return;
    setPendingEmail(profile.data.pendingEmail);
    updateUser(profile.data.user);
  }, [profile.data, updateUser]);

  const onSaved = (result) => {
    updateUser(result.user);
    setPendingEmail(result.pendingEmail);
  };

  return (
    <>
      <PageHeader
        eyebrow={user.role === 'admin' ? 'Administrator account' : 'Reader account'}
        title="Profile"
        description={
          user.role === 'admin'
            ? 'Manage your name, email address and password.'
            : 'Manage your name, email address, favourite genres and password.'
        }
      />

      <div className="profile">
        <aside className="profile__card panel panel__body">
          <span className="avatar avatar--lg" aria-hidden="true">
            {initials(user.name)}
          </span>
          <h2 className="profile__name">{user.name}</h2>
          <p className="muted profile__email">{user.email}</p>
          <span className="badge badge--gold">{user.role === 'admin' ? 'Administrator' : 'Reader'}</span>
          <dl className="details-list profile__facts">
            <dt>Member since</dt>
            <dd>{formatDate(user.createdAt)}</dd>
            <dt>Email</dt>
            <dd>{user.isVerified ? 'Verified' : 'Not verified'}</dd>
          </dl>
        </aside>

        <div className="profile__forms">
          {pendingEmail && (
            <Alert type="info" title="Email change waiting for confirmation">
              Open the link we sent to <strong>{pendingEmail}</strong> to start using it. Until then, keep logging in
              with {user.email}.
            </Alert>
          )}
          <DetailsForm user={user} onSaved={onSaved} />
          {user.role === 'user' && (
            <section className="panel" aria-labelledby="genres-title">
              <div className="panel__header">
                <div>
                  <h2 id="genres-title" className="panel__title">
                    Favourite genres
                  </h2>
                  <p className="panel__subtitle">Your recommendations on the dashboard start with these genres.</p>
                </div>
              </div>
              <div className="panel__body">
                <FavouriteGenresForm />
              </div>
            </section>
          )}
          <PasswordForm />
        </div>
      </div>
    </>
  );
}
