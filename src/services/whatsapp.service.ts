import { format } from 'date-fns';
import { toast } from 'sonner';
import { registrarLog } from '@/lib/auditLogger';
import type { Reserva, Hotel, UserProfile } from '@/types';

import { supabase } from '@/config/supabase';

/**
 * Servicio para generar y enviar mensajes de WhatsApp estandarizados.
 */
export const WhatsAppService = {
    /**
     * Genera un mensaje y abre la URL de WhatsApp para una reserva
     */
    enviarMensajeReserva: async (reserva: Reserva, config: Partial<Hotel>, context: { hotelId?: string; user?: UserProfile } = {}) => {
        const telefono = reserva.huesped_telefono ? reserva.huesped_telefono.trim() : '';
        if (!telefono) {
            toast.error("El huésped no tiene número de teléfono registrado");
            return false;
        }
        
        const numeroLimpio = telefono.replace(/\D/g, '');
        
        let numeroFinal = numeroLimpio;
        if (numeroLimpio.length === 9 && numeroLimpio.startsWith('9')) {
            numeroFinal = '51' + numeroLimpio;
        }

        // Usar mediodía UTC para evitar que la zona horaria desplace la fecha al día anterior
        const entrada = new Date(reserva.fecha_entrada + 'T12:00:00');
        const salida = new Date(reserva.fecha_salida + 'T12:00:00');
        const entradaStr = isNaN(entrada.getTime()) ? '---' : format(entrada, 'dd/MM/yyyy');
        const salidaStr = isNaN(salida.getTime()) ? '---' : format(salida, 'dd/MM/yyyy');

        let mensaje = '';
        const hotelNombre = config?.nombre || 'Nuestro Hospedaje';
        
        // Abrir pestaña sincronamente para evitar bloqueo de popups
        const win = window.open('about:blank', '_blank');
        
        try {
            if (reserva.estado === 'pendiente') {
                let tokenLink = '';
                // Intentar usar token pre-existente en el objeto reserva
                if (reserva.checkin_token) {
                    tokenLink = `${window.location.origin}/public-checkin/${reserva.checkin_token}`;
                } else {
                    // Generar/recuperar token usando la DB
                    const { data: tokens, error } = await supabase.rpc('generate_reservation_tokens', { p_reserva_id: reserva.id });
                    if (!error && tokens?.checkin_token) {
                        tokenLink = `${window.location.origin}/public-checkin/${tokens.checkin_token}`;
                    }
                }
                
                mensaje = `¡Hola, ${reserva.huesped_nombre}! 👋\n\nGracias por elegir *${hotelNombre}*.\nConfirmamos tu reserva para la *Habitación #${reserva.habitacion_numero}* 🏨.\n\n📅 *Llegada:* ${entradaStr}\n📅 *Salida:* ${salidaStr}\n💵 *Monto Total:* S/ ${reserva.total?.toFixed(2)}\n\n`;
                
                if (tokenLink) {
                    mensaje += `⚡ *Agiliza tu Check-in:*\nPor favor, completa tus datos de registro aquí para no hacer fila al llegar:\n${tokenLink}\n\n`;
                }
                
                mensaje += `¡Estamos listos para recibirte! Si tienes alguna duda o requerimiento especial, escríbenos por aquí. 😊`;
            } else if (reserva.estado === 'activa') {
                mensaje = `¡Hola, ${reserva.huesped_nombre}! 👋\n\nEsperamos que estés disfrutando tu estadía en *${hotelNombre}* (Habitación #${reserva.habitacion_numero}).\n\nTe recordamos que tu fecha de salida es el *${salidaStr}*.\n\nSi necesitas servicio a la habitación, limpieza extra o tienes alguna consulta, ¡estamos a tu disposición! ✨`;
            } else {
                mensaje = `¡Hola, ${reserva.huesped_nombre}! 👋\n\nQueremos agradecerte por haberte hospedado en *${hotelNombre}* (Reserva #${reserva.numero_reserva}).\n\nEsperamos que hayas tenido un excelente viaje. ¡Te esperamos pronto! 🌟`;
            }

            const url = `https://api.whatsapp.com/send?phone=${numeroFinal}&text=${encodeURIComponent(mensaje)}`;
            
            if (win) {
                win.location.href = url;
            } else {
                window.location.href = url;
            }
        } catch (error) {
            console.error('Error al generar enlace de WhatsApp:', error);
            if (win) win.close();
            toast.error("Ocurrió un error al generar el enlace");
            return false;
        }
        
        if (context.hotelId && context.user) {
            registrarLog({
                hotelId: context.hotelId,
                user: context.user,
                accion: 'WHATSAPP_ENVIADO',
                descripcion: `WhatsApp enviado a ${reserva.huesped_nombre} (${telefono}) para reserva #${reserva.numero_reserva}`,
                modulo: 'recepcion',
            });
        }
        
        toast.success("Enlace de WhatsApp abierto");
        return true;
    }
};
