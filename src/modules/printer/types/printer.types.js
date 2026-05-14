/**
 * @typedef {Object} PrintCheckInData
 * @property {string} hotelName
 * @property {string} address
 * @property {string} phone
 * @property {string} ruc
 * @property {string} guestName
 * @property {string} documentId
 * @property {string} roomNumber
 * @property {string} roomType
 * @property {string} checkInDate
 * @property {string} [checkOutDate]
 * @property {number} pricePerNight
 * @property {string} [receptionist]
 * @property {string} [ticketNumber]
 */

/**
 * @typedef {Object} PrintCheckOutData
 * @property {string} hotelName
 * @property {string} address
 * @property {string} phone
 * @property {string} ruc
 * @property {string} guestName
 * @property {string} documentId
 * @property {string} roomNumber
 * @property {string} checkInDate
 * @property {string} checkOutDate
 * @property {number} totalNights
 * @property {number} totalRoomCost
 * @property {number} totalConsumptions
 * @property {number} totalPaid
 * @property {number} balance
 * @property {string} [receptionist]
 * @property {string} [ticketNumber]
 */

/**
 * @typedef {Object} ReceiptItem
 * @property {string} description
 * @property {number} quantity
 * @property {number} unitPrice
 * @property {number} total
 */

/**
 * @typedef {Object} PrintReceiptData
 * @property {string} hotelName
 * @property {string} address
 * @property {string} phone
 * @property {string} ruc
 * @property {string} guestName
 * @property {string} date
 * @property {string} receiptType - e.g., 'BOLETA', 'FACTURA', 'TICKET'
 * @property {string} receiptNumber
 * @property {ReceiptItem[]} items
 * @property {number} subTotal
 * @property {number} igv
 * @property {number} total
 * @property {string} [paymentMethod]
 * @property {string} [receptionist]
 */

export const PRINTER_TYPES = {};
