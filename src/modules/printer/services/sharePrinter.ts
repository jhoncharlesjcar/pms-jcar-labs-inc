import { toast } from 'sonner';
import logger from '@/lib/logger';

/**
 * Detects if the current device is Android
 * @returns {boolean}
 */
export const isAndroid = () => {
  if (typeof navigator === 'undefined') return false;
  return /android/i.test(navigator.userAgent);
};

/**
 * Wraps simple inner HTML with an ultra-lightweight HTML wrapper 
 * optimized specifically for RawBT via Shared Intent.
 * Avoids heavy CSS, uses pure monospace and basic alignment.
 * 
 * @param {string} innerHtml - The specific ticket content
 * @param {number} paperWidth - Paper width in mm (58 or 80)
 * @returns {string} 
 */
export const generateShareableHtml = (innerHtml, paperWidth = 58) => {
  const maxWidth = paperWidth === 80 ? '80mm' : '58mm';
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Ticket</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      width: 100%;
      background: #fff;
      color: #000;
      font-family: monospace;
      font-size: 13px;
      line-height: 1.2;
    }
    .ticket {
      width: 100%;
      max-width: ${maxWidth};
      margin: 0 auto;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .text-left { text-align: left; }
    .bold { font-weight: bold; }
    .divider { border-top: 1px dashed #000; margin: 5px 0; }
    .row { display: flex; justify-content: space-between; }
    * { word-break: break-word; }
  </style>
</head>
<body>
  <div class="ticket">
    ${innerHtml}
    <!-- Espacio final para asegurar el corte -->
    <div style="height: 10mm;"></div>
  </div>
</body>
</html>
`.trim();
};

/**
 * Shares a ticket HTML via the Web Share API.
 * This triggers the Android native "Share via..." dialog allowing
 * the user to select RawBT, WhatsApp, or Print Spooler natively.
 * 
 * @param {string} ticketHtml - The inner HTML content of the ticket
 * @param {number} [paperWidth=58] - Paper width in mm
 * @returns {Promise<boolean>}
 */
export async function shareTicket(ticketHtml, paperWidth = 58, fallbackText = null) {
  try {
    if (!ticketHtml) {
      toast.error('No hay contenido para generar el ticket.');
      return false;
    }

    const fullHtml = generateShareableHtml(ticketHtml, paperWidth);

    // Si estamos en Android, verificamos si podemos usar navigator.share (requiere HTTPS)
    const isAndroidDevice = isAndroid();
    const canUseWebShare = navigator.canShare && navigator.share;

    if (!canUseWebShare) {
      if (isAndroidDevice) {
        // FALLBACK ANDROID (HTTP Local): Disparar directo a RawBT
        // Como la app RawBT muchas veces imprime el HTML como texto en lugar de renderizarlo,
        // le enviamos un texto plano puramente alineado (si se proporciona) o limpiamos el HTML.
        const plainText = fallbackText || ticketHtml.replace(/<[^>]*>?/gm, ' ').replace(/\s\s+/g, ' ');
        const encodedText = encodeURIComponent(plainText);
        const base64Text = btoa(unescape(encodedText));
        
        // Usamos el intent PARSE que entiende texto plano y comandos ESC/POS perfectamente
        window.location.href = `intent:base64,${base64Text}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;action=ru.a402d.rawbtprinter.PARSE;end;`;
        return true;
      } else {
        // FALLBACK DESKTOP: Abrir ventana e imprimir
        const printWindow = window.open('', '_blank', 'width=400,height=600');
        if (printWindow) {
          printWindow.document.write(fullHtml);
          printWindow.document.close();
          printWindow.focus();
          setTimeout(() => { 
            printWindow.print(); 
            printWindow.close(); 
          }, 300);
        }
        return false;
      }
    }

    // Usamos el fallbackText (texto plano perfecto) o limpiamos el HTML básico
    const plainText = fallbackText || ticketHtml.replace(/<[^>]*>?/gm, ' ').replace(/\s\s+/g, ' ');
    
    // Si Web Share SÍ está disponible (HTTPS)
    // Creamos un archivo de TEXTO (.txt) en lugar de .html
    // Esto asegura que RawBT no intente parsearlo como código fuente, sino que lo imprima directo.
    const blob = new Blob([plainText], { type: 'text/plain' });
    const file = new File([blob], 'ticket.txt', { type: 'text/plain' });

    // Compartir nativo
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        title: 'Ticket de Caja',
        text: plainText, // Enviamos el texto directamente también (ideal para WhatsApp)
        files: [file]
      });
      return true;
    }

    // Si canShare falla incluso con .txt, mandamos el Intent de RawBT directo
    const encodedText = encodeURIComponent(plainText);
    const base64Text = btoa(unescape(encodedText));
    window.location.href = `intent:base64,${base64Text}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;action=ru.a402d.rawbtprinter.PARSE;end;`;
    return true;

  } catch (error) {
    if (error.name !== 'AbortError') {
      logger.error('[Share Printer Service] Error:', error);
      toast.error('Ocurrió un error al intentar compartir el ticket.');
    }
    return false;
  }
}
