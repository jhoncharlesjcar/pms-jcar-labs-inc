import { formatCurrency, formatDate } from '../utils/formatters.js';

/**
 * Generates the HTML content for a Cash Closure ticket
 * @param {object} data 
 * @returns {string} HTML string
 */
export const buildCashClosureTemplate = (data) => {
  return `
    <div class="text-center mb-2">
      <div class="hotel-name">${data.hotelName || 'HOTEL'}</div>
      <div>${data.address || ''}</div>
      <div class="bold mt-2 uppercase">REPORTE DE CIERRE DE CAJA</div>
    </div>
    
    <div class="divider"></div>
    
    <div class="mb-1">
      <div class="flex-row">
        <span>Fecha Cierre:</span>
        <span>${formatDate(data.date || new Date())}</span>
      </div>
      <div class="flex-row">
        <span>Responsable:</span>
        <span>${data.userName || 'Admin'}</span>
      </div>
    </div>
    
    <div class="divider"></div>
    
    <div class="bold mb-1 uppercase">Ventas Hotel (Alojamiento)</div>
    <div class="flex-row">
      <span>Transacciones:</span>
      <span>${data.hotelCount || 0}</span>
    </div>
    <div class="flex-row bold">
      <span>Subtotal Hotel:</span>
      <span>${formatCurrency(data.hotelTotal || 0)}</span>
    </div>
    
    <div class="divider-dotted mt-2 mb-2"></div>
    
    <div class="bold mb-1 uppercase">Ventas Minimarket (POS)</div>
    <div class="flex-row">
      <span>Transacciones:</span>
      <span>${data.posCount || 0}</span>
    </div>
    <div class="flex-row bold">
      <span>Subtotal POS:</span>
      <span>${formatCurrency(data.posTotal || 0)}</span>
    </div>
    
    <div class="divider-dotted mt-2 mb-2"></div>
    
    <div class="bold mb-1 uppercase">Egresos / Gastos</div>
    <div class="flex-row">
      <span>Cant. Movimientos:</span>
      <span>${data.egresosCount || 0}</span>
    </div>
    <div class="flex-row bold">
      <span>Total Egresos:</span>
      <span style="color: #000;">- ${formatCurrency(data.egresosTotal || 0)}</span>
    </div>
    
    <div class="divider-solid mt-2 mb-2"></div>
    
    <div class="flex-row bold" style="font-size: 14px;">
      <span>SALDO FINAL CAJA:</span>
      <span>${formatCurrency(data.saldoFinal || 0)}</span>
    </div>
    
    <div class="divider-solid mt-2 mb-2"></div>
    
    <div class="text-center mt-2" style="font-size: 10px;">
      <div>Cierre generado el ${formatDate(new Date())}</div>
      <div class="mt-4">_______________________</div>
      <div class="mt-1">Firma Responsable</div>
    </div>
  `;
};
