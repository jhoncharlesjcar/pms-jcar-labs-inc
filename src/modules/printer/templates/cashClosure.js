import { formatCurrency, formatDate } from '../utils/formatters.js';

/**
 * Generates the HTML content for a Cash Closure ticket
 * @param {object} data 
 * @returns {string} HTML string
 */
export const buildCashClosureTemplate = (data) => {
  const hotelList = (data.hotelSales || []).map(v => `
    <div class="flex-row" style="font-size: 10px;">
      <span>${v.habitacion_numero ? 'Hab. ' + v.habitacion_numero : 'Venta'}</span>
      <span>${formatCurrency(v.monto_pagado || v.total || 0)}</span>
    </div>
  `).join('');

  const posList = (data.posSales || []).map(v => `
    <div class="flex-row" style="font-size: 10px;">
      <span>${v.cliente_nombre ? v.cliente_nombre.substring(0,10) : 'Minimarket'}</span>
      <span>${formatCurrency(v.total || 0)}</span>
    </div>
  `).join('');

  const showHotel = !data.onlyPOS;
  const showPOS = !data.onlyHotel;
  const showSummary = !data.onlyHotel && !data.onlyPOS;

  return `
    <div class="text-center mb-2">
      <div class="hotel-name">${data.hotelName || 'HOTEL'}</div>
      <div>${data.address || ''}</div>
      <div class="bold mt-2 uppercase">${data.onlyHotel ? 'DETALLE VENTAS HOTEL' : data.onlyPOS ? 'DETALLE VENTAS MINIMARKET' : 'REPORTE DE CIERRE DE CAJA'}</div>
    </div>
    
    <div class="divider"></div>
    
    <div class="mb-1">
      <div class="flex-row">
        <span>Fecha:</span>
        <span>${formatDate(data.date || new Date())}</span>
      </div>
      <div class="flex-row">
        <span>Responsable:</span>
        <span>${data.userName || 'Admin'}</span>
      </div>
    </div>
    
    <div class="divider"></div>
    
    ${showHotel ? `
    <div class="bold mb-1 uppercase">Ventas Hotel (Alojamiento)</div>
    <div class="flex-row">
      <span>Transacciones:</span>
      <span>${data.hotelCount || 0}</span>
    </div>
    ${hotelList ? `<div class="mt-1">${hotelList}</div>` : ''}
    <div class="flex-row bold mt-1">
      <span>Subtotal Hotel:</span>
      <span>${formatCurrency(data.hotelTotal || 0)}</span>
    </div>
    ` : ''}
    
    ${showHotel && showPOS ? '<div class="divider-dotted mt-2 mb-2"></div>' : ''}
    
    ${showPOS ? `
    <div class="bold mb-1 uppercase">Ventas Minimarket (POS)</div>
    <div class="flex-row">
      <span>Transacciones:</span>
      <span>${data.posCount || 0}</span>
    </div>
    ${posList ? `<div class="mt-1">${posList}</div>` : ''}
    <div class="flex-row bold mt-1">
      <span>Subtotal POS:</span>
      <span>${formatCurrency(data.posTotal || 0)}</span>
    </div>
    ` : ''}
    
    ${showSummary ? `
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
    ` : ''}
    
    <div class="divider-solid mt-2 mb-2"></div>
    
    <div class="text-center mt-2" style="font-size: 10px;">
      <div>Reporte generado el ${formatDate(new Date())}</div>
      <div class="mt-4">_______________________</div>
      <div class="mt-1">Firma Responsable</div>
    </div>
  `;
};
