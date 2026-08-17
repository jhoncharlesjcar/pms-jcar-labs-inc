import { get, set, del, keys } from 'idb-keyval';
import { supabase } from '@/config/supabase';
import logger from '@/lib/logger';
import { toast } from 'sonner';

const QUEUE_PREFIX = 'offline_queue_';
const DEAD_LETTER_PREFIX = 'dead_letter_';
const MAX_RETRIES = 3;

/**
 * Genera la clave de cola particionada por usuario y hotel.
 * Esto evita que operaciones de un usuario/hotel se mezclen con otro.
 */
function getQueueKey(userId, hotelId) {
    if (!userId || !hotelId) {
        throw new Error('No se puede usar la cola offline sin usuario y hotel identificados');
    }
    return `${QUEUE_PREFIX}${userId}_${hotelId}`;
}

function getDeadLetterKey(userId, hotelId) {
    if (!userId || !hotelId) return 'dead_letter_queue';
    return `${DEAD_LETTER_PREFIX}${userId}_${hotelId}`;
}

/**
 * Agrega una operación a la cola local, particionada por usuario/hotel.
 * @param {string} type 'create' | 'update' | 'delete'
 * @param {string} table Nombre de la tabla
 * @param {object} payload Los datos a insertar/actualizar
 * @param {string} id El ID generado localmente (para create) o existente (para update/delete)
 * @param {string} userId ID del usuario autenticado
 * @param {string} hotelId ID del hotel activo
 */
export async function enqueueMutation(type, table, payload, id, userId, hotelId) {
    try {
        const queueKey = getQueueKey(userId, hotelId);
        const queue = (await get(queueKey)) || [];

        const idempotencyKey = `${type}_${table}_${id}_${Date.now()}`;

        queue.push({
            type,
            table,
            payload,
            id,
            userId,
            hotelId,
            idempotencyKey,
            retries: 0,
            status: 'pending',
            timestamp: new Date().toISOString()
        });
        await set(queueKey, queue);
        logger.debug(`Mutation enqueued: [${type}] ${table}`, { id, idempotencyKey });

        // Disparar evento para que la UI se actualice
        window.dispatchEvent(new CustomEvent('offline_queue_updated', { detail: queue.length }));
    } catch (err) {
        logger.error('Error al encolar mutación offline:', err);
        throw err;
    }
}

/**
 * Obtiene la cantidad de elementos pendientes en la cola del usuario/hotel actual.
 */
export async function getPendingCount(userId, hotelId) {
    try {
        const queueKey = getQueueKey(userId, hotelId);
        const queue = (await get(queueKey)) || [];
        return queue.length;
    } catch {
        return 0;
    }
}

/**
 * Obtiene la cantidad de elementos en dead-letter.
 */
export async function getDeadLetterCount(userId, hotelId) {
    try {
        const dlKey = getDeadLetterKey(userId, hotelId);
        const dl = (await get(dlKey)) || [];
        return dl.length;
    } catch {
        return 0;
    }
}

/**
 * Procesa la cola de mutaciones secuencialmente para el usuario/hotel dado.
 */
export async function processQueue(userId, hotelId) {
    if (!navigator.onLine) return;

    const queueKey = getQueueKey(userId, hotelId);
    const dlKey = getDeadLetterKey(userId, hotelId);

    let queue = (await get(queueKey)) || [];
    if (queue.length === 0) return;

    logger.debug(`Procesando ${queue.length} operaciones encoladas...`);
    toast.info(`Sincronizando ${queue.length} cambios pendientes...`);

    const retryQueue = [];
    const deadLetterQueue = (await get(dlKey)) || [];
    let successCount = 0;

    for (const op of queue) {
        try {
            if (op.type === 'create') {
                const { error } = await supabase.from(op.table).insert({ ...op.payload, id: op.id });
                if (error) throw error;
            }
            else if (op.type === 'update') {
                const { error } = await supabase.from(op.table).update(op.payload).eq('id', op.id);
                if (error) throw error;
            }
            else if (op.type === 'delete') {
                const { error } = await supabase.from(op.table).delete().eq('id', op.id);
                if (error) throw error;
            }
            successCount++;
        } catch (error) {
            logger.error(`Error procesando operación de cola [${op.type}] en ${op.table}:`, error);

            const isNetworkError =
                error.message?.includes('FetchError') ||
                error.message?.includes('Failed to fetch') ||
                error.status === 503;

            if (isNetworkError) {
                // Error de red: reintentar después
                retryQueue.push({ ...op, retries: (op.retries || 0) + 1, status: 'pending' });
            } else if ((op.retries || 0) < MAX_RETRIES) {
                // Error de BD pero aún tiene reintentos disponibles
                retryQueue.push({
                    ...op,
                    retries: (op.retries || 0) + 1,
                    status: 'failed',
                    lastError: error.message || String(error),
                });
            } else {
                // Agotó reintentos: mover a dead-letter
                logger.error('Operación movida a dead-letter tras agotar reintentos:', op, error);
                deadLetterQueue.push({
                    ...op,
                    status: 'dead-letter',
                    lastError: error.message || String(error),
                    movedAt: new Date().toISOString(),
                });
            }
        }
    }

    // Actualizar colas
    await set(queueKey, retryQueue);
    await set(dlKey, deadLetterQueue);

    window.dispatchEvent(new CustomEvent('offline_queue_updated', { detail: retryQueue.length }));

    if (successCount > 0) {
        toast.success(`Se sincronizaron ${successCount} cambios con éxito`);
    }
    if (retryQueue.length > 0) {
        toast.error(`Quedan ${retryQueue.length} cambios pendientes sin sincronizar`);
    }
    if (deadLetterQueue.length > 0) {
        toast.warning(`${deadLetterQueue.length} operaciones requieren revisión manual (dead-letter)`);
    }
}

/**
 * Purga todas las colas y dead-letters asociadas a un usuario/hotel.
 * Debe llamarse en logout para evitar fuga de datos entre sesiones.
 */
export async function purgeAllQueues() {
    try {
        const allKeys = await keys();
        const queueKeys = allKeys.filter(k =>
            typeof k === 'string' && (k.startsWith(QUEUE_PREFIX) || k.startsWith(DEAD_LETTER_PREFIX) || k === 'offline_mutation_queue' || k === 'dead_letter_queue')
        );
        for (const key of queueKeys) {
            await del(key);
        }
        logger.debug('Todas las colas offline purgadas');
        window.dispatchEvent(new CustomEvent('offline_queue_updated', { detail: 0 }));
    } catch (err) {
        logger.error('Error purgando colas offline:', err);
    }
}

export async function purgeQueuesForIdentity(userId, hotelId) {
    await del(getQueueKey(userId, hotelId));
    await del(getDeadLetterKey(userId, hotelId));
    window.dispatchEvent(new CustomEvent('offline_queue_updated', { detail: 0 }));
}

// Iniciar listener de conexión
window.addEventListener('online', () => {
    logger.debug('Conexión recuperada, procesando cola...');
    // El processQueue ahora requiere userId/hotelId, así que disparamos un evento
    // para que el componente que tiene esos datos llame a processQueue
    window.dispatchEvent(new CustomEvent('connection_restored'));
});
