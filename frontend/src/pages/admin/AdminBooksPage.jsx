import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BookPlus, Eye, Pencil, SearchX, Trash2 } from 'lucide-react';
import Button from '../../components/ui/Button';
import BookCover from '../../components/books/BookCover';
import BookFilters from '../../components/books/BookFilters';
import DeleteBookDialog from '../../components/books/DeleteBookDialog';
import { PageHeader, Pagination } from '../../components/ui/Display';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';
import { booksApi } from '../../api';
import { useApi } from '../../hooks/useApi';
import { useBookQuery } from '../../hooks/useBookQuery';
import { useDocumentTitle } from '../../hooks/misc';
import { formatShortDate, plural } from '../../utils/format';

const PAGE_SIZE = 10;

export default function AdminBooksPage() {
  useDocumentTitle('Manage the catalogue');
  const query = useBookQuery();
  const { search, category, sort, page } = query;
  const [toDelete, setToDelete] = useState(null);

  const categories = useApi((signal) => booksApi.categories(signal), []);
  const books = useApi(
    (signal) => booksApi.list({ search, category, sort, page, limit: PAGE_SIZE }, signal),
    [search, category, sort, page]
  );

  const onDeleted = () => {
    setToDelete(null);
    const lastOnPage = books.data?.books.length === 1;
    if (lastOnPage && page > 1) query.setPage(page - 1);
    else books.reload();
    categories.reload();
  };

  const total = books.data?.pagination.total ?? 0;

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Catalogue"
        description="Add, edit and remove the books readers can find in BookTracker."
        actions={
          <Button as={Link} to="/admin/books/new" icon={BookPlus}>
            Add a book
          </Button>
        }
      />

      <BookFilters
        search={query.searchInput}
        onSearchChange={query.setSearchInput}
        category={category}
        onCategoryChange={query.setCategory}
        categories={categories.data?.categories ?? []}
        sort={sort}
        onSortChange={query.setSort}
      />

      {books.loading && !books.data ? (
        <LoadingState label="Fetching books…" />
      ) : books.error && !books.data ? (
        <ErrorState title="The catalogue could not be loaded" error={books.error} onRetry={books.reload} />
      ) : total === 0 ? (
        <EmptyState
          icon={SearchX}
          title={query.isFiltered ? 'No books match your search' : 'The catalogue is empty'}
          text={query.isFiltered ? 'Try another title, author or category.' : 'Add the first book to open the library.'}
        >
          {query.isFiltered ? (
            <Button variant="secondary" onClick={query.clear}>
              Clear filters
            </Button>
          ) : (
            <Button as={Link} to="/admin/books/new" icon={BookPlus}>
              Add a book
            </Button>
          )}
        </EmptyState>
      ) : (
        <div className={books.loading ? 'is-refreshing' : ''} aria-busy={books.loading}>
          <p className="results-summary" aria-live="polite">
            {plural(total, 'book')}
            {search && ` matching “${search}”`}
            {category && ` in ${category}`}
          </p>
          <div className="panel">
            <table className="table book-table">
              <thead>
                <tr>
                  <th scope="col">Book</th>
                  <th scope="col">Category</th>
                  <th scope="col" className="num">
                    Year
                  </th>
                  <th scope="col">PDF</th>
                  <th scope="col">Updated</th>
                  <th scope="col">
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {books.data.books.map((book) => (
                  <tr key={book.id}>
                    <td className="book-table__book">
                      <span className="book-table__cover">
                        <BookCover book={book} />
                      </span>
                      <span className="book-table__text">
                        <Link to={`/admin/books/${book.id}`} className="book-table__title">
                          {book.title}
                        </Link>
                        <span className="book-table__author">{book.author}</span>
                      </span>
                    </td>
                    <td data-label="Category">{book.category || <span className="muted">None</span>}</td>
                    <td data-label="Year" className="num">
                      {book.publicationYear ?? <span className="muted">Unknown</span>}
                    </td>
                    <td data-label="PDF">
                      <span className={`badge ${book.hasPdf ? 'badge--gold' : 'badge--muted'}`}>
                        {book.hasPdf ? 'Available' : 'Missing'}
                      </span>
                    </td>
                    <td data-label="Updated" className="tabular">
                      {formatShortDate(book.updatedAt)}
                    </td>
                    <td className="book-table__actions">
                      <Button
                        as={Link}
                        to={`/admin/books/${book.id}`}
                        variant="ghost"
                        size="sm"
                        icon={Eye}
                        aria-label={`View ${book.title}`}
                        title="View"
                      />
                      <Button
                        as={Link}
                        to={`/admin/books/${book.id}/edit`}
                        variant="ghost"
                        size="sm"
                        icon={Pencil}
                        aria-label={`Edit ${book.title}`}
                        title="Edit"
                      />
                      <Button
                        variant="danger-ghost"
                        size="sm"
                        icon={Trash2}
                        onClick={() => setToDelete(book)}
                        aria-label={`Delete ${book.title}`}
                        title="Delete"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={books.data.pagination.page}
            totalPages={books.data.pagination.totalPages}
            onChange={query.setPage}
          />
        </div>
      )}

      <DeleteBookDialog book={toDelete} onClose={() => setToDelete(null)} onDeleted={onDeleted} />
    </>
  );
}
