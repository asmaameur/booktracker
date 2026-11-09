import { useEffect, useState } from 'react';
import { Check, Heart } from 'lucide-react';
import Button from '../ui/Button';
import { ErrorState, LoadingState } from '../ui/States';
import { genresApi } from '../../api';
import { useToast } from '../../context/ToastContext';
import { useApi } from '../../hooks/useApi';

// Toggle chips: each genre is a checkbox-like button.
export function GenreChips({ genres, selected, onToggle, disabled = false }) {
  return (
    <div className="genre-chips" role="group" aria-label="Genres">
      {genres.map((genre) => {
        const on = selected.includes(genre.name);
        return (
          <button
            key={genre.name}
            type="button"
            className={`genre-chip ${on ? 'is-on' : ''}`}
            aria-pressed={on}
            disabled={disabled}
            onClick={() => onToggle(genre.name)}
          >
            {on ? <Check aria-hidden="true" /> : <Heart aria-hidden="true" />}
            {genre.name}
          </button>
        );
      })}
    </div>
  );
}

// Loads the genres and the reader's favourites, and saves the new selection.
// `onSaved(genres)` runs after a successful save.
export default function FavouriteGenresForm({ onSaved, onCancel, submitLabel = 'Save my genres' }) {
  const toast = useToast();
  const data = useApi(
    async (signal) => {
      const [all, mine] = await Promise.all([genresApi.list(signal), genresApi.preferences(signal)]);
      return { genres: all.genres, preferred: mine.genres };
    },
    []
  );
  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data.data) setSelected(data.data.preferred);
  }, [data.data]);

  if (data.loading && !data.data) return <LoadingState label="Loading genres…" />;
  if (data.error && !data.data) {
    return <ErrorState title="Genres could not be loaded" error={data.error} onRetry={data.reload} />;
  }

  const toggle = (name) =>
    setSelected((current) => (current.includes(name) ? current.filter((g) => g !== name) : [...current, name]));

  const unchanged =
    selected.length === data.data.preferred.length && selected.every((g) => data.data.preferred.includes(g));

  const save = async () => {
    setSaving(true);
    try {
      const result = await genresApi.savePreferences(selected);
      data.setData((d) => ({ ...d, preferred: result.genres }));
      toast.success(result.message);
      onSaved?.(result.genres);
    } catch (error) {
      toast.error(error.errors?.genres || error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="favourite-genres">
      <GenreChips genres={data.data.genres} selected={selected} onToggle={toggle} disabled={saving} />
      <p className="muted favourite-genres__count" aria-live="polite">
        {selected.length ? `${selected.length} selected` : 'No genre selected yet.'}
      </p>
      <div className="form-actions">
        <Button onClick={save} loading={saving} disabled={unchanged}>
          {submitLabel}
        </Button>
        {onCancel && (
          <Button variant="ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
