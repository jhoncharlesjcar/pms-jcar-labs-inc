// src/api/entities/index.ts
// Entity proxies - CRUD operations for Supabase tables

import { supabase } from '@/config/supabase';
import logger from '@/lib/logger';
import { generateUUID } from '@/lib/utils';

/** Mapeo de nombres de entidades → tablas Supabase */
export const TABLE_MAP = {
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
  CheckinPublico: 'checkins_publicos',
  Insumo: 'insumos',
  CategoriaInsumo: 'categorias_insumos',
  MovimientoInsumo: 'movimientos_insumos',
  AuditLog: 'audit_logs',
} as const;

/** Mapeo de tablas con convención de fecha distinta */
export const TABLE_DATE_COLUMN = {
  usuarios: 'created_at',
  hoteles: 'created_at',
  audit_events: 'created_at',
  audit_logs: 'created_at',
  loyalty_accounts: 'created_at',
  loyalty_transactions: 'created_at',
} as const;

export type EntityName = keyof typeof TABLE_MAP;
export type TableName = typeof TABLE_MAP[EntityName];

/**
 * Crea un wrapper de entidad con operaciones CRUD estándar
 */
export function createEntityProxy(tableName: TableName) {
  return {
    /**
     * Obtiene un registro por ID
     */
    async get(id: string, columns = '*') {
      const { data, error } = await supabase
        .from(tableName)
        .select(columns)
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },

    /**
     * Lista registros con ordenamiento, límite y columnas opcionales
     * @param orderBy - Campo de ordenamiento. Prefijo '-' para DESC (ej: '-created_date')
     * @param limit - Límite de registros (por defecto 500)
     * @param columns - Columnas a seleccionar (ej: 'id, nombre, precio')
     */
    async list(orderBy?: string, limit = 500, columns = '*') {
      let query = supabase.from(tableName).select(columns);

      if (orderBy) {
        const isDesc = orderBy.startsWith('-');
        const column = isDesc ? orderBy.slice(1) : orderBy;
        query = query.order(column, { ascending: !isDesc });
      } else {
        const dateColumn = TABLE_DATE_COLUMN[tableName as keyof typeof TABLE_DATE_COLUMN] || 'created_date';
        query = query.order(dateColumn, { ascending: false });
      }

      const effectiveLimit = limit ?? 500;
      if (effectiveLimit && effectiveLimit > 0) {
        query = query.limit(effectiveLimit);
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
     */
    async create(record: Record<string, any>) {
      const cleanData = { ...record };
      if (!cleanData.id) {
        cleanData.id = generateUUID();
      }
      const { data, error } = await supabase
        .from(tableName)
        .insert(cleanData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    /**
     * Actualiza un registro por ID
     */
    async update(id: string, updates: Record<string, any>) {
      const cleanUpdates = { ...updates };
      delete cleanUpdates.id;
      delete cleanUpdates.created_date;
      delete cleanUpdates.created_at;

      const { data, error } = await supabase
        .from(tableName)
        .update(cleanUpdates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    /**
     * Elimina un registro por ID
     */
    async delete(id: string) {
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', id);

      if (error) throw error;
    },

    /**
     * Filtra registros por condiciones simples (key-value)
     */
    async filter(filters: Record<string, any>, columns = '*', orderBy?: string) {
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
export const entities: Record<EntityName, ReturnType<typeof createEntityProxy>> = {} as any;
for (const [entityName, tableName] of Object.entries(TABLE_MAP)) {
  entities[entityName as EntityName] = createEntityProxy(tableName);
}

// Export types
export type EntityProxy = ReturnType<typeof createEntityProxy>;