import { useCallback } from 'react';
import { format } from 'date-fns';
import { printCashClosure } from '@/modules/printer/services/printer.service';
// jsPDF y XLSX se importan dinámicamente para evitar carga en todas las páginas

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
            ["SALDO FINAL", "", `S/ ${stats.balance.toFixed(2)}`]
        ];

        autoTable(doc, {
            startY: 45,
            head: [summaryData[0]],
            body: summaryData.slice(1),
            theme: 'striped',
            headStyles: { fillColor: [0, 112, 65] }
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
                    v.cliente_nombre || 'General',
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
                    format(new Date(v.created_date), "dd/MM HH:mm"),
                    v.cliente_nombre || 'General',
                    `S/ ${Number(v.total).toFixed(2)}`
                ]),
                headStyles: { fillColor: [230, 126, 34] }
            });
        }

        doc.save(`Cierre_Caja_${format(new Date(), "yyyyMMdd")}.pdf`);
    }, [hotelActual, user, stats]);

    const handleExportExcel = useCallback(async () => {
        const XLSX = await import('xlsx');
        const wb = XLSX.utils.book_new();
        
        // Hoja 1: Resumen
        const resData = [
            ["REPORTE DE CIERRE DE CAJA"],
            ["Hotel", hotelActual?.nombre],
            ["Fecha", format(new Date(), "dd/MM/yyyy HH:mm")],
            ["Responsable", user?.full_name || user?.email],
            [],
            ["CATEGORÍA", "TRANSACCIONES", "TOTAL"],
            ["Ventas Hotel", stats.countHotel, stats.hotel],
            ["Ventas Minimarket", stats.countPOS, stats.pos],
            ["Egresos", stats.countEgresos, stats.egresos],
            ["SALDO FINAL", "", stats.balance]
        ];
        const wsRes = XLSX.utils.aoa_to_sheet(resData);
        XLSX.utils.book_append_sheet(wb, wsRes, "Resumen");

        // Hoja 2: Detalle Hotel
        const hotelData = stats.hHoy.map(v => ({
            Fecha: format(new Date(v.fecha_pago || v.created_date), "dd/MM/yyyy HH:mm"),
            Cliente: v.cliente_nombre || 'General',
            Concepto: v.habitacion_numero ? `Hab. ${v.habitacion_numero}` : 'Alojamiento',
            Total: v.monto_pagado || v.total
        }));
        const wsHotel = XLSX.utils.json_to_sheet(hotelData);
        XLSX.utils.book_append_sheet(wb, wsHotel, "Ventas Hotel");

        // Hoja 3: Detalle POS
        const posData = stats.pHoy.map(v => ({
            Fecha: format(new Date(v.created_date), "dd/MM/yyyy HH:mm"),
            Cliente: v.cliente_nombre || 'General',
            Total: v.total
        }));
        const wsPOS = XLSX.utils.json_to_sheet(posData);
        XLSX.utils.book_append_sheet(wb, wsPOS, "Minimarket");

        XLSX.writeFile(wb, `Cierre_Caja_${format(new Date(), "yyyyMMdd")}.xlsx`);
    }, [hotelActual, user, stats]);

    return {
        handlePrintTicket,
        handlePrintHotel,
        handlePrintPOS,
        handleExportPDF,
        handleExportExcel
    };
}
