import { supabase } from '@/lib/supabaseClient';
import logger from '@/lib/logger';
import { enqueueMutation } from '@/lib/sync-queue';
import { generateUUID } from '@/lib/utils';

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
    ConfigHotel: 'hoteles',
    ServicioExtra: 'servicios_extra',
    VentaPOS: 'ventas_pos',
    CodigoDesbloqueo: 'codigos_desbloqueo',
    User: 'usuarios',
    Producto: 'productos',
    CategoriaProducto: 'categorias_productos',
    Egreso: 'egresos',
    CierreCaja: 'cierres_caja',
    TarifaDinamica: 'tarifas_dinamicas',
    LoyaltyAccount: 'loyalty_accounts',
    LoyaltyTransaction: 'loyalty_transactions',
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
                // Todas las tablas en este esquema usan created_date en lugar de created_at, excepto algunas
                const dateColumn = ['usuarios', 'hoteles'].includes(tableName) ? 'created_at' : 'created_date';
                query = query.order(dateColumn, { ascending: false });
            }

            if (limit) {
                query = query.limit(limit);
            }

            const { data, error } = await query;
            if (error) {
                logger.error(`Error listing ${tableName}:`, error);
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
            // Si viene con ID, lo respetamos (ej. reintento o forzado). Si no, generamos uno local para uso offline
            if (!cleanData.id) {
                cleanData.id = generateUUID();
            }

            if (!navigator.onLine) {
                logger.warn(`Modo offline: Encolando creación en ${tableName}`, cleanData);
                await enqueueMutation('create', tableName, cleanData, cleanData.id);
                // Retorno optimista
                return { ...cleanData, created_date: new Date().toISOString() };
            }

            try {
                const { data, error } = await supabase
                    .from(tableName)
                    .insert(cleanData)
                    .select()
                    .single();

                if (error) throw error;
                return data;
            } catch (error) {
                // FetchError o error de red de Supabase
                if (error.message?.includes('FetchError') || error.message?.includes('Failed to fetch')) {
                    logger.warn(`Error de red: Encolando creación en ${tableName}`, cleanData);
                    await enqueueMutation('create', tableName, cleanData, cleanData.id);
                    return { ...cleanData, created_date: new Date().toISOString() };
                }
                logger.error(`Error creating in ${tableName}:`, error);
                throw error;
            }
        },

        /**
         * Actualiza un registro por ID
         * @param {string} id - UUID del registro
         * @param {object} updates - Campos a actualizar
         * @returns {Promise<object>} El registro actualizado
         */
        async update(id, updates) {
            const cleanUpdates = { ...updates };
            delete cleanUpdates.id; // Nunca actualizar el ID
            delete cleanUpdates.created_date; // No sobreescribir la fecha de creación
            delete cleanUpdates.created_at;

            if (!navigator.onLine) {
                logger.warn(`Modo offline: Encolando actualización en ${tableName} [${id}]`, cleanUpdates);
                await enqueueMutation('update', tableName, cleanUpdates, id);
                return { id, ...cleanUpdates }; // Mock
            }

            try {
                const { data, error } = await supabase
                    .from(tableName)
                    .update(cleanUpdates)
                    .eq('id', id)
                    .select()
                    .single();

                if (error) throw error;
                return data;
            } catch (error) {
                if (error.message?.includes('FetchError') || error.message?.includes('Failed to fetch')) {
                    logger.warn(`Error de red: Encolando actualización en ${tableName} [${id}]`, cleanUpdates);
                    await enqueueMutation('update', tableName, cleanUpdates, id);
                    return { id, ...cleanUpdates };
                }
                logger.error(`Error updating in ${tableName}:`, error);
                throw error;
            }
        },

        /**
         * Elimina un registro por ID
         * @param {string} id - UUID del registro
         * @returns {Promise<void>}
         */
        async delete(id) {
            if (!navigator.onLine) {
                logger.warn(`Modo offline: Encolando eliminación en ${tableName} [${id}]`);
                await enqueueMutation('delete', tableName, null, id);
                return;
            }

            try {
                const { error } = await supabase
                    .from(tableName)
                    .delete()
                    .eq('id', id);

                if (error) throw error;
            } catch (error) {
                if (error.message?.includes('FetchError') || error.message?.includes('Failed to fetch')) {
                    logger.warn(`Error de red: Encolando eliminación en ${tableName} [${id}]`);
                    await enqueueMutation('delete', tableName, null, id);
                    return;
                }
                logger.error(`Error deleting from ${tableName}:`, error);
                throw error;
            }
        },

        /**
         * Filtra registros por condiciones simples (key-value)
         * @param {object} filters - Pares clave-valor para filtrar
         * @param {string} columns - Columnas a seleccionar
         * @returns {Promise<Array>}
         */
        async filter(filters, columns = '*', orderBy = null) {
            let query = supabase.from(tableName).select(columns);

            if (filters && typeof filters === 'object') {
                for (const [key, value] of Object.entries(filters)) {
                    query = query.eq(key, value);
                }
            }

            if (orderBy) {
                const isDesc = orderBy.startsWith('-');
                const column = isDesc ? orderBy.slice(1) : orderBy;
                query = query.order(column, { ascending: !isDesc });
            } else {
                query = query.order('created_date', { ascending: false });
            }

            const { data, error } = await query;
            if (error) {
                logger.error(`Error filtering ${tableName}:`, error);
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
        logger.debug('--- LOGOUT INICIADO ---');
        try {
            const { error } = await supabase.auth.signOut();
            if (error) logger.error('Error Supabase signOut:', error);
            
            // Limpieza selectiva para no borrar configuraciones (tema, pwa)
            Object.keys(localStorage).forEach(k => k.startsWith('sb-') && localStorage.removeItem(k));
            sessionStorage.clear();
            
            logger.debug('Limpieza completada. Redireccionando...');
            
            // Redirección forzada
            window.location.replace(window.location.origin);
        } catch (err) {
            logger.error('Error crítico en logout:', err);
            Object.keys(localStorage).forEach(k => k.startsWith('sb-') && localStorage.removeItem(k));
            sessionStorage.clear();
            window.location.replace(window.location.origin);
        }
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
            logger.error('Error inviting user:', err);
            throw err;
        }
    },
};

// Cache para instancias scoped por hotel_id (evita re-crear proxies en cada llamada)
const _scopedCache = new Map();

// Exportación principal — API de acceso a datos
export const db = {
    entities,
    auth,
    users,
    /**
     * Crea una instancia de entidades filtrada automáticamente por hotel_id
     * Usa cache interna para evitar re-crear objetos proxy en cada render
     * @param {string} hotelId 
     */
    forHotel(hotelId) {
        if (!hotelId) return entities;
        
        if (_scopedCache.has(hotelId)) return _scopedCache.get(hotelId);
        
        const scoped = {};
        for (const [name, proxy] of Object.entries(entities)) {
            // Si la entidad es 'Hotel', el filtro debe ser por 'id', no por 'hotel_id'
            const filterKey = name === 'Hotel' || name === 'ConfigHotel' ? 'id' : 'hotel_id';
            
            scoped[name] = {
                ...proxy,
                list: (orderBy, limit, columns) => proxy.filter({ [filterKey]: hotelId }, columns, orderBy),
                filter: (filters, columns, orderBy) => proxy.filter({ ...filters, [filterKey]: hotelId }, columns, orderBy),
                create: (data) => proxy.create({ ...data, [filterKey]: hotelId }),
            };
        }
        _scopedCache.set(hotelId, scoped);
        return scoped;
    }
};
