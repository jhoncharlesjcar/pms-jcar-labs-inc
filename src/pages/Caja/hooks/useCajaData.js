import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/db';
import { calcularCajaStats } from '@/services/caja.service';

export function useCajaData(hotelId) {
    const qc = useQueryClient();
    const hotelDb = db.forHotel(hotelId);

    // --- DATA FETCHING ---
    const { data: ventasHotel = [] } = useQuery({
        queryKey: ['ventas-hotel', hotelId],
        queryFn: () => hotelDb.Venta.list(),
        enabled: !!hotelId
    });

    const { data: ventasPOS = [] } = useQuery({
        queryKey: ['ventas-pos', hotelId],
        queryFn: () => hotelDb.VentaPOS.list(),
        enabled: !!hotelId
    });

    const { data: egresos = [] } = useQuery({
        queryKey: ['egresos', hotelId],
        queryFn: () => hotelDb.Egreso.list(),
        enabled: !!hotelId
    });

    const { data: cierres = [] } = useQuery({
        queryKey: ['cierres', hotelId],
        queryFn: () => hotelDb.CierreCaja.list(),
        enabled: !!hotelId
    });

    // --- MUTATIONS ---
    /** @type {import('@tanstack/react-query').UseMutationResult<any, Error, Object>} */
    const addEgreso = useMutation({
        /** @param {Object} vars */
        mutationFn: (vars) => hotelDb.Egreso.create(vars),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['egresos', hotelId] });
        }
    });

    /** @type {import('@tanstack/react-query').UseMutationResult<any, Error, Object>} */
    const addCierre = useMutation({
        /** @param {Object} vars */
        mutationFn: (vars) => hotelDb.CierreCaja.create(vars),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['cierres', hotelId] });
        }
    });

    // --- CALCULATIONS ---
    const stats = useMemo(() => {
        const hoy = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Lima' });
        
        const hHoy = ventasHotel.filter(v => (v.fecha_pago || v.fecha_venta || v.created_date || '').startsWith(hoy));
        const pHoy = ventasPOS.filter(v => (v.fecha_venta || v.created_date || '').startsWith(hoy));
        const egHoy = egresos.filter(e => (e.fecha || e.created_date || '').startsWith(hoy));

        return {
            ...calcularCajaStats(hHoy, pHoy, egHoy),
            hHoy,
            pHoy,
            egHoy,
        };
    }, [ventasHotel, ventasPOS, egresos]);

    return {
        egresos,
        cierres,
        stats,
        addEgreso,
        addCierre
    };
}
