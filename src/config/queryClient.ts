import { QueryClient } from '@tanstack/react-query';

export const queryClientInstance = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,       // 2 minutos (default)
      gcTime: 1000 * 60 * 15,          // 15 minutos (subido de 10)
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,         // Refrescar al reconectar red
      retry: 1,
    },
  },
});
