import { MONEDA, FORMATOS_PERU, ZONA_HORARIA } from '@/config/constants';

/**
 * Formatea un valor numérico a moneda peruana (Soles - S/)
 */
export function formatSoles(amount: number | string): string {
  const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(numericAmount)) return `${MONEDA.simbolo} 0.00`;
  
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: MONEDA.codigo,
    minimumFractionDigits: MONEDA.decimales,
    maximumFractionDigits: MONEDA.decimales
  }).format(numericAmount);
}

/**
 * Formatea un documento DNI (rellena con ceros a la izquierda hasta 8 dígitos)
 */
export function formatDNI(dni: string | number): string {
  const cleanDni = String(dni).replace(/\D/g, '');
  return cleanDni.padStart(FORMATOS_PERU.dniLongitud, '0').slice(0, FORMATOS_PERU.dniLongitud);
}

/**
 * Formatea un documento RUC (11 dígitos)
 */
export function formatRUC(ruc: string | number): string {
  const cleanRuc = String(ruc).replace(/\D/g, '');
  return cleanRuc.slice(0, FORMATOS_PERU.rucLongitud);
}

/**
 * Formatea un número de celular de Perú (9 dígitos, formato: XXX XXX XXX)
 */
export function formatCelular(cel: string | number): string {
  const cleanCel = String(cel).replace(/\D/g, '').slice(0, FORMATOS_PERU.celularLongitud);
  if (cleanCel.length === FORMATOS_PERU.celularLongitud) {
    return `${cleanCel.slice(0, 3)} ${cleanCel.slice(3, 6)} ${cleanCel.slice(6)}`;
  }
  return cleanCel;
}

/**
 * Formatea una fecha ISO a formato local de Perú (America/Lima)
 */
export function formatFechaLocal(isoString: string | Date, includeTime = false): string {
  if (!isoString) return '';
  const date = typeof isoString === 'string' ? new Date(isoString) : isoString;
  
  if (isNaN(date.getTime())) return '';

  const options: Intl.DateTimeFormatOptions = {
    timeZone: ZONA_HORARIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...(includeTime && {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
  };

  return new Intl.DateTimeFormat('es-PE', options).format(date);
}
