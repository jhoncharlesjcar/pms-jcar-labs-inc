import { formatCurrency, formatDate } from '../utils/formatters.js';

/**
 * Generates the HTML content for a Check-Out ticket
 * @param {import('../types/printer.types.js').PrintCheckOutData} data 
 * @returns {string} HTML string
 */
export const buildCheckOutTemplate = (data) => {
  // Generación de QR SUNAT regulatorio para previsualización / comprobante de Check-out
  const rucEmisor = data.ruc || '20000000000';
  const tipoComp = '03'; // Predeterminado a Boleta en Check-out
  const serie = 'B001';
  const numero = data.ticketNumber?.replace(/\D/g, '') || '00000001';
  const totalVal = (data.totalRoomCost || 0) + (data.totalConsumptions || 0);
  const igvVal = totalVal * 0.18 / 1.18;
  const fechaStr = new Date().toISOString().split('T')[0];
  const docAdq = data.documentId || '00000000';
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
      -- TICKET CHECK-OUT --
    </div>
    ${data.ticketNumber ? `<div class="text-center mb-2">Nro: ${data.ticketNumber}</div>` : ''}
    
    <div class="divider"></div>
    
    <div class="mb-1">
      <div class="bold">Huésped:</div>
      <div>${data.guestName}</div>
      <div>Doc: ${data.documentId}</div>
    </div>
    
    <div class="divider"></div>
    
    <div class="mb-1">
      <div class="flex-row">
        <span>Habitación:</span>
        <span class="bold">${data.roomNumber}</span>
      </div>
      <div class="flex-row mt-1">
        <span>Ingreso:</span>
        <span>${formatDate(data.checkInDate)}</span>
      </div>
      <div class="flex-row">
        <span>Salida:</span>
        <span>${formatDate(data.checkOutDate)}</span>
      </div>
      <div class="flex-row">
        <span>Noches:</span>
        <span>${data.totalNights}</span>
      </div>
    </div>
    
    <div class="divider"></div>
    
    <div class="mb-2">
      <div class="flex-row">
        <span>Costo Hab.:</span>
        <span>${formatCurrency(data.totalRoomCost)}</span>
      </div>
      <div class="flex-row">
        <span>Consumos:</span>
        <span>${formatCurrency(data.totalConsumptions)}</span>
      </div>
    </div>
    
    <div class="divider-solid"></div>
    
    <div class="mb-2">
      <div class="flex-row bold mt-1">
        <span>TOTAL:</span>
        <span>${formatCurrency(data.totalRoomCost + data.totalConsumptions)}</span>
      </div>
      <div class="flex-row mt-1">
        <span>Abonado:</span>
        <span>${formatCurrency(data.totalPaid)}</span>
      </div>
      <div class="flex-row bold mt-1">
        <span>${data.balance > 0 ? 'FALTA PAGAR' : 'VUELTO'}:</span>
        <span>${formatCurrency(Math.abs(data.balance))}</span>
      </div>
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
      <div class="mt-1">¡Vuelva pronto!</div>
      <div class="mt-1">${formatDate(new Date())}</div>
    </div>
  `;
};
