import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/db';

export function useCajaData(hotelId, user) {
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
        const hoy = new Date().toISOString().split('T')[0];
        
        const hHoy = ventasHotel.filter(v => (v.fecha_pago || v.fecha_venta || v.created_date || '').startsWith(hoy));
        const pHoy = ventasPOS.filter(v => (v.fecha_venta || v.created_date || '').startsWith(hoy));
        const egHoy = egresos.filter(e => (e.fecha || e.created_date || '').startsWith(hoy));

        const totalHotel = hHoy.reduce((acc, v) => acc + (Number(v.monto_pagado || v.total) || 0), 0);
        const totalPOS = pHoy.reduce((acc, v) => acc + (Number(v.total) || 0), 0);
        const totalEgresos = egHoy.reduce((acc, e) => acc + (Number(e.monto) || 0), 0);
        
        const totalIngresos = totalHotel + totalPOS;

        // Estadísticas SUNAT
        let sunatDeclaradasCount = 0;
        let sunatDeclaradasTotal = 0;
        let sunatPendientesCount = 0;
        let sunatPendientesTotal = 0;
        let sunatRechazadasCount = 0;
        let sunatRechazadasTotal = 0;

        [...hHoy, ...pHoy].forEach(v => {
            const estado = v.estado_comprobante;
            const totalVal = Number(v.monto_pagado || v.total) || 0;
            if (estado === 'sunat_emitido') {
                sunatDeclaradasCount++;
                sunatDeclaradasTotal += totalVal;
            } else if (estado === 'sunat_pendiente') {
                sunatPendientesCount++;
                sunatPendientesTotal += totalVal;
            } else if (estado === 'sunat_rechazado') {
                sunatRechazadasCount++;
                sunatRechazadasTotal += totalVal;
            }
        });

        return {
            ingresos: totalIngresos,
            hotel: totalHotel,
            pos: totalPOS,
            egresos: totalEgresos,
            balance: totalIngresos - totalEgresos,
            countHotel: hHoy.length,
            countPOS: pHoy.length,
            countEgresos: egHoy.length,
            hHoy,
            pHoy,
            egHoy,
            sunatDeclaradasCount,
            sunatDeclaradasTotal,
            sunatPendientesCount,
            sunatPendientesTotal,
            sunatRechazadasCount,
            sunatRechazadasTotal
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
