import { useEffect, useRef, useState } from 'react';
import { Cake, Camera, Check, KeyRound, Mail, Save, Trash2, UserRound } from 'lucide-react';
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
import { formatDate, plural } from '../../utils/format';
import Avatar from '../../components/ui/Avatar';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PASSWORD_RULES = [
  { id: 'length', label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { id: 'letter', label: 'At least one letter', test: (p) => /[A-Za-z]/.test(p) },
  { id: 'number', label: 'At least one number', test: (p) => /\d/.test(p) },
];

// Today as 'YYYY-MM-DD' in local time (for the date picker's maximum).
function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Full years since a 'YYYY-MM-DD' date (same rule as the server).
function ageFrom(birthDate) {
  const [year, month, day] = birthDate.split('-').map(Number);
  const today = new Date();
  let age = today.getFullYear() - year;
  if (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day)) age -= 1;
  return age;
}

// Mirrors backend/src/middleware/validators/authValidators.js (5 to 120 years).
function birthDateProblem(value) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Please enter a valid date of birth.';
  const age = ageFrom(value);
  if (Number.isNaN(age) || age < 5 || age > 120) return 'Your age must be between 5 and 120 years.';
  return null;
}

// The profile picture on the profile card: upload a new one or remove it.
function AvatarPicker({ user, onSaved }) {
  const toast = useToast();
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(null);

  const onFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Please choose a JPG, PNG or WebP image.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('This image is too large. The limit is 2 MB.');
      return;
    }
    setBusy('upload');
    try {
      const result = await profileApi.uploadAvatar(file);
      onSaved(result);
      toast.success(result.message, 'Profile');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    setBusy('remove');
    try {
      const result = await profileApi.removeAvatar();
      onSaved(result);
      toast.success(result.message, 'Profile');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="avatar-picker">
      <Avatar name={user.name} url={user.avatarUrl} size="lg" />
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="visually-hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={onFile}
      />
      <div className="avatar-picker__actions">
        <Button
          variant="secondary"
          size="sm"
          icon={Camera}
          loading={busy === 'upload'}
          disabled={Boolean(busy)}
          onClick={() => inputRef.current?.click()}
        >
          {user.avatarUrl ? 'Change photo' : 'Add a photo'}
        </Button>
        {user.avatarUrl && (
          <Button variant="danger-ghost" size="sm" icon={Trash2} loading={busy === 'remove'} disabled={Boolean(busy)} onClick={remove}>
            Remove
          </Button>
        )}
      </div>
      <p className="avatar-picker__hint">JPG, PNG or WebP, up to 2 MB.</p>
    </div>
  );
}

function DetailsForm({ user, onSaved }) {
  const toast = useToast();
  const [values, setValues] = useState({
    name: user.name,
    email: user.email,
    birthDate: user.birthDate || '',
    currentPassword: '',
  });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValues((v) => ({ ...v, name: user.name, email: user.email, birthDate: user.birthDate || '' }));
  }, [user.name, user.email, user.birthDate]);

  const emailChanged = values.email.trim().toLowerCase() !== user.email;
  const nameChanged = values.name.trim() !== user.name;
  const birthDateChanged = values.birthDate !== (user.birthDate || '');

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
    const birthProblem = birthDateProblem(values.birthDate);
    if (birthProblem) nextErrors.birthDate = birthProblem;
    if (emailChanged && !values.currentPassword) {
      nextErrors.currentPassword = 'Enter your current password to change your email address.';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    if (!nameChanged && !emailChanged && !birthDateChanged) {
      setMessage({ type: 'info', text: 'Nothing to save: your details are unchanged.' });
      return;
    }

    setSaving(true);
    try {
      const payload = {};
      if (nameChanged) payload.name = name;
      if (birthDateChanged) payload.birthDate = values.birthDate || null;
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
        <TextField
          label="Date of birth"
          type="date"
          icon={Cake}
          optional
          autoComplete="bday"
          min="1900-01-01"
          max={todayIso()}
          value={values.birthDate}
          onChange={update('birthDate')}
          error={errors.birthDate}
          hint={
            values.birthDate && !birthDateProblem(values.birthDate)
              ? `You are ${plural(ageFrom(values.birthDate), 'year')} old. Only you can see this.`
              : 'Only you can see your date of birth and age. Clear the field to remove it.'
          }
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
            ? 'Manage your photo, name, email address and password.'
            : 'Manage your photo, name, date of birth, favourite genres and password.'
        }
      />

      <div className="profile">
        <aside className="profile__card panel panel__body">
          <AvatarPicker user={user} onSaved={onSaved} />
          <h2 className="profile__name">{user.name}</h2>
          <p className="muted profile__email">{user.email}</p>
          <span className="badge badge--gold">{user.role === 'admin' ? 'Administrator' : 'Reader'}</span>
          <dl className="details-list profile__facts">
            <dt>Member since</dt>
            <dd>{formatDate(user.createdAt)}</dd>
            {user.age != null && (
              <>
                <dt>Age</dt>
                <dd>{plural(user.age, 'year')}</dd>
              </>
            )}
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
