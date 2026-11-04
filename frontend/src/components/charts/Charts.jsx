import { formatNumber } from '../../utils/format';

function share(value, total) {
  return total ? Math.round((value / total) * 100) : 0;
}

// One whole split into a few parts: a thin bar for the proportions, with the
// list beneath giving each part's name, amount and share in text.
export function SegmentedBar({ parts, label }) {
  const total = parts.reduce((sum, part) => sum + part.value, 0);
  const description = parts.map((p) => `${p.label}: ${formatNumber(p.value)} (${share(p.value, total)}%)`).join(', ');

  return (
    <div className="segbar">
      <div className="segbar__bar" role="img" aria-label={`${label}. ${total ? description : 'No data yet'}`}>
        {total === 0 ? (
          <span className="segbar__empty" />
        ) : (
          parts
            .filter((part) => part.value > 0)
            .map((part) => (
              <span
                key={part.key}
                className="segbar__segment"
                style={{ flexGrow: part.value, background: part.color }}
                title={`${part.label}: ${formatNumber(part.value)} (${share(part.value, total)}%)`}
              />
            ))
        )}
      </div>
      <ul className="segbar__legend">
        {parts.map((part) => (
          <li key={part.key} className="segbar__item">
            <span className="segbar__swatch" style={{ background: part.color }} aria-hidden="true" />
            <span className="segbar__name">{part.label}</span>
            <span className="segbar__value">{formatNumber(part.value)}</span>
            <span className="segbar__share tabular">{share(part.value, total)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Ranked horizontal bars, largest first, one colour. Built as a table so
// every value is readable without hovering and by screen readers.
export function RankedBars({ rows, caption, labelHeader, valueHeader }) {
  const sorted = [...rows].sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
  const max = Math.max(1, ...sorted.map((row) => row.value));

  return (
    <table className="ranked">
      <caption className="visually-hidden">{caption}</caption>
      <thead className="visually-hidden">
        <tr>
          <th scope="col">{labelHeader}</th>
          <th scope="col">{valueHeader}</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((row) => (
          <tr key={row.label} className="ranked__row" title={`${row.label}: ${formatNumber(row.value)}`}>
            <th scope="row" className="ranked__label">
              {row.label}
            </th>
            <td className="ranked__cell">
              <span className="ranked__bar" style={{ width: `${(row.value / max) * 100}%` }} aria-hidden="true" />
              <span className="ranked__value tabular">{formatNumber(row.value)}</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
