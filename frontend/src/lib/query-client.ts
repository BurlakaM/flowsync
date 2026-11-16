import { QueryClient } from '@tanstack/react-query';
import axios from 'axios';

/** Retrying a request that the server rejected (4xx) cannot help; network errors and 5xx get two retries. */
function shouldRetry(failureCount: number, error: unknown): boolean {
  const status = axios.isAxiosError(error) ? error.response?.status : undefined;
  if (status !== undefined && status < 500) return false;
  return failureCount < 2;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: shouldRetry,
      },
    },
  });
}

export const queryClient = createQueryClient();
