import { db } from '@/api/db';
import logger from '@/lib/logger';
import { generateUUID } from '@/lib/utils';

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
    
    const logData = {
        hotel_id: hotelId,
        usuario_id: user.id,
        usuario_nombre: user.full_name || user.email || 'Staff',
        usuario_role: user.role || 'user',
        accion: accion.toUpperCase(),
        descripcion,
        modulo,
    };

    try {
        // Intentar escribir en Supabase
        await db.entities.AuditLog.create(logData);
        logger.info(`[AUDIT LOG] ${accion} registrado en Supabase.`);
    } catch (err) {
        logger.warn(`[AUDIT LOG FALLBACK] Fallo al guardar log en Supabase. Almacenando en LocalStorage fallback.`, err);
        
        // Fallback defensivo a LocalStorage para garantizar alta disponibilidad
        try {
            const fallbackLogs = JSON.parse(localStorage.getItem('audit_logs_fallback') || '[]');
            fallbackLogs.unshift({
                ...logData,
                id: generateUUID(),
                created_date: new Date().toISOString()
            });
            // Mantener solo los últimos 100 logs
            localStorage.setItem('audit_logs_fallback', JSON.stringify(fallbackLogs.slice(0, 100)));
        } catch (localErr) {
            logger.error('[AUDIT LOG CRITICAL] Error escribiendo en LocalStorage:', localErr);
        }
    }
}
