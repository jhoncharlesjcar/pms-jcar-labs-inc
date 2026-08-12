/**
 * Printer Module Public API
 * Exposes methods to handle thermal printing via RawBT on Android PWAs.
 * 
 * Usage:
 * import { printCheckInTicket, printCheckOutTicket, printReceipt } from '@/modules/printer';
 */

// Export core printing logic if needed for custom templates
export { printRawBT } from './utils/rawbt.js';
export { generateThermalTicket } from './templates/base.js';

// Export high-level domain services
export {
  printCheckInTicket,
  printCheckOutTicket,
  printReceipt
} from './services/printer.service.js';

// Export formatters for external utility if necessary
export {
  formatCurrency,
  formatDate
} from './utils/formatters.js';

export { printEscPos } from './services/printEscPos.js';
