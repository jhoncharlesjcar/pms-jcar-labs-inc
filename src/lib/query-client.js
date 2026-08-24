import { QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { get, set, del, keys } from 'idb-keyval';

const CACHE_SCHEMA_VERSION = 'jcar-cache-v3';
const PERSISTABLE_QUERY_ROOTS = new Set(['config', 'categorias', 'productos', 'tarifas_dinamicas', 'public-settings']);

function currentIdentity() {
    try {
        const authKey = Object.keys(localStorage).find(key => key.startsWith('sb-') && key.endsWith('-auth-token'));
        const stored = authKey ? JSON.parse(localStorage.getItem(authKey) || '{}') : null;
        return stored?.user?.id || stored?.currentSession?.user?.id || 'anonymous';
    } catch {
        return 'anonymous';
    }
}

function scopedKey(key) {
    return `${CACHE_SCHEMA_VERSION}:${currentIdentity()}:${key}`;
}

export function shouldPersistQuery(query) {
    const root = String(query.queryKey?.[0] || '');
    return query.state.status === 'success' && PERSISTABLE_QUERY_ROOTS.has(root);
}

export function getCacheBuster() {
    return `${CACHE_SCHEMA_VERSION}:${currentIdentity()}`;
}

// Configuramos gcTime controlado (4 horas) para evitar retención prolongada de PII en disco,
// y staleTime por defecto de 2 minutos.
export const queryClientInstance = new QueryClient({
    defaultOptions: {
        queries: {
            gcTime: 1000 * 60 * 60 * 4, // 4 horas en memoria/caché local
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
            const val = await get(scopedKey(key));
            return val === undefined ? null : val;
        },
        setItem: async (key, value) => {
            await set(scopedKey(key), value);
        },
        removeItem: async (key) => {
            await del(scopedKey(key));
        },
    },
});

/**
 * Purgado completo y seguro de caché en memoria y almacenamiento local
 */
export async function clearPersistedCache() {
    queryClientInstance.clear();
    try {
        await idbPersister.removeClient();
        const allKeys = await keys();
        await Promise.all(allKeys.filter(key => typeof key === 'string' && key.startsWith(`${CACHE_SCHEMA_VERSION}:`)).map(key => del(key)));
    } catch {
        // Ignorar si ya fue removido
    }
}
