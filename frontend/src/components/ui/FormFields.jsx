import { forwardRef, useId, useState } from 'react';
import { CircleAlert, Eye, EyeOff } from 'lucide-react';

function describedBy(id, hint, error) {
  return [error && `${id}-error`, hint && !error && `${id}-hint`].filter(Boolean).join(' ') || undefined;
}

function Field({ id, label, hint, error, optional, children }) {
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        <span>
          {label}
          {optional && <span className="visually-hidden"> (optional)</span>}
        </span>
        {optional && (
          <span className="field__optional" aria-hidden="true">
            Optional
          </span>
        )}
      </label>
      {children}
      {hint && !error && (
        <p className="field__hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      {error && (
        <p className="field__error" id={`${id}-error`}>
          <CircleAlert aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

function controlProps(id, hint, error) {
  return { id, 'aria-invalid': error ? 'true' : undefined, 'aria-describedby': describedBy(id, hint, error) };
}

export const TextField = forwardRef(function TextField(
  { id, label, hint, error, optional, icon: Icon, className = '', ...rest },
  ref
) {
  const autoId = useId();
  const fieldId = id || autoId;
  return (
    <Field id={fieldId} label={label} hint={hint} error={error} optional={optional}>
      <div className="field__control">
        {Icon && <Icon className="input-icon" aria-hidden="true" />}
        <input
          ref={ref}
          className={`input ${Icon ? 'input--with-icon' : ''} ${className}`}
          {...controlProps(fieldId, hint, error)}
          {...rest}
        />
      </div>
    </Field>
  );
});

export const PasswordField = forwardRef(function PasswordField({ id, label, hint, error, ...rest }, ref) {
  const autoId = useId();
  const fieldId = id || autoId;
  const [visible, setVisible] = useState(false);
  return (
    <Field id={fieldId} label={label} hint={hint} error={error}>
      <div className="field__control">
        <input
          ref={ref}
          type={visible ? 'text' : 'password'}
          className="input input--with-action"
          {...controlProps(fieldId, hint, error)}
          {...rest}
        />
        <button
          type="button"
          className="icon-btn input-action"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
        >
          {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
        </button>
      </div>
    </Field>
  );
});

export function TextAreaField({ id, label, hint, error, optional, ...rest }) {
  const autoId = useId();
  const fieldId = id || autoId;
  return (
    <Field id={fieldId} label={label} hint={hint} error={error} optional={optional}>
      <textarea className="textarea" {...controlProps(fieldId, hint, error)} {...rest} />
    </Field>
  );
}

export function SelectField({ id, label, hint, error, optional, options, ...rest }) {
  const autoId = useId();
  const fieldId = id || autoId;
  return (
    <Field id={fieldId} label={label} hint={hint} error={error} optional={optional}>
      <select className="select" {...controlProps(fieldId, hint, error)} {...rest}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}
