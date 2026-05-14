/**
 * Base thermal ticket wrapper template.
 * Defines the core CSS and HTML structure optimized for 58mm printers.
 * 
 * @param {string} innerHtml - The specific content of the ticket
 * @returns {string} The complete HTML document ready for printing
 */
export const generateThermalTicket = (innerHtml) => {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ticket Termico</title>
  <style>
    /* Reset & Base configuration for 58mm */
    body {
      margin: 0;
      padding: 0;
      width: 100%;
      background: #fff;
      color: #000;
      font-family: 'Courier New', Courier, monospace; /* Ideal for thermal */
      font-size: 12px;
      line-height: 1.2;
    }
    
    /* 58mm is roughly 48mm of printable area ~ 180px-200px at normal dpi, 
       but we use 100% with a reasonable max-width to let RawBT scale it */
    .ticket-container {
      width: 100%;
      max-width: 58mm; /* RawBT handles mm directly */
      margin: 0 auto;
      padding: 0;
      box-sizing: border-box;
    }

    /* Utilities */
    .text-center { text-align: center; }
    .text-left { text-align: left; }
    .text-right { text-align: right; }
    .bold { font-weight: bold; }
    .uppercase { text-transform: uppercase; }
    .mb-1 { margin-bottom: 4px; }
    .mb-2 { margin-bottom: 8px; }
    .mt-1 { margin-top: 4px; }
    .mt-2 { margin-top: 8px; }
    
    /* Structure elements */
    .divider {
      border-top: 1px dashed #000;
      margin: 6px 0;
      width: 100%;
    }
    .divider-solid {
      border-top: 1px solid #000;
      margin: 6px 0;
      width: 100%;
    }
    
    /* Flexbox works well for receipts on RawBT with standard Android Webview */
    .flex-row {
      display: flex;
      justify-content: space-between;
      width: 100%;
    }
    
    /* Header/Footer specific */
    .hotel-name {
      font-size: 16px;
      font-weight: bold;
      margin-bottom: 4px;
    }
    
    .table-items {
      width: 100%;
      border-collapse: collapse;
      margin: 6px 0;
    }
    .table-items th {
      border-bottom: 1px dashed #000;
      text-align: left;
      font-weight: bold;
      padding-bottom: 2px;
    }
    .table-items td {
      padding: 2px 0;
      vertical-align: top;
    }
    .table-items .col-qty { width: 15%; text-align: center; }
    .table-items .col-desc { width: 50%; }
    .table-items .col-total { width: 35%; text-align: right; }
    
    /* Prevent cutting off text */
    * {
      word-break: break-word;
    }
  </style>
</head>
<body>
  <div class="ticket-container">
    ${innerHtml}
    
    <!-- Footer spacer to allow tearing paper cleanly -->
    <div style="height: 15mm;"></div>
  </div>
</body>
</html>
  `.trim();
};
