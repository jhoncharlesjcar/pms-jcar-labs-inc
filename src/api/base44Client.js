import { supabase } from '@/lib/supabaseClient';

/**
 * Capa de compatibilidad Base44 → Supabase
 * 
 * Replica la API de Base44 SDK para que todos los componentes
 * sigan funcionando sin cambios:
 * - base44.entities.EntityName.list(orderBy?, limit?)
 * - base44.entities.EntityName.create(data)
 * - base44.entities.EntityName.update(id, data)
 * - base44.entities.EntityName.delete(id)
 * - base44.entities.EntityName.filter(filters)
 * - base44.auth.logout()
 * - base44.users.inviteUser(email, role)
 */

// Mapeo de nombres de entidades Base44 → tablas Supabase
const TABLE_MAP = {
    Habitacion: 'habitaciones',
    Reserva: 'reservas',
    Venta: 'ventas',
    Hotel: 'hoteles',
    ConfigHotel: 'config_hotel',
    ServicioExtra: 'servicios_extra',
    VentaPOS: 'ventas_pos',
    CodigoDesbloqueo: 'codigos_desbloqueo',
    User: 'usuarios',
};

/**
 * Crea un wrapper de entidad que implementa la misma API que Base44 SDK
 */
function createEntityProxy(tableName) {
    return {
        /**
         * Lista registros con ordenamiento y límite opcionales
         * @param {string} orderBy - Campo de ordenamiento. Prefijo '-' para DESC (ej: '-created_date')
         * @param {number} limit - Límite de registros
         * @returns {Promise<Array>}
         */
        async list(orderBy, limit) {
            let query = supabase.from(tableName).select('*');

            if (orderBy) {
                const isDesc = orderBy.startsWith('-');
                const column = isDesc ? orderBy.slice(1) : orderBy;
                query = query.order(column, { ascending: !isDesc });
            } else {
                query = query.order('created_date', { ascending: false });
            }

            if (limit) {
                query = query.limit(limit);
            }

            const { data, error } = await query;
            if (error) {
                console.error(`Error listing ${tableName}:`, error);
                throw error;
            }
            return data || [];
        },

        /**
         * Crea un nuevo registro
         * @param {object} record - Datos del registro
         * @returns {Promise<object>} El registro creado
         */
        async create(record) {
            // Limpiar campos internos de Base44 que no existen en Supabase
            const cleanData = { ...record };
            delete cleanData.id; // Supabase genera el UUID automáticamente

            const { data, error } = await supabase
                .from(tableName)
                .insert(cleanData)
                .select()
                .single();

            if (error) {
                console.error(`Error creating in ${tableName}:`, error);
                throw error;
            }
            return data;
        },

        /**
         * Actualiza un registro por ID
         * @param {string} id - UUID del registro
         * @param {object} updates - Campos a actualizar
         * @returns {Promise<object>} El registro actualizado
         */
        async update(id, updates) {
            const cleanUpdates = { ...updates, updated_date: new Date().toISOString() };
            delete cleanUpdates.id; // No actualizar el ID

            const { data, error } = await supabase
                .from(tableName)
                .update(cleanUpdates)
                .eq('id', id)
                .select()
                .single();

            if (error) {
                console.error(`Error updating in ${tableName}:`, error);
                throw error;
            }
            return data;
        },

        /**
         * Elimina un registro por ID
         * @param {string} id - UUID del registro
         * @returns {Promise<void>}
         */
        async delete(id) {
            const { error } = await supabase
                .from(tableName)
                .delete()
                .eq('id', id);

            if (error) {
                console.error(`Error deleting from ${tableName}:`, error);
                throw error;
            }
        },

        /**
         * Filtra registros por condiciones simples (key-value)
         * @param {object} filters - Pares clave-valor para filtrar
         * @returns {Promise<Array>}
         */
        async filter(filters) {
            let query = supabase.from(tableName).select('*');

            if (filters && typeof filters === 'object') {
                for (const [key, value] of Object.entries(filters)) {
                    query = query.eq(key, value);
                }
            }

            query = query.order('created_date', { ascending: false });

            const { data, error } = await query;
            if (error) {
                console.error(`Error filtering ${tableName}:`, error);
                throw error;
            }
            return data || [];
        },
    };
}

// Crear proxies para todas las entidades
const entities = {};
for (const [entityName, tableName] of Object.entries(TABLE_MAP)) {
    entities[entityName] = createEntityProxy(tableName);
}

// Auth wrapper
const auth = {
    async logout() {
        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error('Error signing out:', error);
            throw error;
        }
        window.location.reload();
    },
};

// Users wrapper
const users = {
    /**
     * Invita a un usuario por email
     * En Supabase, esto se hace con auth.admin.inviteUserByEmail
     * o simplemente con signUp + magic link
     */
    async inviteUser(email, appRole) {
        try {
            // Usar la API de invitación de Supabase
            // Nota: Esta función requiere la clave de servicio (service_role)
            // En producción, esto debería ir por una Edge Function
            const { data, error } = await supabase.auth.signUp({
                email,
                password: crypto.randomUUID(), // Password temporal
                options: {
                    data: { role: appRole },
                    emailRedirectTo: window.location.origin,
                },
            });

            if (error) throw error;
            return data;
        } catch (err) {
            console.error('Error inviting user:', err);
            throw err;
        }
    },
};

// Export con la misma interfaz que el SDK de Base44
export const base44 = {
    entities,
    auth,
    users,
};