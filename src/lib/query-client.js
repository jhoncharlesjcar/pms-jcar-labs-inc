import { QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { get, set, del } from 'idb-keyval';

// Configuramos gcTime largo para retener datos por 48 horas en disco,
// y staleTime por defecto de 2 minutos.
export const queryClientInstance = new QueryClient({
    defaultOptions: {
        queries: {
            gcTime: 1000 * 60 * 60 * 48, // 48 horas en caché local
            staleTime: 1000 * 60 * 2, // 2 minutos (luego hace refetch en background)
            refetchOnWindowFocus: false,
            retry: 1,
        },
    },
});

// Sobreescribimos staleTime para consultas que son súper estáticas
queryClientInstance.setQueryDefaults(['config'], { staleTime: 1000 * 60 * 60 * 24 });
queryClientInstance.setQueryDefaults(['personal'], { staleTime: 1000 * 60 * 60 * 24 });
queryClientInstance.setQueryDefaults(['categorias'], { staleTime: 1000 * 60 * 60 * 24 });
queryClientInstance.setQueryDefaults(['productos'], { staleTime: 1000 * 60 * 60 * 24 });
queryClientInstance.setQueryDefaults(['tarifas_dinamicas'], { staleTime: 1000 * 60 * 60 * 24 });

// Creamos un persister asíncrono para IndexedDB
export const idbPersister = createAsyncStoragePersister({
    storage: {
        getItem: async (key) => {
            const val = await get(key);
            return val === undefined ? null : val;
        },
        setItem: async (key, value) => {
            await set(key, value);
        },
        removeItem: async (key) => {
            await del(key);
        },
    },
});
