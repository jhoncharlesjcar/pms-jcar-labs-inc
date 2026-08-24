import { supabase } from '@/config/supabase';
import logger from '@/lib/logger';

/**
 * Registra una acción en la bitácora de auditoría inmutable (Audit Log)
 * 
 * @param {object} params
 * @param {string} params.hotelId - ID del hotel actual
 * @param {object} params.user - Objeto de usuario actual
 * @param {string} params.accion - Acción realizada (e.g. 'CHECK-IN', 'CHECK-OUT', 'VENTA_POS')
 * @param {string} params.descripcion - Detalle de lo realizado
 * @param {string} params.modulo - Módulo afectado ('recepcion', 'ventas', 'caja', 'pos', 'limpieza', 'configuracion')
 */
export async function registrarLog({ hotelId, user, accion, descripcion, modulo }) {
    if (!hotelId || !user) return;
    
    try {
        const { error } = await supabase.rpc('write_audit_event', {
            p_hotel_id: hotelId,
            p_action: accion.toUpperCase(),
            p_module: modulo,
            p_entity_type: null,
            p_entity_id: null,
            p_description: descripcion,
            p_metadata: {},
            p_request_id: globalThis.crypto?.randomUUID?.() || null,
        });
        if (error) throw error;
        logger.info('audit.event.persisted', { action: accion, module: modulo });
    } catch (err) {
        // Una auditoría no persistida no se sustituye por almacenamiento manipulable
        // del navegador. El llamador decide si el flujo puede continuar.
        logger.error('audit.event.persistence_failed', { action: accion, module: modulo, error: err });
        throw err;
    }
}
