import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDebouncedValue } from './misc';

// Catalogue filters stored in the URL (?search=&category=&sort=&page=), so
// they survive a refresh and work with the back button. The search box is
// debounced: the URL, and therefore the request, updates once typing pauses.
export function useBookQuery() {
  const [params, setParams] = useSearchParams();
  const search = params.get('search') || '';
  const category = params.get('category') || '';
  const sort = params.get('sort') || 'newest';
  const page = Math.max(1, Number(params.get('page')) || 1);

  const [searchInput, setSearchInput] = useState(search);
  const debouncedSearch = useDebouncedValue(searchInput.trim());

  const update = (changes) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
    if (!('page' in changes)) next.delete('page');
    setParams(next, { replace: true });
  };

  const pushedSearch = useRef(search);
  useEffect(() => {
    if (debouncedSearch === search) return;
    pushedSearch.current = debouncedSearch;
    update({ search: debouncedSearch });
    // Only the debounced text triggers this; `update` reads the latest params.
  }, [debouncedSearch]);

  // Follow URL changes made another way (back button, "clear filters").
  useEffect(() => {
    if (search === pushedSearch.current) return;
    pushedSearch.current = search;
    setSearchInput(search);
  }, [search]);

  return {
    search,
    category,
    sort,
    page,
    searchInput,
    setSearchInput,
    setCategory: (value) => update({ category: value }),
    setSort: (value) => update({ sort: value === 'newest' ? '' : value }),
    setPage: (value) => update({ page: value > 1 ? String(value) : '' }),
    clear: () => {
      setSearchInput('');
      setParams({}, { replace: true });
    },
    isFiltered: Boolean(search || category),
  };
}
