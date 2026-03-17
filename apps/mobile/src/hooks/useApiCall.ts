import { useCallback, useRef, useState } from 'react';

/** Generic API response shape matching api.ts */
type ApiResult<T> = {
  success: boolean;
  data?: T;
  error?: { code?: string; message?: string };
};

/**
 * Reusable hook to wrap any API call with loading / error / data state.
 *
 * Usage:
 *   const { data, loading, error, execute } = useApiCall(api.getExperiences);
 *   useEffect(() => { execute(1, 20); }, []);
 */
export function useApiCall<TData, TArgs extends any[]>(
  apiFunction: (...args: TArgs) => Promise<ApiResult<TData>>,
) {
  const [data, setData] = useState<TData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const execute = useCallback(
    async (...args: TArgs): Promise<TData | null> => {
      setLoading(true);
      setError(null);

      const result = await apiFunction(...args);

      if (!mountedRef.current) return null;

      if (result.success && result.data !== undefined) {
        setData(result.data as TData);
        setLoading(false);
        return result.data as TData;
      }

      setError(result.error?.message || 'Đã có lỗi xảy ra');
      setLoading(false);
      return null;
    },
    [apiFunction],
  );

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return { data, loading, error, execute, reset };
}

/**
 * Hook for paginated API calls with load-more support.
 *
 * Usage:
 *   const { items, loading, hasMore, loadMore, refresh } = usePaginatedApi(
 *     (page, perPage) => api.getExperiences(page, perPage),
 *     20,
 *   );
 */
export function usePaginatedApi<TItem>(
  apiFunction: (page: number, perPage: number) => Promise<ApiResult<TItem[]>>,
  perPage = 20,
) {
  const [items, setItems] = useState<TItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pageRef = useRef(1);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);

    const result = await apiFunction(pageRef.current, perPage);

    if (result.success && result.data) {
      const newItems = result.data;
      setItems((prev) => [...prev, ...newItems]);
      setHasMore(newItems.length >= perPage);
      pageRef.current += 1;
    } else {
      setError(result.error?.message || 'Đã có lỗi xảy ra');
    }

    setLoading(false);
  }, [apiFunction, perPage, loading, hasMore]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    pageRef.current = 1;
    setHasMore(true);
    setError(null);

    const result = await apiFunction(1, perPage);

    if (result.success && result.data) {
      setItems(result.data);
      setHasMore(result.data.length >= perPage);
      pageRef.current = 2;
    }

    setRefreshing(false);
  }, [apiFunction, perPage]);

  return { items, loading, refreshing, hasMore, error, loadMore, refresh };
}
