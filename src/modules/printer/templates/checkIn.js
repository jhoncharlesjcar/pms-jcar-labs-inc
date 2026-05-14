import { formatCurrency, formatDate } from '../utils/formatters.js';

/**
 * Generates the HTML content for a Check-In ticket
 * @param {import('../types/printer.types.js').PrintCheckInData} data 
 * @returns {string} HTML string
 */
export const buildCheckInTemplate = (data) => {
  return `
    <div class="text-center mb-2">
      <div class="hotel-name">${data.hotelName || 'HOTEL'}</div>
      <div>${data.address || ''}</div>
      ${data.ruc ? `<div>RUC: ${data.ruc}</div>` : ''}
      ${data.phone ? `<div>Tel: ${data.phone}</div>` : ''}
    </div>
    
    <div class="text-center bold uppercase mb-1">
      -- TICKET CHECK-IN --
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
      <div class="flex-row">
        <span>Tipo:</span>
        <span>${data.roomType}</span>
      </div>
      <div class="flex-row mt-1">
        <span>Ingreso:</span>
        <span>${formatDate(data.checkInDate)}</span>
      </div>
      ${data.checkOutDate ? `
      <div class="flex-row">
        <span>Salida est.:</span>
        <span>${formatDate(data.checkOutDate)}</span>
      </div>` : ''}
    </div>
    
    <div class="divider"></div>
    
    <div class="flex-row bold mb-2">
      <span>Tarifa/Noche:</span>
      <span>${formatCurrency(data.pricePerNight)}</span>
    </div>
    
    <div class="divider-solid"></div>
    
    <div class="text-center mt-2" style="font-size: 10px;">
      <div>Atendido por: ${data.receptionist || 'Admin'}</div>
      <div class="mt-1">¡Gracias por su preferencia!</div>
      <div class="mt-1">${formatDate(new Date())}</div>
    </div>
  `;
};
