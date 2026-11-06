import { Search } from 'lucide-react';
import { BOOK_SORTS } from '../../utils/format';

export default function BookFilters({ search, onSearchChange, category, onCategoryChange, categories, sort, onSortChange }) {
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
      <div>
        <label htmlFor="book-category" className="visually-hidden">
          Category
        </label>
        <select
          id="book-category"
          className="select"
          value={category}
          onChange={(event) => onCategoryChange(event.target.value)}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name} ({c.count})
            </option>
          ))}
        </select>
      </div>
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
