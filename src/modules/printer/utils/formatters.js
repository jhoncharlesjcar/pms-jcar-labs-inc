/**
 * Formats a number to currency string (PEN - S/)
 * @param {number} amount 
 * @returns {string} Formatted currency
 */
export const formatCurrency = (amount) => {
  if (isNaN(amount)) return 'S/ 0.00';
  return `S/ ${Number(amount).toFixed(2)}`;
};

/**
 * Formats a date to local string for printing
 * @param {string|Date} date 
 * @returns {string} Formatted date
 */
export const formatDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleString('es-PE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};

/**
 * Pads a string to a specific length to align text in monospace fonts
 * @param {string} str Original string
 * @param {number} length Target length
 * @param {string} [padChar=' '] Character to pad with
 * @param {boolean} [left=false] Pad left (align right) if true
 * @returns {string}
 */
export const padString = (str, length, padChar = ' ', left = false) => {
  const s = String(str || '');
  if (s.length >= length) return s.substring(0, length);
  if (left) {
    return s.padStart(length, padChar);
  }
  return s.padEnd(length, padChar);
};
