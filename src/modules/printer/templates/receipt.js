import { formatCurrency, formatDate } from '../utils/formatters.js';

/**
 * Generates the HTML content for a Receipt / Sale ticket
 * @param {import('../types/printer.types.js').PrintReceiptData} data 
 * @returns {string} HTML string
 */
export const buildReceiptTemplate = (data) => {
  const itemsHtml = data.items.map(item => `
    <tr>
      <td class="col-qty">${item.quantity}</td>
      <td class="col-desc">${item.description}</td>
      <td class="col-total">${formatCurrency(item.total)}</td>
    </tr>
  `).join('');

  // Generación de QR SUNAT regulatorio
  const rucEmisor = data.ruc || '20000000000';
  const tipoComp = data.receiptType?.toLowerCase().includes('factura') ? '01' : '03'; // 01 = Factura, 03 = Boleta
  const parts = (data.receiptNumber || 'B001-00000001').split('-');
  const serie = parts[0] || 'B001';
  const numero = parts[1] || '00000001';
  const totalVal = data.total || 0;
  const igvVal = data.igv !== undefined ? data.igv : (totalVal * 0.18 / 1.18); // fallback a igv del total
  const fechaStr = data.date ? new Date(data.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
  const docAdq = data.guestDocument || '00000000';
  const tipoDocAdq = docAdq.length === 11 ? '6' : '1'; // 6 = RUC, 1 = DNI
  
  const qrString = `${rucEmisor}|${tipoComp}|${serie}|${numero}|${Number(igvVal).toFixed(2)}|${Number(totalVal).toFixed(2)}|${fechaStr}|${tipoDocAdq}|${docAdq}|`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${encodeURIComponent(qrString)}`;

  return `
    <div class="text-center mb-2">
      <div class="hotel-name">${data.hotelName || 'HOTEL'}</div>
      <div>${data.address || ''}</div>
      ${data.ruc ? `<div>RUC: ${data.ruc}</div>` : ''}
      ${data.phone ? `<div>Tel: ${data.phone}</div>` : ''}
    </div>
    
    <div class="text-center bold uppercase mb-1">
      ${data.receiptType || 'TICKET DE VENTA'}
    </div>
    <div class="text-center mb-2">
      ${data.receiptNumber || ''}
    </div>
    
    <div class="divider"></div>
    
    <div class="mb-1">
      <div class="flex-row">
        <span>Fecha:</span>
        <span>${formatDate(data.date || new Date())}</span>
      </div>
      <div class="bold mt-1">Cliente:</div>
      <div>${data.guestName || 'Público en general'}</div>
    </div>
    
    <div class="divider"></div>
    
    <table class="table-items">
      <thead>
        <tr>
          <th class="col-qty">Cant</th>
          <th class="col-desc">Descrip.</th>
          <th class="col-total">Importe</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>
    
    <div class="divider-solid"></div>
    
    <div class="mb-2 text-right">
      ${data.igv !== undefined ? `
      <div class="flex-row mt-1">
        <span>Op. Gravada:</span>
        <span>${formatCurrency(data.subTotal)}</span>
      </div>
      <div class="flex-row">
        <span>IGV (18%):</span>
        <span>${formatCurrency(data.igv)}</span>
      </div>` : ''}
      
      <div class="flex-row bold mt-1" style="font-size: 14px;">
        <span>TOTAL:</span>
        <span>${formatCurrency(data.total)}</span>
      </div>
      
      ${data.paymentMethod ? `
      <div class="flex-row mt-2">
        <span>Pago con:</span>
        <span>${data.paymentMethod}</span>
      </div>` : ''}
    </div>
    
    <div class="divider-solid"></div>
    
    <!-- Bloque QR Regulatorio SUNAT -->
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; margin: 12px 0;">
      <img src="${qrUrl}" alt="QR SUNAT" style="width: 100px; height: 100px; margin: 4px auto;" />
      <div style="font-size: 8px; color: #555; margin-top: 4px; font-family: monospace;">Representación impresa de la Boleta Electrónica</div>
      <div style="font-size: 8px; color: #555; font-family: monospace;">Consulte en e-menu.sunat.gob.pe</div>
    </div>
    
    <div class="divider-solid"></div>
    
    <div class="text-center mt-2" style="font-size: 10px;">
      <div>Atendido por: ${data.receptionist || 'Admin'}</div>
      <div class="mt-1">¡Gracias por su compra!</div>
    </div>
  `;
};
