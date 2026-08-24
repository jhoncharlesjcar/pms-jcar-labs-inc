import { useCallback } from 'react';
import { format } from 'date-fns';
import { downloadCsv } from '@/lib/csv';
import { printCashClosure } from '@/modules/printer/services/printer.service';
// jsPDF se importa dinámicamente para evitar carga en todas las páginas.

export function useCajaExport(hotelActual, user, stats) {
    const handlePrintTicket = useCallback(() => {
        printCashClosure({
            hotelName: hotelActual?.nombre,
            address: hotelActual?.direccion,
            userName: user?.full_name || user?.email,
            date: new Date(),
            hotelCount: stats.countHotel,
            hotelTotal: stats.hotel,
            posCount: stats.countPOS,
            posTotal: stats.pos,
            egresosCount: stats.countEgresos,
            egresosTotal: stats.egresos,
            saldoFinal: stats.balance,
            efectivoEsperado: stats.balanceEfectivo,
            metodos: stats.metodos,
            hotelSales: stats.hHoy,
            posSales: stats.pHoy
        });
    }, [hotelActual, user, stats]);

    const handlePrintHotel = useCallback(() => {
        printCashClosure({
            hotelName: hotelActual?.nombre,
            address: hotelActual?.direccion,
            userName: user?.full_name || user?.email,
            date: new Date(),
            hotelCount: stats.countHotel,
            hotelTotal: stats.hotel,
            hotelSales: stats.hHoy,
            onlyHotel: true
        });
    }, [hotelActual, user, stats]);

    const handlePrintPOS = useCallback(() => {
        printCashClosure({
            hotelName: hotelActual?.nombre,
            address: hotelActual?.direccion,
            userName: user?.full_name || user?.email,
            date: new Date(),
            posCount: stats.countPOS,
            posTotal: stats.pos,
            posSales: stats.pHoy,
            onlyPOS: true
        });
    }, [hotelActual, user, stats]);

    const handleExportPDF = useCallback(async () => {
        const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
            import('jspdf'),
            import('jspdf-autotable'),
        ]);
        const doc = new jsPDF();
        const now = format(new Date(), "dd/MM/yyyy HH:mm");

        doc.setFontSize(20);
        doc.text("Reporte de Cierre de Caja", 105, 15, { align: 'center' });
        
        doc.setFontSize(10);
        doc.text(`Hotel: ${hotelActual?.nombre || 'General'}`, 14, 25);
        doc.text(`Fecha: ${now}`, 14, 30);
        doc.text(`Responsable: ${user?.full_name || user?.email}`, 14, 35);

        // Resumen
        const summaryData = [
            ["Categoría", "Transacciones", "Total"],
            ["Ventas Hotel", stats.countHotel, `S/ ${stats.hotel.toFixed(2)}`],
            ["Ventas Minimarket", stats.countPOS, `S/ ${stats.pos.toFixed(2)}`],
            ["Egresos / Gastos", stats.countEgresos, `- S/ ${stats.egresos.toFixed(2)}`],
            ["SALDO NETO", "", `S/ ${stats.balance.toFixed(2)}`],
            ["EFECTIVO ESPERADO", "", `S/ ${stats.balanceEfectivo.toFixed(2)}`]
        ];

        autoTable(doc, {
            startY: 45,
            head: [summaryData[0]],
            body: summaryData.slice(1),
            theme: 'striped',
            headStyles: { fillColor: [0, 112, 65] }
        });

        autoTable(doc, {
            startY: /** @type {any} */ (doc).lastAutoTable.finalY + 8,
            head: [["Medio de pago", "Total"]],
            body: Object.entries(stats.metodos).map(([metodo, total]) => [
                metodo.charAt(0).toUpperCase() + metodo.slice(1),
                `S/ ${Number(total).toFixed(2)}`,
            ]),
            theme: 'grid',
            headStyles: { fillColor: [30, 64, 175] }
        });

        autoTable(doc, {
            startY: /** @type {any} */ (doc).lastAutoTable.finalY + 8,
            head: [["Estado SUNAT", "Cantidad", "Total"]],
            body: [
                ["Aceptados", stats.sunatDeclaradasCount, `S/ ${stats.sunatDeclaradasTotal.toFixed(2)}`],
                ["Pendientes", stats.sunatPendientesCount, `S/ ${stats.sunatPendientesTotal.toFixed(2)}`],
                ["Rechazados", stats.sunatRechazadasCount, `S/ ${stats.sunatRechazadasTotal.toFixed(2)}`],
            ],
            theme: 'grid',
            headStyles: { fillColor: [107, 33, 168] }
        });

        // Detalle Hotel
        if (stats.hHoy.length > 0) {
            doc.addPage();
            doc.text("Detalle Ventas Hotel", 14, 15);
            autoTable(doc, {
                startY: 20,
                head: [["Fecha", "Habitación", "Cliente", "Total"]],
                body: stats.hHoy.map(v => [
                    format(new Date(v.fecha_pago || v.created_date), "dd/MM HH:mm"),
                    v.habitacion_numero || '-',
                    v.huesped_nombre || v.cliente_nombre || 'General',
                    `S/ ${Number(v.monto_pagado || v.total).toFixed(2)}`
                ]),
                headStyles: { fillColor: [41, 128, 185] }
            });
        }

        // Detalle Minimarket
        if (stats.pHoy.length > 0) {
            doc.addPage();
            doc.text("Detalle Ventas Minimarket", 14, 15);
            autoTable(doc, {
                startY: 20,
                head: [["Fecha", "Cliente", "Total"]],
                body: stats.pHoy.map(v => [
                    format(new Date(v.fecha_venta || v.created_date), "dd/MM HH:mm"),
                    v.huesped_nombre || v.cliente_nombre || 'General',
                    `S/ ${Number(v.total).toFixed(2)}`
                ]),
                headStyles: { fillColor: [230, 126, 34] }
            });
        }

        doc.save(`Cierre_Caja_${format(new Date(), "yyyyMMdd")}.pdf`);
    }, [hotelActual, user, stats]);

    const handleExportExcel = useCallback(async () => {
        const rows = [
            ...stats.hHoy.map(v => ['Ingreso', 'Hotel', format(new Date(v.fecha_pago || v.created_date), 'dd/MM/yyyy HH:mm'), v.huesped_nombre || v.cliente_nombre || 'General', v.habitacion_numero ? `Hab. ${v.habitacion_numero}` : 'Alojamiento', v.metodo_pago || 'efectivo', v.monto_pagado || v.total]),
            ...stats.pHoy.map(v => ['Ingreso', 'Minimarket', format(new Date(v.fecha_venta || v.created_date), 'dd/MM/yyyy HH:mm'), v.huesped_nombre || v.cliente_nombre || 'General', 'Venta POS', v.metodo_pago || 'efectivo', v.total]),
            ...stats.egHoy.map(e => ['Egreso', e.categoria || 'Operativo', format(new Date(e.fecha || e.created_date), 'dd/MM/yyyy HH:mm'), e.usuario_nombre || 'Staff', e.concepto || 'Egreso', 'efectivo', -Number(e.monto || 0)]),
        ];
        downloadCsv(`Cierre_Caja_${format(new Date(), 'yyyyMMdd')}.csv`, ['Movimiento', 'Origen', 'Fecha', 'Cliente / Responsable', 'Concepto', 'Medio de pago', 'Total'], rows);
    }, [hotelActual, user, stats]);

    return {
        handlePrintTicket,
        handlePrintHotel,
        handlePrintPOS,
        handleExportPDF,
        handleExportExcel
    };
}
