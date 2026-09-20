import { del, get, keys } from 'idb-keyval';
import logger from '@/lib/logger';

const QUEUE_PREFIX = 'offline_queue_';
const DEAD_LETTER_PREFIX = 'dead_letter_';

function getQueueKey(userId, hotelId) {
    if (!userId || !hotelId) throw new Error('No se puede usar estado offline sin usuario y hotel identificados');
    return `${QUEUE_PREFIX}${userId}_${hotelId}`;
}

function getDeadLetterKey(userId, hotelId) {
    if (!userId || !hotelId) throw new Error('No se puede usar estado offline sin usuario y hotel identificados');
    return `${DEAD_LETTER_PREFIX}${userId}_${hotelId}`;
}

/**
 * Error tipado para mutaciones que requieren conexión.
 * Permite al caller distinguir "offline por diseño" vs "error de red real".
 */
export class OfflineMutationError extends Error {
    constructor(operation, table, reason) {
        super(`Mutation ${operation} on ${table} requires connection (${reason})`);
        this.name = 'OfflineMutationError';
        this.operation = operation;
        this.table = table;
        this.reason = reason;
    }
}

/**
 * Las mutaciones CRUD genéricas no tienen un contrato servidor idempotente ni
 * transaccional. Por eso se rechazan sin conexión en vez de persistir PII o
 * operaciones financieras en IndexedDB para reproducirlas después.
 */
export async function enqueueMutation(..._legacyArguments) {
    throw new OfflineMutationError('unknown', 'unknown', 'offline');
}

export async function getPendingCount(userId, hotelId) {
    try {
        return ((await get(getQueueKey(userId, hotelId))) || []).length;
    } catch {
        return 0;
    }
}

export async function getDeadLetterCount(userId, hotelId) {
    try {
        return ((await get(getDeadLetterKey(userId, hotelId))) || []).length;
    } catch {
        return 0;
    }
}

export async function processQueue(userId, hotelId) {
    if (!userId || !hotelId) return;
    const count = await getPendingCount(userId, hotelId);
    if (count > 0) {
        logger.warn('offline.legacy_queue_blocked', {
            count,
            reason: 'generic_mutations_are_not_idempotent',
        });
        window.dispatchEvent(new CustomEvent('offline_queue_blocked', { detail: count }));
    }
}

export async function purgeAllQueues() {
    try {
        const allKeys = await keys();
        const queueKeys = allKeys.filter((key) => typeof key === 'string'
            && (key.startsWith(QUEUE_PREFIX) || key.startsWith(DEAD_LETTER_PREFIX)
                || key === 'offline_mutation_queue' || key === 'dead_letter_queue'));
        await Promise.all(queueKeys.map((key) => del(key)));
        window.dispatchEvent(new CustomEvent('offline_queue_updated', { detail: 0 }));
    } catch (error) {
        logger.error('offline.queue_purge_failed', { error });
    }
}

export async function purgeQueuesForIdentity(userId, hotelId) {
    await Promise.all([del(getQueueKey(userId, hotelId)), del(getDeadLetterKey(userId, hotelId))]);
    window.dispatchEvent(new CustomEvent('offline_queue_updated', { detail: 0 }));
}

window.addEventListener('online', () => {
    window.dispatchEvent(new CustomEvent('connection_restored'));
});
