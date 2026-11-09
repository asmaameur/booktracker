import { useState } from 'react';
import { Target, Trophy } from 'lucide-react';
import Button from '../ui/Button';
import { ProgressMeter } from '../ui/Display';
import { TextField } from '../ui/FormFields';
import { statsApi } from '../../api';
import { useToast } from '../../context/ToastContext';
import { plural } from '../../utils/format';

// The reader's yearly goal: progress, and a small form to set, change or
// remove it. `onChange(stats)` receives the refreshed statistics.
export default function ReadingGoal({ stats, onChange }) {
  const toast = useToast();
  const { goal, year, finishedThisYear } = stats;
  const [editing, setEditing] = useState(false);
  const [target, setTarget] = useState(goal ? String(goal.target) : '12');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);

  const save = async (event) => {
    event.preventDefault();
    const value = Number(target);
    if (!Number.isInteger(value) || value < 1 || value > 1000) {
      setError('Choose a whole number of books between 1 and 1000.');
      return;
    }
    setBusy('save');
    try {
      const result = await statsApi.setGoal(value);
      onChange(result.stats);
      toast.success(result.message);
      setEditing(false);
    } catch (err) {
      setError(err.errors?.target || err.message);
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    setBusy('remove');
    try {
      const result = await statsApi.deleteGoal();
      onChange(result.stats);
      toast.success(result.message);
      setEditing(false);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(null);
    }
  };

  const form = (
    <form className="goal__form" onSubmit={save} noValidate>
      <TextField
        id="goal-target"
        label={`Books to finish in ${year}`}
        inputMode="numeric"
        value={target}
        onChange={(event) => {
          setTarget(event.target.value.replace(/\D/g, '').slice(0, 4));
          setError(null);
        }}
        error={error}
      />
      <div className="goal__actions">
        <Button type="submit" size="sm" loading={busy === 'save'}>
          Save goal
        </Button>
        {goal && (
          <Button variant="danger-ghost" size="sm" onClick={remove} loading={busy === 'remove'}>
            Remove goal
          </Button>
        )}
        {(goal || editing) && (
          <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={Boolean(busy)}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );

  if (!goal) {
    return (
      <section className="panel panel__body goal" aria-labelledby="goal-title">
        <div className="goal__head">
          <span className="goal__icon" aria-hidden="true">
            <Target />
          </span>
          <div>
            <h2 id="goal-title" className="panel__title">
              Set a reading goal for {year}
            </h2>
            <p className="muted">
              {finishedThisYear
                ? `You have finished ${plural(finishedThisYear, 'book')} this year. How many do you want to read?`
                : 'How many books do you want to finish this year?'}
            </p>
          </div>
        </div>
        {form}
      </section>
    );
  }

  const done = goal.finished >= goal.target;
  return (
    <section className="panel panel__body goal" aria-labelledby="goal-title">
      <div className="goal__head">
        <span className="goal__icon" aria-hidden="true">
          {done ? <Trophy /> : <Target />}
        </span>
        <div>
          <h2 id="goal-title" className="panel__title">
            {done ? `Goal reached for ${year}!` : `Your ${year} reading goal`}
          </h2>
          <p className="muted">
            {goal.finished} of {plural(goal.target, 'book')} finished
            {!done && ` · ${plural(goal.target - goal.finished, 'book')} to go`}
          </p>
        </div>
        {!editing && (
          <button
            type="button"
            className="text-link goal__edit"
            onClick={() => {
              setTarget(String(goal.target));
              setEditing(true);
            }}
          >
            Change
          </button>
        )}
      </div>
      <ProgressMeter
        percent={goal.percent}
        status={done ? 'read' : undefined}
        label={`${goal.finished} / ${goal.target} books`}
      />
      {editing && form}
    </section>
  );
}
