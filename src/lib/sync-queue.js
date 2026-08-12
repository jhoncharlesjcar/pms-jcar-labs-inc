import { get, set } from 'idb-keyval';
import { supabase } from '@/lib/supabaseClient';
import logger from '@/lib/logger';
import { toast } from 'sonner';

const QUEUE_KEY = 'offline_mutation_queue';

/**
 * Agrega una operación a la cola local
 * @param {string} type 'create' | 'update' | 'delete'
 * @param {string} table Nombre de la tabla
 * @param {object} payload Los datos a insertar/actualizar
 * @param {string} id El ID generado localmente (para create) o existente (para update/delete)
 */
export async function enqueueMutation(type, table, payload, id) {
    try {
        const queue = (await get(QUEUE_KEY)) || [];
        queue.push({
            type,
            table,
            payload,
            id,
            timestamp: new Date().toISOString()
        });
        await set(QUEUE_KEY, queue);
        logger.debug(`Mutation enqueued: [${type}] ${table}`, { id, payload });
        
        // Disparar evento para que la UI se actualice
        window.dispatchEvent(new CustomEvent('offline_queue_updated', { detail: queue.length }));
    } catch (err) {
        logger.error('Error al encolar mutación offline:', err);
    }
}

/**
 * Obtiene la cantidad de elementos pendientes en la cola
 */
export async function getPendingCount() {
    try {
        const queue = (await get(QUEUE_KEY)) || [];
        return queue.length;
    } catch (e) {
        return 0;
    }
}

/**
 * Procesa la cola de mutaciones secuencialmente
 */
export async function processQueue() {
    if (!navigator.onLine) return;
    
    let queue = (await get(QUEUE_KEY)) || [];
    if (queue.length === 0) return;

    logger.debug(`Procesando ${queue.length} operaciones encoladas...`);
    toast.info(`Sincronizando ${queue.length} cambios pendientes...`);

    const failedQueue = [];
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
            // Si el error es de red o timeout, lo mantenemos en la cola
            if (error.message?.includes('FetchError') || error.message?.includes('Failed to fetch') || error.status === 503) {
                failedQueue.push(op);
            } else {
                // Si es un error de integridad (ej: foreign key) o sintaxis, lo descartamos
                // para no bloquear el resto de la cola, pero lo logueamos.
                logger.error('Operación descartada por error irrecuperable:', op, error);
            }
        }
    }

    // Actualizar la cola con los que fallaron (red)
    await set(QUEUE_KEY, failedQueue);
    window.dispatchEvent(new CustomEvent('offline_queue_updated', { detail: failedQueue.length }));

    if (successCount > 0) {
        toast.success(`Se sincronizaron ${successCount} cambios con éxito`);
    }
    if (failedQueue.length > 0) {
        toast.error(`Quedan ${failedQueue.length} cambios pendientes sin sincronizar`);
    }
}

// Iniciar listener de conexión
window.addEventListener('online', () => {
    logger.debug('Conexión recuperada, procesando cola...');
    processQueue();
});
