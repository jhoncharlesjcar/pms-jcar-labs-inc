import { supabase } from '@/lib/supabaseClient';

/**
 * Capa de acceso a datos — Supabase
 * 
 * API unificada para todas las operaciones CRUD:
 * - db.entities.EntityName.list(orderBy?, limit?)
 * - db.entities.EntityName.create(data)
 * - db.entities.EntityName.update(id, data)
 * - db.entities.EntityName.delete(id)
 * - db.entities.EntityName.filter(filters)
 * - db.auth.logout()
 * - db.users.inviteUser(email, role)
 */

// Mapeo de nombres de entidades → tablas Supabase
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
 * Crea un wrapper de entidad con operaciones CRUD estándar
 */
function createEntityProxy(tableName) {
    return {
        /**
         * Lista registros con ordenamiento, límite y columnas opcionales
         * @param {string} orderBy - Campo de ordenamiento. Prefijo '-' para DESC (ej: '-created_date')
         * @param {number} limit - Límite de registros
         * @param {string} columns - Columnas a seleccionar (ej: 'id, nombre, precio')
         * @returns {Promise<Array>}
         */
        async list(orderBy, limit, columns = '*') {
            let query = supabase.from(tableName).select(columns);

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
         * @param {string} columns - Columnas a seleccionar
         * @returns {Promise<Array>}
         */
        async filter(filters, columns = '*') {
            let query = supabase.from(tableName).select(columns);

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
     * Usa signUp de Supabase con password temporal
     * En producción, esto debería ir por una Edge Function con service_role
     */
    async inviteUser(email, appRole, hotelId) {
        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password: crypto.randomUUID(),
                options: {
                    data: { 
                        role: appRole,
                        hotel_id: hotelId
                    },
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

// Exportación principal — API de acceso a datos
export const db = {
    entities,
    auth,
    users,
};
