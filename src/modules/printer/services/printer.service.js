import { printRawBT } from '../utils/rawbt.js';
import { generateThermalTicket } from '../templates/base.js';
import logger from '@/lib/logger';
import { buildCheckInTemplate } from '../templates/checkIn.js';
import { buildCheckOutTemplate } from '../templates/checkOut.js';
import { buildReceiptTemplate } from '../templates/receipt.js';
import { buildCashClosureTemplate } from '../templates/cashClosure.js';

/**
 * Printer Service Module
 * Provides isolated methods to generate and send thermal printing intents
 * without coupling to the application's global state.
 */

/**
 * Validates, wraps, and sends raw HTML to the thermal printer
 * @param {string} innerHtml - The specific ticket HTML
 * @returns {boolean} True if successfully sent to RawBT
 */
const printHTML = (innerHtml) => {
  if (!innerHtml) return false;
  const fullHtmlDocument = generateThermalTicket(innerHtml);
  return printRawBT(fullHtmlDocument);
};

/**
 * Generates and prints a Check-In ticket
 * @param {import('../types/printer.types.js').PrintCheckInData} data 
 * @returns {boolean}
 */
export const printCheckInTicket = (data) => {
  try {
    const html = buildCheckInTemplate(data);
    return printHTML(html);
  } catch (error) {
    logger.error('[Printer Service] Error printing check-in ticket:', error);
    return false;
  }
};

/**
 * Generates and prints a Check-Out ticket
 * @param {import('../types/printer.types.js').PrintCheckOutData} data 
 * @returns {boolean}
 */
export const printCheckOutTicket = (data) => {
  try {
    const html = buildCheckOutTemplate(data);
    return printHTML(html);
  } catch (error) {
    logger.error('[Printer Service] Error printing check-out ticket:', error);
    return false;
  }
};

/**
 * Generates and prints a general Receipt or POS ticket
 * @param {import('../types/printer.types.js').PrintReceiptData} data 
 * @returns {boolean}
 */
export const printReceipt = (data) => {
  try {
    const html = buildReceiptTemplate(data);
    return printHTML(html);
  } catch (error) {
    logger.error('[Printer Service] Error printing receipt ticket:', error);
    return false;
  }
};

/**
 * Generates and prints a Cash Closure report
 * @param {object} data 
 * @returns {boolean}
 */
export const printCashClosure = (data) => {
  try {
    const html = buildCashClosureTemplate(data);
    return printHTML(html);
  } catch (error) {
    logger.error('[Printer Service] Error printing cash closure:', error);
    return false;
  }
};
