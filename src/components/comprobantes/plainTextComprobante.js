/**
 * Ticket SUNAT / interno en texto plano (32 columnas).
 * @param {any} ventaPos
 * @param {any} hotel
 * @param {string} tipoComprobante
 * @param {string} rucCliente
 * @param {string} razonSocial
 * @param {string} dniCliente
 * @param {string} nombreCliente
 * @param {string} hash
 * @param {number} [lineWidth]
 */
export function generatePlainTextComprobante(ventaPos, hotel, tipoComprobante, rucCliente, razonSocial, dniCliente, nombreCliente, hash, lineWidth = 32) {
    const pad = (text, length, padChar = ' ', align = 'left') => {
        const str = String(text || '').substring(0, length);
        if (align === 'center') {
            const leftPad = Math.floor((length - str.length) / 2);
            const rightPad = length - str.length - leftPad;
            return padChar.repeat(leftPad) + str + padChar.repeat(rightPad);
        }
        if (align === 'right') return str.padStart(length, padChar);
        return str.padEnd(length, padChar);
    };

    const line = () => '-'.repeat(lineWidth) + '\n';
    const br = () => '\n';

    let ticket = '';

    ticket += pad(hotel.nombre || 'HOSPEDAJE', lineWidth, ' ', 'center') + br();
    if (hotel.ruc) ticket += pad(`RUC: ${hotel.ruc}`, lineWidth, ' ', 'center') + br();
    if (hotel.direccion) ticket += pad(hotel.direccion, lineWidth, ' ', 'center') + br();
    if (hotel.ciudad) ticket += pad(hotel.ciudad, lineWidth, ' ', 'center') + br();
    if (hotel.telefono) ticket += pad(`Tel: ${hotel.telefono}`, lineWidth, ' ', 'center') + br();
    ticket += line();

    const isSunatEmitted = ventaPos.estado_comprobante === 'sunat_emitido';
    const isSunatPending = ventaPos.estado_comprobante === 'sunat_pendiente';
    const tipoLabel = isSunatEmitted
        ? (tipoComprobante === 'factura' ? 'FACTURA ELECTRÓNICA' : 'BOLETA DE VENTA ELECTRÓNICA')
        : (isSunatPending ? 'BORRADOR PENDIENTE SUNAT' : 'TICKET INTERNO');
    const serieNum = isSunatEmitted
        ? `${tipoComprobante === 'factura' ? 'F001' : 'B001'}-${String(ventaPos.numero_ticket || '1').replace(/\D/g, '').padStart(8, '0')}`
        : `TICKET #${ventaPos.numero_ticket || '1'}`;
    ticket += pad(tipoLabel, lineWidth, ' ', 'center') + br();
    ticket += pad(serieNum, lineWidth, ' ', 'center') + br();
    ticket += line();

    ticket += `Fecha: ${new Date(ventaPos.fecha_venta || new Date()).toLocaleDateString('es-PE')}\n`;
    ticket += `Pago: ${(ventaPos.metodo_pago || 'efectivo').toUpperCase()}\n`;

    if (tipoComprobante === 'factura') {
        ticket += `RUC: ${rucCliente || '—'}\n`;
        ticket += `Razon: ${razonSocial || '—'}\n`;
    } else {
        ticket += `Cliente: ${nombreCliente || 'Consumidor Final'}\n`;
        if (dniCliente) ticket += `DNI/Doc: ${dniCliente}\n`;
    }
    ticket += line();

    ticket += pad('Cant U.M. Descrip.', lineWidth - 8) + ' ' + pad('Importe', 7, ' ', 'right') + '\n';
    ticket += line();

    if (ventaPos.subtotal_estadia > 0) {
        const qty = '1.00';
        const um = 'NIU';
        const desc = `Hab.${ventaPos.habitacion_numero || ''}`;
        const subtotal = Number(ventaPos.subtotal_estadia).toFixed(2);
        const prefix = `${qty} ${um} ${desc}`;
        const remainingSpace = lineWidth - subtotal.length - 1;
        ticket += pad(prefix, remainingSpace) + ' ' + subtotal + '\n';
    }
    const items = Array.isArray(ventaPos.items) ? ventaPos.items : [];
    items.forEach((item) => {
        const qty = Number(item.cantidad || 1).toFixed(2);
        const um = 'UND';
        const desc = String(item.nombre || item.descripcion || 'Prod');
        const subtotal = (Number(item.precio || item.precio_venta || 0) * Number(item.cantidad || 1)).toFixed(2);
        const prefix = `${qty} ${um} ${desc}`;
        const remainingSpace = lineWidth - subtotal.length - 1;
        ticket += pad(prefix, remainingSpace) + ' ' + subtotal + '\n';
    });
    ticket += line();

    const totalVal = Number(ventaPos.total || 0).toFixed(2);
    if (hotel.aplica_igv !== false) {
        const baseVal = (Number(ventaPos.total || 0) / 1.18).toFixed(2);
        const igvVal = (Number(ventaPos.total || 0) - Number(baseVal)).toFixed(2);
        ticket += pad('OP. GRAVADAS:', lineWidth - baseVal.length - 1) + ' ' + baseVal + '\n';
        ticket += pad('IGV 18%:', lineWidth - igvVal.length - 1) + ' ' + igvVal + '\n';
    } else {
        ticket += pad('OP. EXONERADA:', lineWidth - totalVal.length - 1) + ' ' + totalVal + '\n';
        ticket += pad('(Exonerado Ley Amazonia N.27037)', lineWidth, ' ', 'center') + br();
    }
    ticket += pad('TOTAL: S/', lineWidth - totalVal.length - 1) + ' ' + totalVal + '\n';
    ticket += line();

    if (hash) {
        ticket += `Hash: ${hash}\n`;
        ticket += line();
    }

    if (isSunatEmitted) {
        ticket += pad('Representacion Impresa', lineWidth, ' ', 'center') + br();
        ticket += pad(`de la ${tipoComprobante === 'factura' ? 'Factura' : 'Boleta'} Electronica`, lineWidth, ' ', 'center') + br();
        ticket += pad('Verifica en:', lineWidth, ' ', 'center') + br();
        ticket += pad('e-consulta.sunat.gob.pe', lineWidth, ' ', 'center') + br();
    } else {
        ticket += pad(isSunatPending ? 'PENDIENTE DE EMISION SUNAT' : 'CONSTANCIA INTERNA DE PAGO', lineWidth, ' ', 'center') + br();
        ticket += pad('NO ES COMPROBANTE TRIBUTARIO', lineWidth, ' ', 'center') + br();
    }
    if (hotel.mensaje_ticket) {
        ticket += br() + pad(hotel.mensaje_ticket, lineWidth, ' ', 'center') + br();
    }
    ticket += br().repeat(4);

    return ticket;
}
