import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save } from 'lucide-react';
import Button from '../../components/ui/Button';
import BookCover from '../../components/books/BookCover';
import UploadButton from '../../components/books/UploadButton';
import { SelectField, TextAreaField, TextField } from '../../components/ui/FormFields';
import { BackLink, PageHeader } from '../../components/ui/Display';
import { Alert, ErrorState, LoadingState } from '../../components/ui/States';
import { booksApi, genresApi } from '../../api';
import { useToast } from '../../context/ToastContext';
import { useApi } from '../../hooks/useApi';
import { useDocumentTitle } from '../../hooks/misc';
import { plural } from '../../utils/format';

const EMPTY = { title: '', author: '', genre: '', publicationYear: '', coverImageUrl: '', pdfUrl: '', description: '' };
const DESCRIPTION_MAX = 5000;

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

// Mirrors the backend rules (backend/src/middleware/validators/bookValidators.js).
function validate(values) {
  const errors = {};
  const maxYear = new Date().getFullYear() + 1;
  if (!values.title.trim()) errors.title = 'Title is required.';
  else if (values.title.trim().length > 255) errors.title = 'Title must be 255 characters or fewer.';
  if (!values.author.trim()) errors.author = 'Author is required.';
  else if (values.author.trim().length > 255) errors.author = 'Author must be 255 characters or fewer.';
  if (!values.genre) errors.genre = 'Please choose a genre.';
  if (values.publicationYear !== '') {
    const year = Number(values.publicationYear);
    if (!Number.isInteger(year) || year < 1 || year > maxYear) {
      errors.publicationYear = `Enter a year between 1 and ${maxYear}.`;
    }
  }
  for (const field of ['coverImageUrl', 'pdfUrl']) {
    const value = values[field].trim();
    if (value && !isHttpUrl(value)) errors[field] = 'Enter a full web address starting with http:// or https://.';
  }
  if (values.description.length > DESCRIPTION_MAX) {
    errors.description = `Description must be ${DESCRIPTION_MAX} characters or fewer.`;
  }
  return errors;
}

function toForm(book) {
  return {
    title: book.title ?? '',
    author: book.author ?? '',
    genre: book.genre ?? '',
    publicationYear: book.publicationYear ? String(book.publicationYear) : '',
    coverImageUrl: book.coverImageUrl ?? '',
    pdfUrl: book.pdfUrl ?? '',
    description: book.description ?? '',
  };
}

function toPayload(values) {
  return {
    title: values.title.trim(),
    author: values.author.trim(),
    genre: values.genre,
    publicationYear: values.publicationYear === '' ? null : Number(values.publicationYear),
    coverImageUrl: values.coverImageUrl.trim(),
    pdfUrl: values.pdfUrl.trim(),
    description: values.description.trim(),
  };
}

export default function BookFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  useDocumentTitle(isEdit ? 'Edit book' : 'Add a book');
  const navigate = useNavigate();
  const toast = useToast();

  const existing = useApi((signal) => (isEdit ? booksApi.get(id, signal) : Promise.resolve(null)), [id]);
  const genres = useApi((signal) => genresApi.list(signal), []);

  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (existing.data?.book) setValues(toForm(existing.data.book));
  }, [existing.data]);

  const update = (field) => (event) => {
    setValues((v) => ({ ...v, [field]: event.target.value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = validate(values);
    setErrors(nextErrors);
    setFormError(null);
    if (Object.keys(nextErrors).length) {
      document.getElementById(`book-${Object.keys(nextErrors)[0]}`)?.focus();
      return;
    }
    setSaving(true);
    try {
      const payload = toPayload(values);
      const { book, message, notifiedReaders } = isEdit
        ? await booksApi.update(id, payload)
        : await booksApi.create(payload);
      const notified = notifiedReaders ? ` ${plural(notifiedReaders, 'reader')} notified.` : '';
      toast.success(message + notified, isEdit ? 'Changes saved' : 'Book added');
      navigate(`/admin/books/${book.id}`);
    } catch (error) {
      setSaving(false);
      if (error.errors && Object.keys(error.errors).length) setErrors(error.errors);
      setFormError(error);
    }
  };

  if (isEdit && existing.loading && !existing.data) return <LoadingState label="Loading the book…" />;
  if (isEdit && existing.error) {
    return (
      <>
        <BackLink to="/admin/books">Back to the catalogue</BackLink>
        <ErrorState title="This book could not be loaded" error={existing.error} onRetry={existing.reload} />
      </>
    );
  }

  const preview = {
    title: values.title.trim() || 'Untitled',
    author: values.author.trim() || 'Unknown author',
    coverImageUrl: isHttpUrl(values.coverImageUrl.trim()) ? values.coverImageUrl.trim() : null,
  };
  const backTo = isEdit ? `/admin/books/${id}` : '/admin/books';

  return (
    <>
      <BackLink to={backTo}>{isEdit ? 'Back to the book' : 'Back to the catalogue'}</BackLink>
      <PageHeader
        eyebrow={isEdit ? 'Edit book' : 'New book'}
        title={isEdit ? existing.data.book.title : 'Add a book to the catalogue'}
        description="Title and author are required. Readers can open the book in the reader once it has a PDF."
      />

      <div className="book-form">
        <form className="form panel panel__body" onSubmit={onSubmit} noValidate>
          {formError && !Object.keys(errors).some((k) => errors[k]) && <Alert type="error">{formError.message}</Alert>}

          <div className="form-row">
            <TextField id="book-title" label="Title" value={values.title} onChange={update('title')} error={errors.title} maxLength={255} />
            <TextField id="book-author" label="Author" value={values.author} onChange={update('author')} error={errors.author} maxLength={255} />
          </div>

          <div className="form-row">
            <SelectField
              id="book-genre"
              label="Genre"
              value={values.genre}
              onChange={update('genre')}
              error={errors.genre}
              hint={genres.error ? 'Genres could not be loaded. Refresh the page to try again.' : 'Used for the genre filter and for recommendations.'}
              options={[
                { value: '', label: genres.data ? 'Choose a genre' : 'Loading genres…' },
                ...(genres.data?.genres ?? []).map((g) => ({ value: g.name, label: g.name })),
              ]}
            />
            <TextField
              id="book-publicationYear"
              label="Publication year"
              optional
              inputMode="numeric"
              value={values.publicationYear}
              onChange={(event) => update('publicationYear')({ target: { value: event.target.value.replace(/\D/g, '').slice(0, 4) } })}
              error={errors.publicationYear}
            />
          </div>

          <div className="field-group">
            <TextField
              id="book-coverImageUrl"
              label="Cover image"
              optional
              type="url"
              placeholder="https://…/cover.jpg"
              value={values.coverImageUrl}
              onChange={update('coverImageUrl')}
              error={errors.coverImageUrl}
              hint="Upload an image, or paste a direct link to one. The preview updates as you type."
            />
            <UploadButton
              kind="cover"
              disabled={saving}
              onUploaded={(url) => update('coverImageUrl')({ target: { value: url } })}
            />
          </div>
          <div className="field-group">
            <TextField
              id="book-pdfUrl"
              label="PDF"
              optional
              type="url"
              placeholder="https://…/book.pdf"
              value={values.pdfUrl}
              onChange={update('pdfUrl')}
              error={errors.pdfUrl}
              hint="Upload the PDF, or paste a direct link to one. Readers open it inside BookTracker."
            />
            <UploadButton
              kind="pdf"
              disabled={saving}
              onUploaded={(url) => update('pdfUrl')({ target: { value: url } })}
            />
          </div>
          <TextAreaField
            id="book-description"
            label="Description"
            optional
            rows={7}
            value={values.description}
            onChange={update('description')}
            error={errors.description}
            hint={`${values.description.length} / ${DESCRIPTION_MAX} characters. Leave a blank line between paragraphs.`}
          />

          <div className="form-actions">
            <Button type="submit" icon={Save} loading={saving}>
              {isEdit ? 'Save changes' : 'Add to catalogue'}
            </Button>
            <Button variant="ghost" onClick={() => navigate(backTo)} disabled={saving}>
              Cancel
            </Button>
          </div>
        </form>

        <aside className="book-form__preview" aria-label="Preview">
          <span className="eyebrow">Preview</span>
          <div className="book-form__cover">
            <BookCover book={preview} key={preview.coverImageUrl || 'none'} />
          </div>
          <p className="book-form__preview-title">{preview.title}</p>
          <p className="muted">{preview.author}</p>
          {(values.genre || values.publicationYear) && (
            <p className="book-card__meta">
              {values.genre && <span className="tag">{values.genre}</span>}
              {values.publicationYear && <span className="muted tabular">{values.publicationYear}</span>}
            </p>
          )}
        </aside>
      </div>
    </>
  );
}
