import { useMemo, useState } from 'react';
import { isSameDay } from 'date-fns';

export function useCajaStats(ventasHotel = [], ventasPOS = [], egresos = []) {
    const [filterTab, setFilterTab] = useState('hoy');

    const stats = useMemo(() => {
        const hoy = new Date();
        
        const hHoy = ventasHotel.filter(v => {
            const d = v.fecha_pago || v.fecha_venta || v.created_date;
            return d ? isSameDay(new Date(d), hoy) : false;
        });
        const pHoy = ventasPOS.filter(v => {
            const d = v.fecha_venta || v.created_date;
            return d ? isSameDay(new Date(d), hoy) : false;
        });
        const egHoy = egresos.filter(e => {
            const d = e.fecha || e.created_date;
            return d ? isSameDay(new Date(d), hoy) : false;
        });

        const totalHotel = hHoy.reduce((acc, v) => acc + (Number(v.monto_pagado || v.total) || 0), 0);
        const totalPOS = pHoy.reduce((acc, v) => acc + (Number(v.total) || 0), 0);
        const totalEgresos = egHoy.reduce((acc, e) => acc + (Number(e.monto) || 0), 0);
        
        const totalIngresos = totalHotel + totalPOS;

        // Breakdown by payment method
        const metodos = { efectivo: 0, yape: 0, plin: 0, tarjeta: 0, transferencia: 0 };
        [...hHoy, ...pHoy].forEach(v => {
            const m = (v.metodo_pago || 'efectivo').toLowerCase();
            if (metodos[m] !== undefined) {
                metodos[m] += (Number(v.monto_pagado || v.total) || 0);
            } else {
                metodos.efectivo += (Number(v.monto_pagado || v.total) || 0); // fallback
            }
        });

        // Balance de efectivo real en caja (Efectivo - Egresos)
        const balanceEfectivo = metodos.efectivo - totalEgresos;

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
            balanceEfectivo,
            metodos,
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

    const filteredEgresos = useMemo(() => {
        if (filterTab === 'hoy') return stats.egHoy;
        if (filterTab === 'semana') {
            const hace7 = new Date();
            hace7.setDate(hace7.getDate() - 7);
            return egresos.filter(e => new Date(e.fecha || e.created_date) >= hace7);
        }
        return egresos;
    }, [filterTab, stats.egHoy, egresos]);

    return {
        stats,
        filterTab,
        setFilterTab,
        filteredEgresos
    };
}
