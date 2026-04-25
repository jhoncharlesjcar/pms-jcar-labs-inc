import { QueryClient } from '@tanstack/react-query';

export const queryClientInstance = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60 * 2, // 2 minutos
            refetchOnWindowFocus: false,
            retry: 1,
        },
    },
});
