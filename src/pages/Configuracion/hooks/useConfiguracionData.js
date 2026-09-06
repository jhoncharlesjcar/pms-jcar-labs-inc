import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useHotelData } from '@/hooks/useHotelData';
import { supabase } from '@/config/supabase';
import logger from '@/lib/logger';
import { toast } from 'sonner';

export function useConfiguracionData() {
    const queryClient = useQueryClient();
    const { db: hotelDb, hotelId } = useHotelData();
    const [saved, setSaved] = useState(false);
    const [showQrModal, setShowQrModal] = useState(null);
    const [activeTab, setActiveTab] = useState('general');

    const [form, setForm] = useState({
        nombre: '',
        direccion: '',
        ciudad: '',
        ubigeo: '',
        departamento: '',
        provincia: '',
        distrito: '',
        telefono: '',
        ruc: '',
        razon_social: '',
        check_in_hora: '13:00',
        check_out_hora: '12:00',
        tolerancia_minutos: 15,
        sunat_usuario_sol: '',
        sunat_clave_sol: '',
        sunat_certificado_pem: '',
        sunat_cert_private_key_pem: '',
        sunat_modo_prueba: true,
        aplica_igv: true,
        modo_sunat: 'desactivado',
        loyalty_program_enabled: false,
        pts_por_sol: 1,
        soles_por_punto: 0.1,
        modo_automatico: false,
        pasarela_activa: 'culqi',
        pasarela_public_key: '',
        pasarela_private_key: '',
        qr_yape_url: '',
        qr_plin_url: '',
    });

    const { data: hotel, isLoading } = useQuery({
        queryKey: ['hotel-config', hotelId],
        queryFn: () => hotelDb.Hotel.get(hotelId),
        enabled: !!hotelId,
    });

    useEffect(() => {
        if (hotel) {
            setForm({
                nombre: hotel.nombre || '',
                direccion: hotel.direccion || '',
                ciudad: hotel.ciudad || '',
                ubigeo: hotel.ubigeo || '',
                departamento: hotel.departamento || '',
                provincia: hotel.provincia || '',
                distrito: hotel.distrito || '',
                telefono: hotel.telefono || '',
                ruc: hotel.ruc || '',
                razon_social: hotel.razon_social || '',
                check_in_hora: hotel.check_in_hora || '13:00',
                check_out_hora: hotel.check_out_hora || '12:00',
                tolerancia_minutos: hotel.tolerancia_minutos ?? 15,
                sunat_usuario_sol: hotel.sunat_usuario_sol || '',
                sunat_clave_sol: hotel.sunat_clave_sol || '',
                sunat_certificado_pem: hotel.sunat_certificado_pem || '',
                sunat_cert_private_key_pem: '',
                sunat_modo_prueba: hotel.sunat_modo_prueba ?? true,
                aplica_igv: hotel.aplica_igv ?? true,
                modo_sunat: hotel.modo_sunat || 'desactivado',
                loyalty_program_enabled: hotel.loyalty_program_enabled ?? false,
                pts_por_sol: hotel.pts_por_sol ?? 1,
                soles_por_punto: hotel.soles_por_punto ?? 0.1,
                modo_automatico: hotel.modo_automatico ?? false,
                pasarela_activa: hotel.pasarela_activa || 'culqi',
                pasarela_public_key: hotel.pasarela_public_key || '',
                pasarela_private_key: '',
                qr_yape_url: hotel.qr_yape_url || '',
                qr_plin_url: hotel.qr_plin_url || '',
            });
        }
    }, [hotel]);

    const guardar = useMutation({
        mutationFn: async () => {
            const {
                sunat_clave_sol,
                sunat_certificado_pem,
                sunat_cert_private_key_pem,
                pasarela_private_key,
                ...publicHotelData
            } = form;

            await hotelDb.Hotel.update(hotelId, publicHotelData);

            if (sunat_clave_sol || sunat_certificado_pem || sunat_cert_private_key_pem || pasarela_private_key) {
                const { error: secretError } = await supabase.functions.invoke('configure-hotel-secrets', {
                    body: {
                        hotel_id: hotelId,
                        sunat_clave_sol: sunat_clave_sol || null,
                        sunat_certificado_pem: sunat_certificado_pem || null,
                        sunat_cert_private_key_pem: sunat_cert_private_key_pem || null,
                        pasarela_private_key: pasarela_private_key || null,
                    },
                });
                if (secretError) throw secretError;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['hotel-config'] });
            queryClient.invalidateQueries({ queryKey: ['hotel-actual'] });
            queryClient.invalidateQueries({ queryKey: ['config'] });
            queryClient.invalidateQueries({ queryKey: ['hoteles'] });
            setForm(current => ({
                ...current,
                sunat_clave_sol: '',
                sunat_certificado_pem: '',
                sunat_cert_private_key_pem: '',
                pasarela_private_key: '',
            }));
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
            toast.success('Configuración guardada de forma segura.');
        },
        onError: (err) => {
            logger.error('Error guardando configuración:', err);
            toast.error(err?.message || 'No se pudo guardar la configuración.');
        },
    });

    return {
        hotelDb, hotelId,
        form, setForm,
        activeTab, setActiveTab,
        showQrModal, setShowQrModal,
        saved, guardar,
        isLoading
    };
}
