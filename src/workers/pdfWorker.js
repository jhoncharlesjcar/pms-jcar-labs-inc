import { format } from 'date-fns';

self.onmessage = async (e) => {
    const { action, payload, taskId } = e.data;
    
    try {
        if (action === 'exportMincetur') {
            const { reserva, hotelInfo } = payload;
            
            const jsPDFModule = await import('jspdf');
            const jsPDF = jsPDFModule.default || jsPDFModule.jsPDF;
            const autoTableModule = await import('jspdf-autotable');
            const autoTable = autoTableModule.default;

            const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            const pageWidth = doc.internal.pageSize.getWidth();

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(14);
            doc.text('FICHA DE REGISTRO DE HUÉSPEDES', pageWidth / 2, 20, { align: 'center' });
            
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text('ANEXO N° 4 - DIRCETUR', pageWidth / 2, 26, { align: 'center' });

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.text(`ESTABLECIMIENTO: ${hotelInfo.nombre}`, 14, 40);
            if (hotelInfo.ruc) {
                doc.text(`RUC: ${hotelInfo.ruc}`, 14, 46);
            }

            doc.setFont('helvetica', 'normal');
            doc.text(`N° Habitación: ${reserva.habitacion_numero || ''}`, 14, 56);
            doc.text(`Fecha de Ingreso: ${reserva.fecha_entrada ? format(new Date(reserva.fecha_entrada + 'T12:00:00'), 'dd/MM/yyyy') : ''}`, 14, 62);
            doc.text(`Fecha de Salida: ${reserva.fecha_salida ? format(new Date(reserva.fecha_salida + 'T12:00:00'), 'dd/MM/yyyy') : ''}`, 120, 62);

            autoTable(doc, {
                startY: 70,
                theme: 'grid',
                headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
                styles: { fontSize: 9, cellPadding: 3 },
                body: [
                    ['NOMBRES Y APELLIDOS', reserva.huesped_nombre || ''],
                    ['TIPO Y NÚMERO DE DOCUMENTO', `${reserva.tipo_documento || 'DNI'}: ${reserva.huesped_dni || ''}`],
                    ['NACIONALIDAD', reserva.nacionalidad || ''],
                    ['FECHA DE NACIMIENTO', reserva.huesped_fecha_nacimiento ? format(new Date(reserva.huesped_fecha_nacimiento + 'T12:00:00'), 'dd/MM/yyyy') : ''],
                    ['PROFESIÓN U OCUPACIÓN', reserva.huesped_profesion || ''],
                    ['ESTADO CIVIL', reserva.huesped_estado_civil ? reserva.huesped_estado_civil.toUpperCase() : ''],
                    ['LUGAR DE PROCEDENCIA', reserva.huesped_procedencia || ''],
                    ['LUGAR DE DESTINO', reserva.huesped_destino || ''],
                    ['MOTIVO DE VIAJE', reserva.motivo_viaje ? reserva.motivo_viaje.toUpperCase() : '']
                ],
                columnStyles: {
                    0: { fontStyle: 'bold', cellWidth: 70 },
                    1: { cellWidth: 110 }
                }
            });

            const finalY = doc.lastAutoTable?.finalY || 160;
            doc.setFont('helvetica', 'bold');
            doc.text('OBSERVACIONES / DATOS DE MENORES ACOMPAÑANTES:', 14, finalY + 10);
            doc.setFont('helvetica', 'normal');
            
            const obsText = reserva.observaciones || 'Ninguna.';
            const splitObs = doc.splitTextToSize(obsText, pageWidth - 28);
            doc.text(splitObs, 14, finalY + 16);

            const signY = finalY + 50 + (splitObs.length * 5);
            
            doc.line(30, signY, 80, signY);
            doc.text('Firma del Huésped', 55, signY + 5, { align: 'center' });

            doc.line(130, signY, 180, signY);
            doc.text('Firma del Recepcionista', 155, signY + 5, { align: 'center' });

            const filename = `Ficha_DIRCETUR_${reserva.huesped_nombre?.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`;
            
            // En lugar de hacer doc.save(), enviamos el Blob al main thread para que no bloquee
            const blob = doc.output('blob');
            self.postMessage({ taskId, success: true, blob, filename });
        } else if (action === 'exportCajaPDF') {
            const { stats, hotelActual, user } = payload;
            
            const jsPDFModule = await import('jspdf');
            const jsPDF = jsPDFModule.default || jsPDFModule.jsPDF;
            const autoTableModule = await import('jspdf-autotable');
            const autoTable = autoTableModule.default;
            
            const doc = new jsPDF();
            const now = format(new Date(), "dd/MM/yyyy HH:mm");

            doc.setFontSize(20);
            doc.text("Reporte de Cierre de Caja", 105, 15, { align: 'center' });
            
            doc.setFontSize(10);
            doc.text(`Hotel: ${hotelActual?.nombre || 'General'}`, 14, 25);
            doc.text(`Fecha: ${now}`, 14, 30);
            doc.text(`Responsable: ${user?.full_name || user?.email}`, 14, 35);

            const summaryData = [
                ["Categoría", "Transacciones", "Total"],
                ["Ventas Hotel", stats.countHotel, `S/ ${stats.hotel.toFixed(2)}`],
                ["Ventas Minimarket", stats.countPOS, `S/ ${stats.pos.toFixed(2)}`],
                ["Egresos / Gastos", stats.countEgresos, `- S/ ${stats.egresos.toFixed(2)}`],
                ["Ingresos Efectivo", "", `S/ ${stats.metodos.efectivo.toFixed(2)}`],
                ["Ingresos Yape", "", `S/ ${stats.metodos.yape.toFixed(2)}`],
                ["Ingresos Plin", "", `S/ ${stats.metodos.plin.toFixed(2)}`],
                ["Ingresos Tarjeta", "", `S/ ${stats.metodos.tarjeta.toFixed(2)}`],
                ["Ingresos Transf.", "", `S/ ${stats.metodos.transferencia.toFixed(2)}`],
                ["SALDO EFECTIVO EN CAJA", "", `S/ ${stats.balanceEfectivo.toFixed(2)}`],
                ["BALANCE TOTAL", "", `S/ ${stats.balance.toFixed(2)}`]
            ];

            autoTable(doc, {
                startY: 45,
                head: [summaryData[0]],
                body: summaryData.slice(1, 4),
                theme: 'striped',
                headStyles: { fillColor: [0, 112, 65] }
            });

            autoTable(doc, {
                startY: doc.lastAutoTable.finalY + 10,
                head: [["Desglose por Métodos de Pago", "Monto"]],
                body: summaryData.slice(4, 9).map(row => [row[0], row[2]]),
                theme: 'grid',
                headStyles: { fillColor: [41, 128, 185] }
            });

            autoTable(doc, {
                startY: doc.lastAutoTable.finalY + 10,
                body: summaryData.slice(9),
                theme: 'plain',
                styles: { fontStyle: 'bold', fontSize: 11, textColor: [0, 112, 65] }
            });

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

            const filename = `Cierre_Caja_${format(new Date(), "yyyyMMdd")}.pdf`;
            const blob = doc.output('blob');
            self.postMessage({ taskId, success: true, blob, filename });
        }
    } catch (error) {
        self.postMessage({ taskId, success: false, error: error.message });
    }
};
