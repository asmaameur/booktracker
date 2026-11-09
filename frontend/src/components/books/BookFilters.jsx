import { Search } from 'lucide-react';
import { BOOK_SORTS } from '../../utils/format';

export default function BookFilters({
  search,
  onSearchChange,
  genre,
  onGenreChange,
  genres,
  sort,
  onSortChange,
}) {
  return (
    <div className="filters" role="search">
      <div className="filters__search field__control">
        <label htmlFor="book-search" className="visually-hidden">
          Search by title or author
        </label>
        <Search className="input-icon" aria-hidden="true" />
        <input
          id="book-search"
          type="search"
          className="input input--with-icon"
          placeholder="Search by title or author"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          autoComplete="off"
        />
      </div>
      {genres && (
        <div>
          <label htmlFor="book-genre" className="visually-hidden">
            Genre
          </label>
          <select id="book-genre" className="select" value={genre} onChange={(event) => onGenreChange(event.target.value)}>
            <option value="">All genres</option>
            {genres.map((g) => (
              <option key={g.name} value={g.name}>
                {g.name} ({g.count})
              </option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label htmlFor="book-sort" className="visually-hidden">
          Sort by
        </label>
        <select id="book-sort" className="select" value={sort} onChange={(event) => onSortChange(event.target.value)}>
          {BOOK_SORTS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
