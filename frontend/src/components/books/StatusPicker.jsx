import { useRef } from 'react';
import { READING_STATUSES } from '../../utils/format';

// A radio group styled as a segmented control. Arrow keys move between options.
export default function StatusPicker({ value, onChange, disabled = false, label = 'Reading status' }) {
  const refs = useRef([]);

  const onKeyDown = (event, index) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const next = (index + step + READING_STATUSES.length) % READING_STATUSES.length;
    refs.current[next]?.focus();
    onChange(READING_STATUSES[next].value);
  };

  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {READING_STATUSES.map((status, index) => {
        const checked = status.value === value;
        return (
          <button
            key={status.value}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked || (!value && index === 0) ? 0 : -1}
            className={`segmented__option badge--${status.value}`}
            disabled={disabled}
            onClick={() => !checked && onChange(status.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            <span className="badge__dot" aria-hidden="true" />
            {status.label}
          </button>
        );
      })}
    </div>
  );
}
