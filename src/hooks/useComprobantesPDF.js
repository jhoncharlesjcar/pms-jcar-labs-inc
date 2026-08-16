// jsPDF, autoTable y QRCode se importan dinámicamente para evitar carga en todas las páginas
import { toast } from 'sonner';
import logger from '@/lib/logger';

/**
 * Hook to generate professional A4 PDF bills (Boleta/Factura)
 * compliant with SUNAT standards.
 */
export function useComprobantesPDF() {
  const generarPDF = async (ventaPos, hotel, requestedType) => {
    try {
      const [{ default: jsPDF }, { default: autoTable }, { default: QRCode }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
        import('qrcode'),
      ]);
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });
      const tipoComprobante = requestedType === 'factura' || ventaPos.tipo_comprobante === 'factura' ? 'factura' : 'boleta';
      const isSunatEmitted = ventaPos.estado_comprobante === 'sunat_emitido';
      const isSunatPending = ventaPos.estado_comprobante === 'sunat_pendiente';
      const documentLabel = isSunatEmitted
        ? (tipoComprobante === 'factura' ? 'FACTURA ELECTRÓNICA' : 'BOLETA DE VENTA ELECTRÓNICA')
        : (isSunatPending ? 'BORRADOR PENDIENTE SUNAT' : 'CONSTANCIA INTERNA DE PAGO');
      const rucEmisor = hotel.ruc || '20000000000';
      const tipoComp = tipoComprobante === 'factura' ? '01' : '03';

      const parts = (ventaPos.numero_ticket || '1').split('-');
      const serie = tipoComprobante === 'factura' ? 'F001' : 'B001';
      const numeroTicket = parts[1] || parts[0]?.replace(/\D/g, '') || '1';
      const numero = String(numeroTicket).padStart(8, '0');
      const displayNumber = isSunatEmitted ? `${serie}-${numero}` : `TICKET #${ventaPos.numero_ticket || numero}`;

      const aplicaIgv = hotel.aplica_igv !== false;
      const totalVal = Number(ventaPos.total || 0);
      const subtotalVal = aplicaIgv ? totalVal / 1.18 : totalVal;
      const igvVal = aplicaIgv ? totalVal - subtotalVal : 0;
      const fechaStr = ventaPos.fecha_venta ? new Date(ventaPos.fecha_venta).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

      const docAdq = tipoComprobante === 'factura' ? (ventaPos.ruc_cliente || '00000000000') : (ventaPos.huesped_dni || '00000000');
      const tipoDocAdq = docAdq.length === 11 ? '6' : '1';
      const nombreCliente = tipoComprobante === 'factura' ? (ventaPos.razon_social || 'CLIENTE FACTURA') : (ventaPos.huesped_nombre || 'Consumidor Final');

      // ── Cabecera Emisor ───────────────────────────────────────────────────
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(30, 30, 30);
      doc.text(hotel.nombre || 'HOSPEDAJE', 14, 22);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(80, 80, 80);
      let currY = 28;
      if (hotel.direccion) {
        doc.text(hotel.direccion, 14, currY);
        currY += 5;
      }
      if (hotel.ciudad) {
        doc.text(hotel.ciudad, 14, currY);
        currY += 5;
      }
      if (hotel.telefono || hotel.email) {
        doc.text(`Tel: ${hotel.telefono || '—'} | Email: ${hotel.email || '—'}`, 14, currY);
      }

      // ── Recuadro del Comprobante (Derecha) ───────────────────────────────
      doc.setDrawColor(180, 180, 180);
      doc.setFillColor(250, 250, 250);
      doc.rect(132, 14, 64, 32, 'FD');

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(30, 30, 30);
      doc.text(`R.U.C. ${rucEmisor}`, 136, 21);

      doc.setFontSize(9.5);
      const titleLines = doc.splitTextToSize(documentLabel, 56);
      doc.text(titleLines, 136, 27);

      doc.setFontSize(12);
      doc.setTextColor(147, 51, 234); // Morado primario
      doc.text(displayNumber, 136, 40);

      // ── Datos del Adquiriente ─────────────────────────────────────────────
      doc.setTextColor(0, 0, 0);
      doc.setDrawColor(220, 220, 220);
      doc.line(14, 52, 196, 52);

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('DATOS DEL ADQUIRIENTE', 14, 57);

      doc.setFont('Helvetica', 'normal');
      doc.text(`Señor(es): ${nombreCliente}`, 14, 63);
      doc.text(`${tipoComprobante === 'factura' ? 'R.U.C.' : 'DNI / Documento'}: ${docAdq}`, 14, 68);
      doc.text(`${isSunatEmitted ? 'Fecha Emisión' : 'Fecha de venta'}: ${fechaStr}`, 14, 73);
      doc.text(`Moneda: SOLES (PEN)`, 14, 78);
      doc.text(`Forma de Pago: Contado | Método: ${(ventaPos.metodo_pago || 'efectivo').toUpperCase()}`, 14, 83);

      doc.line(14, 87, 196, 87);

      // ── Tabla de Ítems ───────────────────────────────────────────────────
      const items = [];
      if (ventaPos.subtotal_estadia > 0) {
        items.push([
          '1.00',
          'NIU',
          `Servicio de Hospedaje Hab. ${ventaPos.habitacion_numero || ''}`,
          Number(ventaPos.subtotal_estadia).toFixed(2),
          Number(ventaPos.subtotal_estadia).toFixed(2),
        ]);
      }
      (ventaPos.items || []).forEach((it) => {
        const qty = Number(it.cantidad || 1);
        const price = Number(it.precio || it.precio_venta || 0);
        const sub = qty * price;
        items.push([
          qty.toFixed(2),
          'NIU',
          it.nombre || it.descripcion || 'Producto/Consumo',
          price.toFixed(2),
          sub.toFixed(2),
        ]);
      });

      autoTable(doc, {
        startY: 91,
        head: [['Cant.', 'Medida', 'Descripción', 'P. Unitario', 'Importe']],
        body: items,
        theme: 'striped',
        headStyles: { fillColor: [147, 51, 234], textColor: [255, 255, 255] }, // Morado primary
        columnStyles: {
          0: { cellWidth: 15, halign: 'center' },
          1: { cellWidth: 18, halign: 'center' },
          2: { cellWidth: 110 },
          3: { cellWidth: 22, halign: 'right' },
          4: { cellWidth: 22, halign: 'right' },
        },
        styles: { fontSize: 8.5 },
      });

      const finalY = doc.lastAutoTable.finalY + 8;

      // ── Totales ──────────────────────────────────────────────────────────
      const rightX = 196;
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9);

      let totY = finalY;
      if (aplicaIgv) {
        doc.text('OP. GRAVADA:', 130, totY);
        doc.text(`S/ ${subtotalVal.toFixed(2)}`, rightX, totY, { align: 'right' });
        totY += 5;
        doc.text('I.G.V. 18.00%:', 130, totY);
        doc.text(`S/ ${igvVal.toFixed(2)}`, rightX, totY, { align: 'right' });
        totY += 5;
      } else {
        doc.text('OP. EXONERADA:', 130, totY);
        doc.text(`S/ ${totalVal.toFixed(2)}`, rightX, totY, { align: 'right' });
        totY += 5;
      }

      if (Number(ventaPos.descuento) > 0) {
        doc.text('DESCUENTO:', 130, totY);
        doc.text(`-S/ ${Number(ventaPos.descuento).toFixed(2)}`, rightX, totY, { align: 'right' });
        totY += 5;
      }

      doc.setFont('Helvetica', 'bold');
      doc.text('IMPORTE TOTAL:', 130, totY);
      doc.text(`S/ ${totalVal.toFixed(2)}`, rightX, totY, { align: 'right' });

      const qrY = totY + 8;
      if (isSunatEmitted) {
        // El QR regulatorio solo aparece después de una aceptación real de SUNAT.
        const qrString = `${rucEmisor}|${tipoComp}|${serie}|${numero}|${igvVal.toFixed(2)}|${totalVal.toFixed(2)}|${fechaStr}|${tipoDocAdq}|${docAdq}|`;
        const qrDataUrl = await QRCode.toDataURL(qrString, { margin: 1 });
        if (qrY + 30 < 287) {
          doc.addImage(qrDataUrl, 'PNG', 14, qrY, 28, 28);
          doc.setFont('Helvetica', 'normal');
          doc.setFontSize(7.5);
          doc.setTextColor(120, 120, 120);
          doc.text('Representación impresa del Comprobante de Pago Electrónico.', 45, qrY + 10);
          doc.text('Puede verificar este comprobante en el portal de consulta de la SUNAT.', 45, qrY + 14);
          if (hotel.mensaje_ticket) {
            doc.text(hotel.mensaje_ticket, 45, qrY + 18);
          }
        } else {
          doc.addPage();
          doc.addImage(qrDataUrl, 'PNG', 14, 20, 28, 28);
          doc.setFont('Helvetica', 'normal');
          doc.setFontSize(7.5);
          doc.setTextColor(120, 120, 120);
          doc.text('Representación impresa del Comprobante de Pago Electrónico.', 45, 30);
          doc.text('Puede verificar este comprobante en el portal de consulta de la SUNAT.', 45, 34);
          if (hotel.mensaje_ticket) {
            doc.text(hotel.mensaje_ticket, 45, 38);
          }
        }
      } else {
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(146, 64, 14);
        doc.text(isSunatPending ? 'PENDIENTE DE EMISIÓN SUNAT' : 'CONSTANCIA INTERNA DE PAGO', 14, qrY + 8);
        doc.setFont('Helvetica', 'bold');
        doc.text('Este documento no es un comprobante tributario.', 14, qrY + 13);
        if (hotel.mensaje_ticket) {
          doc.setFont('Helvetica', 'normal');
          doc.setTextColor(120, 120, 120);
          doc.text(hotel.mensaje_ticket, 14, qrY + 18);
        }
      }

      // Guardar PDF
      const filename = `${isSunatEmitted ? `${tipoComprobante}_${serie}_${numero}` : `constancia_${numero}`}.pdf`;
      doc.save(filename);
      toast.success(`${isSunatEmitted ? tipoComprobante.toUpperCase() : 'Constancia'} descargada con éxito`);
      return filename;
    } catch (err) {
      logger.error('Error generando PDF:', err);
      toast.error('Error al generar el PDF del comprobante');
      throw err;
    }
  };

  return { generarPDF };
}
