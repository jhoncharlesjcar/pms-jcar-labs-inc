/**
 * Generates an ESC/POS styled plain text ticket
 * 
 * @param {Object} data Ticket data
 * @param {number} lineWidth Character width (32 for 58mm, 48 for 80mm)
 * @returns {string} Plain text ticket string
 */
export const generatePlainTextTicket = (data, lineWidth = 32) => {
  const pad = (text, length, padChar = ' ', align = 'left') => {
    const str = String(text).substring(0, length);
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

  // Header
  ticket += pad(data.hotelName || 'HOTEL', lineWidth, ' ', 'center') + br();
  if (data.address) ticket += pad(data.address, lineWidth, ' ', 'center') + br();
  if (data.ruc) ticket += pad(`RUC: ${data.ruc}`, lineWidth, ' ', 'center') + br();
  ticket += line();
  
  // Title
  ticket += pad(data.title || 'TICKET', lineWidth, ' ', 'center') + br();
  if (data.ticketNumber) ticket += pad(`Nro: ${data.ticketNumber}`, lineWidth, ' ', 'center') + br();
  ticket += line();

  // Guest Info
  ticket += `Huesped: ${data.guestName || 'General'}`.substring(0, lineWidth) + br();
  if (data.documentId) ticket += `Doc: ${data.documentId}`.substring(0, lineWidth) + br();
  if (data.roomNumber) ticket += `Hab: ${data.roomNumber}`.substring(0, lineWidth) + br();
  ticket += line();

  // Items / details
  if (data.items && data.items.length > 0) {
    data.items.forEach(item => {
      // Format: Cant Descripcion ... Total
      const qty = String(item.quantity).padEnd(3, ' ');
      const total = Number(item.total).toFixed(2);
      const descLen = lineWidth - qty.length - total.length - 1;
      const desc = String(item.description).substring(0, descLen).padEnd(descLen, ' ');
      ticket += `${qty}${desc} ${total}\n`;
    });
    ticket += line();
  }

  // Totals
  if (data.subTotal !== undefined) {
    const stLabel = 'Subtotal:';
    const stVal = Number(data.subTotal).toFixed(2);
    ticket += pad(stLabel, lineWidth - stVal.length) + stVal + br();
  }

  if (data.descuento !== undefined) {
    const descLabel = 'Descuento:';
    const descVal = '-S/ ' + Number(data.descuento).toFixed(2);
    ticket += pad(descLabel, lineWidth - descVal.length) + descVal + br();
  }
  
  const totalLabel = 'TOTAL: S/ ';
  const totalVal = Number(data.total).toFixed(2);
  ticket += pad(totalLabel, lineWidth - totalVal.length) + totalVal + br();

  if (data.paymentMethod) {
    const payLabel = 'Pago:';
    const payVal = String(data.paymentMethod).toUpperCase();
    ticket += pad(payLabel, lineWidth - payVal.length) + payVal + br();
  }

  ticket += br();
  ticket += pad('¡Gracias por su preferencia!', lineWidth, ' ', 'center') + br();
  ticket += pad(new Date().toLocaleString('es-PE'), lineWidth, ' ', 'center') + br();
  ticket += br().repeat(4); // Feed lines for cutting

  return ticket;
};

/**
 * Detects if the current device is Android
 * @returns {boolean}
 */
export const isAndroid = () => {
  if (typeof navigator === 'undefined') return false;
  return /android/i.test(navigator.userAgent);
};

/**
 * Service to handle thermal printing via RawBT or Fallback
 * 
 * @param {Object} data - Ticket data payload
 * @param {number} [paperWidth=58] - Paper width in mm (58 or 80)
 * @returns {boolean} - Success status
 */
export const printThermalTicket = (data, paperWidth = 58) => {
  try {
    const lineWidth = paperWidth === 80 ? 48 : 32;
    const plainText = generatePlainTextTicket(data, lineWidth);

    if (isAndroid()) {
      // Android: Send via RawBT intent URL scheme
      // 1. Encode text to prevent UTF-8 corruption
      const encodedText = encodeURIComponent(plainText);
      const base64Text = btoa(unescape(encodedText));
      
      // 2. Dispatch rawbt:base64 URI scheme
      window.location.href = `rawbt:base64,${base64Text}`;
      return true;
    } else {
      // Desktop: Fallback to window.print using a temporary invisible container or simple alert
      console.log('Desktop detected. Printing via window.print()');
      
      // To strictly follow NO iframes, NO HTML canvas, we open a pure text popup and print it
      const printWindow = window.open('', '_blank', 'width=400,height=600');
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Print Ticket</title>
              <style>
                body { font-family: monospace; white-space: pre-wrap; font-size: 14px; margin: 0; padding: 10px; }
              </style>
            </head>
            <body>${plainText}</body>
          </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        // Short delay to allow render before print
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
        }, 250);
        return true;
      }
      return false;
    }
  } catch (err) {
    console.error('[ThermalPrinter Service] Error generating ticket:', err);
    return false;
  }
};
