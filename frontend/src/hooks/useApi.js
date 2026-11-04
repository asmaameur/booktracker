import { useCallback, useEffect, useRef, useState } from 'react';

// Runs `fetcher(signal)` whenever `deps` change and tracks its state.
// While a refetch runs, the previous `data` stays available so pages can keep
// their layout (shown dimmed) instead of flashing a loader.
export function useApi(fetcher, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const [reloadKey, setReloadKey] = useState(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    const controller = new AbortController();
    setState((current) => ({ ...current, loading: true, error: null }));
    fetcherRef
      .current(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState({ data, error: null, loading: false });
      })
      .catch((error) => {
        if (error.name === 'AbortError' || controller.signal.aborted) return;
        setState((current) => ({ data: current.data, error, loading: false }));
      });
    return () => controller.abort();
    // The caller decides when to refetch through `deps`; `fetcher` itself is
    // read from a ref so a new function on every render doesn't refetch.
  }, [...deps, reloadKey]);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);
  const setData = useCallback((updater) => {
    setState((current) => ({
      ...current,
      data: typeof updater === 'function' ? updater(current.data) : updater,
    }));
  }, []);

  return { ...state, reload, setData };
}
