import { useMemo, useState } from 'react';
import { Plus, SearchX } from 'lucide-react';
import Button from '../../components/ui/Button';
import BookCard from '../../components/books/BookCard';
import BookFilters from '../../components/books/BookFilters';
import { PageHeader, Pagination } from '../../components/ui/Display';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';
import { booksApi, libraryApi } from '../../api';
import { useToast } from '../../context/ToastContext';
import { useApi } from '../../hooks/useApi';
import { useBookQuery } from '../../hooks/useBookQuery';
import { useDocumentTitle } from '../../hooks/misc';
import { plural } from '../../utils/format';

const PAGE_SIZE = 12;

export default function CataloguePage() {
  useDocumentTitle('Catalogue');
  const toast = useToast();
  const query = useBookQuery();
  const { search, category, sort, page } = query;
  const [adding, setAdding] = useState(null);

  const categories = useApi((signal) => booksApi.categories(signal), []);
  const books = useApi(
    (signal) => booksApi.list({ search, category, sort, page, limit: PAGE_SIZE }, signal),
    [search, category, sort, page]
  );
  const library = useApi((signal) => libraryApi.list(undefined, signal), []);

  const statusByBook = useMemo(
    () => new Map((library.data?.items ?? []).map((item) => [item.bookId, item.readingStatus])),
    [library.data]
  );

  const addToLibrary = async (book) => {
    setAdding(book.id);
    try {
      const { entry, message } = await libraryApi.add(book.id);
      library.setData((data) => (data ? { ...data, items: [entry, ...data.items] } : data));
      toast.success(message, book.title);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setAdding(null);
    }
  };

  const total = books.data?.pagination.total ?? 0;

  return (
    <>
      <PageHeader
        eyebrow="The collection"
        title="Catalogue"
        description="Every book available in BookTracker. Search, filter by category, and add what tempts you to your library."
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
          text={query.isFiltered ? 'Try another title, author or category.' : 'Books added by the librarian will appear here.'}
        >
          {query.isFiltered && (
            <Button variant="secondary" onClick={query.clear}>
              Clear filters
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
          <div className="book-grid">
            {books.data.books.map((book) => {
              const status = statusByBook.get(book.id);
              return (
                <BookCard key={book.id} book={book} to={`/app/books/${book.id}`} status={status}>
                  {!status && library.data && (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={Plus}
                      className="book-card__add"
                      loading={adding === book.id}
                      onClick={() => addToLibrary(book)}
                      aria-label={`Add ${book.title} to my library`}
                    >
                      Add to library
                    </Button>
                  )}
                </BookCard>
              );
            })}
          </div>
          <Pagination
            page={books.data.pagination.page}
            totalPages={books.data.pagination.totalPages}
            onChange={query.setPage}
          />
        </div>
      )}
    </>
  );
}
