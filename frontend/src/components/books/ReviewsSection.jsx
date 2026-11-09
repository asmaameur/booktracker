import { useEffect, useState } from 'react';
import { MessageSquare, Pencil, ShieldX, ThumbsUp, Trash2 } from 'lucide-react';
import Button from '../ui/Button';
import Modal, { ConfirmDialog } from '../ui/Modal';
import { TextAreaField } from '../ui/FormFields';
import { ErrorState, LoadingState } from '../ui/States';
import Avatar from '../ui/Avatar';
import { RatingSummary, StarInput, Stars } from './Rating';
import { reviewsApi } from '../../api';
import { useToast } from '../../context/ToastContext';
import { useApi } from '../../hooks/useApi';
import { formatRelative, plural } from '../../utils/format';

const COMMENT_MAX = 2000;

function Distribution({ summary }) {
  if (!summary.ratingCount) return null;
  return (
    <ul className="rating-bars" aria-label="Ratings by number of stars">
      {[5, 4, 3, 2, 1].map((stars) => {
        const count = summary.distribution[stars] || 0;
        const percent = Math.round((count / summary.ratingCount) * 100);
        return (
          <li key={stars} className="rating-bars__row">
            <span className="tabular">{stars}★</span>
            <span className="rating-bars__track" aria-hidden="true">
              <span className="rating-bars__fill" style={{ width: `${percent}%` }} />
            </span>
            <span className="tabular muted">
              <span className="visually-hidden">{plural(stars, 'star')}: </span>
              {count}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function ReviewForm({ bookId, existing, onSaved, onCancel }) {
  const toast = useToast();
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [comment, setComment] = useState(existing?.comment ?? '');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const onSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = {};
    if (!rating) nextErrors.rating = 'Please choose a rating from 1 to 5 stars.';
    if (comment.trim().length > COMMENT_MAX) nextErrors.comment = `Your comment must be ${COMMENT_MAX} characters or fewer.`;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSaving(true);
    try {
      const payload = { rating, comment: comment.trim() };
      const result = existing
        ? await reviewsApi.update(existing.id, payload)
        : await reviewsApi.create(bookId, payload);
      toast.success(result.message);
      onSaved(result);
    } catch (error) {
      if (error.errors && Object.keys(error.errors).length) setErrors(error.errors);
      else toast.error(error.message);
      setSaving(false);
    }
  };

  return (
    <form className="review-form form" onSubmit={onSubmit} noValidate>
      <div className="field">
        <span className="field__label" id="review-rating-label">
          Your rating
        </span>
        <StarInput
          id="review-rating"
          value={rating}
          onChange={(value) => {
            setRating(value);
            setErrors((e) => ({ ...e, rating: undefined }));
          }}
          disabled={saving}
          invalid={Boolean(errors.rating)}
        />
        {errors.rating && <p className="field__error">{errors.rating}</p>}
      </div>
      <TextAreaField
        id="review-comment"
        label="Your comment"
        optional
        rows={4}
        value={comment}
        onChange={(event) => {
          setComment(event.target.value);
          setErrors((e) => ({ ...e, comment: undefined }));
        }}
        error={errors.comment}
        hint={`${comment.length} / ${COMMENT_MAX} characters`}
        placeholder="What did you think of this book?"
      />
      <div className="form-actions">
        <Button type="submit" loading={saving}>
          {existing ? 'Save my review' : 'Publish my review'}
        </Button>
        {onCancel && (
          <Button variant="ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

function ReviewItem({ review, mine, onEdit, onDelete, onModerate, onHelpful, voting }) {
  return (
    <li className={`review ${mine ? 'review--mine' : ''}`}>
      <Avatar name={review.userName} url={review.userAvatarUrl} />
      <div className="review__body">
        <div className="review__head">
          <strong className="review__name">{mine ? 'You' : review.userName}</strong>
          <span role="img" aria-label={`${plural(review.rating, 'star')} out of 5`}>
            <Stars value={review.rating} size="sm" />
          </span>
          <span className="muted review__date">
            {formatRelative(review.updatedAt)}
            {review.updatedAt !== review.createdAt && ' (edited)'}
          </span>
        </div>
        {review.comment && <p className="review__comment">{review.comment}</p>}
        {onHelpful ? (
          <div className="review__actions">
            <Button
              variant={review.votedByMe ? 'secondary' : 'ghost'}
              size="sm"
              icon={ThumbsUp}
              onClick={onHelpful}
              loading={voting}
              aria-pressed={review.votedByMe}
            >
              Helpful{review.helpfulCount ? ` (${review.helpfulCount})` : ''}
            </Button>
          </div>
        ) : (
          review.helpfulCount > 0 && (
            <p className="muted review__helpful">
              <ThumbsUp aria-hidden="true" />
              {plural(review.helpfulCount, 'reader')} found this helpful
            </p>
          )
        )}
        {onModerate && (
          <div className="review__actions">
            <Button variant="danger-ghost" size="sm" icon={ShieldX} onClick={onModerate}>
              Remove review
            </Button>
          </div>
        )}
        {mine && (
          <div className="review__actions">
            <Button variant="ghost" size="sm" icon={Pencil} onClick={onEdit}>
              Edit
            </Button>
            <Button variant="danger-ghost" size="sm" icon={Trash2} onClick={onDelete}>
              Delete
            </Button>
          </div>
        )}
      </div>
    </li>
  );
}

const REASON_MAX = 500;

// Admins only: removes someone's review. The optional reason is sent to the
// author in their notifications.
function ModerateDialog({ review, onClose, onRemoved }) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [error, setError] = useState(null);
  const [removing, setRemoving] = useState(false);

  const remove = async () => {
    if (reason.trim().length > REASON_MAX) {
      setError(`The reason must be ${REASON_MAX} characters or fewer.`);
      return;
    }
    setRemoving(true);
    try {
      const { summary, message } = await reviewsApi.remove(review.id, reason.trim());
      toast.success(message);
      onRemoved(summary);
    } catch (err) {
      setRemoving(false);
      if (err.errors?.reason) setError(err.errors.reason);
      else toast.error(err.message);
    }
  };

  return (
    <Modal
      open
      title="Remove this review?"
      onClose={removing ? () => {} : onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={removing}>
            Cancel
          </Button>
          <Button variant="danger" onClick={remove} loading={removing}>
            Remove review
          </Button>
        </>
      }
    >
      <p>
        {review.userName}'s {plural(review.rating, 'star')} review will be deleted and no longer count in the book's
        rating. They will get a notification.
      </p>
      {review.comment && <blockquote className="review__quoted">{review.comment}</blockquote>}
      <TextAreaField
        id="moderation-reason"
        label="Reason sent to the reader"
        optional
        rows={3}
        value={reason}
        onChange={(event) => {
          setReason(event.target.value);
          setError(null);
        }}
        error={error}
        hint={`${reason.length} / ${REASON_MAX} characters`}
        placeholder="For example: Reviews must be about the book."
      />
    </Modal>
  );
}

const PAGE_SIZE = 10;
const REVIEW_SORTS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'helpful', label: 'Most helpful' },
  { value: 'highest', label: 'Highest rating' },
  { value: 'lowest', label: 'Lowest rating' },
];

// Rating summary, the reader's own review form, and the other readers'
// reviews (sorted, ten at a time). `canReview` is true for readers, who can
// also mark reviews as helpful; `canModerate` (admins) adds a "Remove review"
// button. `onSummaryChange` lets the page update the rating in its header.
export default function ReviewsSection({ bookId, canReview = false, canModerate = false, onSummaryChange }) {
  const toast = useToast();
  const [sort, setSort] = useState('newest');
  const reviews = useApi(
    (signal) => reviewsApi.list(bookId, { sort, limit: PAGE_SIZE }, signal),
    [bookId, sort]
  );
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [moderating, setModerating] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [voting, setVoting] = useState(null);

  const summary = reviews.data?.summary;
  useEffect(() => {
    if (summary) onSummaryChange?.(summary);
  }, [summary]);

  if (reviews.loading && !reviews.data) return <LoadingState label="Loading reviews…" />;
  if (reviews.error && !reviews.data) {
    return <ErrorState title="Reviews could not be loaded" error={reviews.error} onRetry={reviews.reload} />;
  }

  // `items` never contains the reader's own review: it is shown separately.
  const { reviews: items, myReview, pagination } = reviews.data;
  const remaining = pagination.total - items.length;

  const onSaved = ({ review, summary: nextSummary }) => {
    setEditing(false);
    reviews.setData((data) => ({ ...data, summary: nextSummary, myReview: review }));
  };

  const remove = async () => {
    setDeleting(true);
    try {
      const { summary: nextSummary, message } = await reviewsApi.remove(myReview.id);
      reviews.setData((data) => ({ ...data, summary: nextSummary, myReview: null }));
      setConfirmDelete(false);
      toast.success(message);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setDeleting(false);
    }
  };

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const next = await reviewsApi.list(bookId, { sort, limit: PAGE_SIZE, page: pagination.page + 1 });
      reviews.setData((data) => ({
        ...data,
        reviews: [...data.reviews, ...next.reviews.filter((r) => !data.reviews.some((known) => known.id === r.id))],
        pagination: next.pagination,
      }));
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoadingMore(false);
    }
  };

  const toggleHelpful = async (review) => {
    setVoting(review.id);
    try {
      const result = review.votedByMe
        ? await reviewsApi.unmarkHelpful(review.id)
        : await reviewsApi.markHelpful(review.id);
      reviews.setData((data) => ({
        ...data,
        reviews: data.reviews.map((r) => (r.id === review.id ? { ...r, ...result } : r)),
      }));
    } catch (error) {
      toast.error(error.message);
    } finally {
      setVoting(null);
    }
  };

  const nothingYet = !myReview && pagination.total === 0;

  return (
    <section className="book-detail__section reviews" aria-labelledby="reviews-title">
      <h2 id="reviews-title" className="book-detail__section-title">
        Ratings &amp; reviews
      </h2>

      <div className="reviews__overview panel panel__body">
        <div className="reviews__score">
          <span className="reviews__average tabular">{summary.ratingCount ? summary.averageRating.toFixed(1) : '–'}</span>
          <RatingSummary averageRating={summary.averageRating} ratingCount={summary.ratingCount} />
        </div>
        <Distribution summary={summary} />
      </div>

      {canReview && (!myReview || editing) && (
        <div className="panel panel__body reviews__mine">
          <h3 className="reviews__subtitle">{myReview ? 'Edit your review' : 'Rate this book'}</h3>
          <ReviewForm
            key={myReview?.id ?? 'new'}
            bookId={bookId}
            existing={myReview}
            onSaved={onSaved}
            onCancel={myReview ? () => setEditing(false) : undefined}
          />
        </div>
      )}

      {pagination.total > 1 && (
        <div className="reviews__toolbar">
          <label htmlFor="reviews-sort" className="reviews__sort-label">
            Sort reviews
          </label>
          <select id="reviews-sort" className="select" value={sort} onChange={(event) => setSort(event.target.value)}>
            {REVIEW_SORTS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {nothingYet ? (
        <p className="muted reviews__empty">
          <MessageSquare aria-hidden="true" />
          {canReview ? 'No reviews yet. Be the first to share your opinion.' : 'No reader has reviewed this book yet.'}
        </p>
      ) : (
        <ul className={`reviews__list ${reviews.loading ? 'is-refreshing' : ''}`} aria-busy={reviews.loading}>
          {myReview && !editing && (
            <ReviewItem review={myReview} mine onEdit={() => setEditing(true)} onDelete={() => setConfirmDelete(true)} />
          )}
          {items.map((review) => (
            <ReviewItem
              key={review.id}
              review={review}
              onModerate={canModerate ? () => setModerating(review) : undefined}
              onHelpful={canReview ? () => toggleHelpful(review) : undefined}
              voting={voting === review.id}
            />
          ))}
        </ul>
      )}

      {remaining > 0 && (
        <Button variant="secondary" onClick={loadMore} loading={loadingMore} className="reviews__more">
          Show {Math.min(remaining, PAGE_SIZE)} more of {remaining}
        </Button>
      )}

      {moderating && (
        <ModerateDialog
          review={moderating}
          onClose={() => setModerating(null)}
          onRemoved={(nextSummary) => {
            reviews.setData((data) => ({
              ...data,
              summary: nextSummary,
              reviews: data.reviews.filter((r) => r.id !== moderating.id),
              pagination: { ...data.pagination, total: data.pagination.total - 1 },
            }));
            setModerating(null);
          }}
        />
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete your review?"
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      >
        Your rating and comment will be removed from this book. You can write a new review at any time.
      </ConfirmDialog>
    </section>
  );
}
