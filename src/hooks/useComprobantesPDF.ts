import { toast } from 'sonner';
import logger from '@/lib/logger';
import type { Hotel, ConfigHotel } from '@/types';
import PdfWorker from '@/workers/pdf.worker?worker';

export interface VentaDocument {
    id?: string;
    tipo_comprobante?: 'boleta' | 'factura' | string;
    estado_comprobante?: 'sunat_emitido' | 'sunat_pendiente' | 'interno' | string;
    numero_ticket?: string;
    total?: number | string;
    fecha_venta?: string;
    ruc_cliente?: string;
    huesped_dni?: string;
    razon_social?: string;
    huesped_nombre?: string;
    detalles?: Array<{
        nombre?: string;
        producto_nombre?: string;
        cantidad?: number;
        precio_unitario?: number | string;
        subtotal?: number | string;
    }>;
}

/**
 * Hook to generate professional A4 PDF bills (Boleta/Factura)
 * using a Web Worker to avoid blocking the main thread.
 */
export function useComprobantesPDF() {
  const generarPDF = async (ventaPos: VentaDocument, hotel: Hotel & Partial<ConfigHotel>, requestedType?: 'factura' | 'boleta'): Promise<string> => {
    return new Promise((resolve, reject) => {
      const worker = new PdfWorker();

      worker.onmessage = (e) => {
        const { success, blob, filename, error, isSunatEmitted, tipoComprobante } = e.data;
        
        if (success && blob) {
          // Descargar el Blob
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          
          toast.success(`${isSunatEmitted ? tipoComprobante.toUpperCase() : 'Constancia'} descargada con éxito`);
          resolve(filename);
        } else {
          logger.error('Error generando PDF en Worker:', error);
          toast.error('Error al generar el PDF del comprobante');
          reject(new Error(error || 'Error desconocido en Worker'));
        }
        
        // Finalizar el worker para liberar memoria
        worker.terminate();
      };

      worker.onerror = (err) => {
        logger.error('Worker throwed an error:', err);
        toast.error('Error al iniciar el generador de PDF');
        worker.terminate();
        reject(err);
      };

      worker.postMessage({ ventaPos, hotel, requestedType });
    });
  };

  return { generarPDF };
}
