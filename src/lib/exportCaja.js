import { format } from 'date-fns';
import logger from '@/lib/logger';

export async function exportCajaPDF(stats, hotelActual, user) {
    return new Promise((resolve, reject) => {
        const worker = new Worker(new URL('../workers/pdfWorker.js', import.meta.url), { type: 'module' });
        const taskId = Date.now().toString();

        worker.onmessage = (e) => {
            if (e.data.taskId === taskId) {
                if (e.data.success) {
                    const url = URL.createObjectURL(e.data.blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = e.data.filename;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    resolve(true);
                } else {
                    logger.error("Error en PDF Worker:", e.data.error);
                    reject(new Error(e.data.error));
                }
                worker.terminate();
            }
        };

        worker.onerror = (err) => {
            logger.error("Error crítico en PDF Worker:", err);
            reject(err);
            worker.terminate();
        };

        worker.postMessage({
            action: 'exportCajaPDF',
            taskId,
            payload: { stats, hotelActual, user }
        });
    });
}

export async function exportCajaExcel(stats, hotelActual, user) {
    const ExcelJS = (await import('exceljs')).default || await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    // Hoja 1: Resumen
    const wsRes = workbook.addWorksheet('Resumen');
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
    wsRes.addRows(resData);

    // Hoja 2: Detalle Hotel
    const wsHotel = workbook.addWorksheet('Ventas Hotel');
    const hotelData = stats.hHoy.map(v => ({
        Fecha: format(new Date(v.fecha_pago || v.created_date), "dd/MM/yyyy HH:mm"),
        Cliente: v.cliente_nombre || 'General',
        Concepto: v.habitacion_numero ? `Hab. ${v.habitacion_numero}` : 'Alojamiento',
        Total: v.monto_pagado || v.total
    }));
    wsHotel.columns = [
        { header: 'Fecha', key: 'Fecha' },
        { header: 'Cliente', key: 'Cliente' },
        { header: 'Concepto', key: 'Concepto' },
        { header: 'Total', key: 'Total' }
    ];
    wsHotel.addRows(hotelData);

    // Hoja 3: Detalle POS
    const wsPOS = workbook.addWorksheet('Minimarket');
    const posData = stats.pHoy.map(v => ({
        Fecha: format(new Date(v.created_date), "dd/MM/yyyy HH:mm"),
        Cliente: v.cliente_nombre || 'General',
        Total: v.total
    }));
    wsPOS.columns = [
        { header: 'Fecha', key: 'Fecha' },
        { header: 'Cliente', key: 'Cliente' },
        { header: 'Total', key: 'Total' }
    ];
    wsPOS.addRows(posData);

    await workbook.xlsx.writeFile(`Cierre_Caja_${format(new Date(), "yyyyMMdd")}.xlsx`);
}
