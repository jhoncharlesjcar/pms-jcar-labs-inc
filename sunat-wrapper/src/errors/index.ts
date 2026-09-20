/**
 * SUNAT Error Handling & Parsing Module
 * Maneja códigos de error SUNAT: 2000-3999 (rechazos), 4000+ (observaciones/advertencias)
 * Parsea Fault SOAP, respuestas de CDR, y errores de validación
 */

import { SunatError, CDRResponse } from '@/types/sunat';

/**
 * Categorías de errores SUNAT
 */
export enum SunatErrorCategory {
  // 2000-2999: Errores de estructura/formato
  STRUCTURE_ERROR = 'STRUCTURE_ERROR',
  
  // 3000-3999: Errores de contenido/reglas de negocio
  CONTENT_ERROR = 'CONTENT_ERROR',
  
  // 4000-4999: Observaciones (documento aceptado con observaciones)
  OBSERVATION = 'OBSERVATION',
  
  // 5000-5999: Errores de sistema/comunicación
  SYSTEM_ERROR = 'SYSTEM_ERROR',
  
  // 9000-9999: Errores internos
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  
  // Desconocido
  UNKNOWN = 'UNKNOWN',
}

/**
 * Estructura de error parseado
 */
export interface ParsedSunatError {
  code: string;
  message: string;
  category: SunatErrorCategory;
  isRetryable: boolean;
  isBlocking: boolean; // true = rechazado (no se acepta), false = observación (se acepta)
  details?: string;
  rawCode?: string;
  suggestions?: string[];
}

/**
 * Mapeo de códigos SUNAT comunes a mensajes descriptivos
 * Referencia: Manual de Programador SUNAT - Tabla de Códigos de Error
 */
const SUNAT_ERROR_CODES: Record<string, {
  message: string;
  category: SunatErrorCategory;
  isRetryable: boolean;
  isBlocking: boolean;
  suggestions: string[];
}> = {
  // =========================================================================
  // 2000-2999: Errores de estructura/formato XML
  // =========================================================================
  '2000': {
    message: 'Error en la estructura del XML - No cumple esquema UBL 2.0',
    category: SunatErrorCategory.STRUCTURE_ERROR,
    isRetryable: false,
    isBlocking: true,
    suggestions: ['Validar XML contra XSD UBL 2.0', 'Verificar namespaces obligatorios'],
  },
  '2001': {
    message: 'Error en la firma digital - XMLDSig inválido',
    category: SunatErrorCategory.STRUCTURE_ERROR,
    isRetryable: false,
    isBlocking: true,
    suggestions: ['Verificar certificado vigente', 'Validar canonicalización C14N', 'Revisar algoritmo RSA-SHA256'],
  },
  '2002': {
    message: 'Certificado digital expirado o revocado',
    category: SunatErrorCategory.STRUCTURE_ERROR,
    isRetryable: false,
    isBlocking: true,
    suggestions: ['Renovar certificado digital', 'Verificar vigencia en SUNAT'],
  },
  '2003': {
    message: 'Error en el archivo ZIP - Estructura inválida',
    category: SunatErrorCategory.STRUCTURE_ERROR,
    isRetryable: false,
    isBlocking: true,
    suggestions: ['Verificar que ZIP contenga exactamente 1 XML', 'Validar nomenclatura archivo'],
  },
  '2004': {
    message: 'Encoding de caracteres inválido',
    category: SunatErrorCategory.STRUCTURE_ERROR,
    isRetryable: false,
    isBlocking: true,
    suggestions: ['Usar UTF-8 o ISO-8859-1 según configuración', 'Verificar caracteres especiales'],
  },
  '2005': {
    message: 'Tamaño de archivo excede límite permitido',
    category: SunatErrorCategory.STRUCTURE_ERROR,
    isRetryable: false,
    isBlocking: true,
    suggestions: ['Reducir tamaño de XML', 'Verificar límite SUNAT (típicamente 10MB)'],
  },
  '2006': {
    message: 'Namespace UBL 2.0 faltante o incorrecto',
    category: SunatErrorCategory.STRUCTURE_ERROR,
    isRetryable: false,
    isBlocking: true,
    suggestions: ['Incluir todos los namespaces obligatorios', 'Verificar xmlns:cac, xmlns:cbc, xmlns:ext, xmlns:ds'],
  },
  '2007': {
    message: 'Elemento obligatorio faltante en XML',
    category: SunatErrorCategory.STRUCTURE_ERROR,
    isRetryable: false,
    isBlocking: true,
    suggestions: ['Verificar elementos requeridos por tipo de documento', 'Revisar UBLVersionID, CustomizationID, ID'],
  },

  // =========================================================================
  // 3000-3999: Errores de contenido/reglas de negocio
  // =========================================================================
  '3000': {
    message: 'RUC emisor no autorizado para emisión electrónica',
    category: SunatErrorCategory.CONTENT_ERROR,
    isRetryable: false,
    isBlocking: true,
    suggestions: ['Verificar habilitación en SUNAT', 'Confirmar RUC en certificado digital'],
  },
  '3001': {
    message: 'Tipo de comprobante no autorizado para el emisor',
    category: SunatErrorCategory.CONTENT_ERROR,
    isRetryable: false,
    isBlocking: true,
    suggestions: ['Verificar autorización de tipo de documento en SUNAT'],
  },
  '3002': {
    message: 'Serie no autorizada para el tipo de comprobante',
    category: SunatErrorCategory.CONTENT_ERROR,
    isRetryable: false,
    isBlocking: true,
    suggestions: ['Registrar serie en SUNAT', 'Verificar correlativo inicial'],
  },
  '3003': {
    message: 'Correlativo duplicado - ya existe comprobante con este número',
    category: SunatErrorCategory.CONTENT_ERROR,
    isRetryable: false,
    isBlocking: true,
    suggestions: ['Usar correlativo siguiente', 'Verificar último número enviado'],
  },
  '3004': {
    message: 'Correlativo fuera de secuencia',
    category: SunatErrorCategory.CONTENT_ERROR,
    isRetryable: false,
    isBlocking: true,
    suggestions: ['Enviar correlativos en orden secuencial', 'No saltar números'],
  },
  '3005': {
    message: 'Fecha de emisión inválida o fuera de rango',
    category: SunatErrorCategory.CONTENT_ERROR,
    isRetryable: false,
    isBlocking: true,
    suggestions: ['Fecha no puede ser futura', 'Fecha no puede ser muy antigua (máx 7 días)'],
  },
  '3006': {
    message: 'RUC/DNI del adquiriente inválido',
    category: SunatErrorCategory.CONTENT_ERROR,
    isRetryable: false,
    isBlocking: true,
    suggestions: ['Validar DNI (8 dígitos) / RUC (11 dígitos)', 'Verificar dígito verificador RUC'],
  },
  '3007': {
    message: 'Monto total no coincide con sumatoria de ítems',
    category: SunatErrorCategory.CONTENT_ERROR,
    isRetryable: false,
    isBlocking: true,
    suggestions: ['Verificar cálculos: subtotal + IGV = total', 'Redondear a 2 decimales'],
  },
  '3008': {
    message: 'IGV mal calculado',
    category: SunatErrorCategory.CONTENT_ERROR,
    isRetryable: false,
    isBlocking: true,
    suggestions: ['IGV = 18% sobre base imponible', 'Verificar redondeo a 2 decimales'],
  },
  '3009': {
    message: 'Tipo de afectación IGV inválido',
    category: SunatErrorCategory.CONTENT_ERROR,
    isRetryable: false,
    isBlocking: true,
    suggestions: ['Usar códigos: 10 (Gravado), 20 (Exonerado), 30 (Inafecto), 40 (Exportación)'],
  },
  '3010': {
    message: 'Unidad de medida no válida para SUNAT',
    category: SunatErrorCategory.CONTENT_ERROR,
    isRetryable: false,
    isBlocking: true,
    suggestions: ['Usar catálogo SUNAT: NIU, KGM, LTR, MTR, etc.'],
  },
  '3011': {
    message: 'Comprobante de referencia no existe (para notas crédito/débito)',
    category: SunatErrorCategory.CONTENT_ERROR,
    isRetryable: false,
    isBlocking: true,
    suggestions: ['Verificar que factura/boleta original fue aceptada', 'Confirmar RUC, tipo, serie, correlativo'],
  },
  '3012': {
    message: 'Tipo de nota (Catálogo 09) no válido para el comprobante referenciado',
    category: SunatErrorCategory.CONTENT_ERROR,
    isRetryable: false,
    isBlocking: true,
    suggestions: ['Validar catálogo 09: 01=Anulación, 04=Descuento global, etc.'],
  },
  '3013': {
    message: 'Moneda no autorizada',
    category: SunatErrorCategory.CONTENT_ERROR,
    isRetryable: false,
    isBlocking: true,
    suggestions: ['Usar PEN o USD según configuración SUNAT'],
  },
  '3014': {
    message: 'Tipo de cambio inválido o faltante para moneda extranjera',
    category: SunatErrorCategory.CONTENT_ERROR,
    isRetryable: false,
    isBlocking: true,
    suggestions: ['Incluir tipo de cambio SUNAT del día', 'Formato: 3.750 (3 decimales)'],
  },
  '3015': {
    message: 'Datos del emisor no coinciden con certificado digital',
    category: SunatErrorCategory.CONTENT_ERROR,
    isRetryable: false,
    isBlocking: true,
    suggestions: ['RUC en XML debe coincidir con certificado', 'Razón social debe coincidir'],
  },

  // =========================================================================
  // 4000-4999: Observaciones (documento ACEPTADO con observaciones)
  // =========================================================================
  '4000': {
    message: 'Observación: Documento aceptado con observaciones menores',
    category: SunatErrorCategory.OBSERVATION,
    isRetryable: false,
    isBlocking: false,
    suggestions: ['Revisar observaciones en CDR', 'Corregir para próximos envíos'],
  },
  '4001': {
    message: 'Observación: Formato de fecha/hora no estándar',
    category: SunatErrorCategory.OBSERVATION,
    isRetryable: false,
    isBlocking: false,
    suggestions: ['Usar formato YYYY-MM-DD y HH:MM:SS'],
  },
  '4002': {
    message: 'Observación: Caracteres especiales en campos de texto',
    category: SunatErrorCategory.OBSERVATION,
    isRetryable: false,
    isBlocking: false,
    suggestions: ['Evitar caracteres de control XML', 'Escapar &, <, >, \", \''],
  },
  '4003': {
    message: 'Observación: Redondeo de centésimas en montos',
    category: SunatErrorCategory.OBSERVATION,
    isRetryable: false,
    isBlocking: false,
    suggestions: ['Redondear todos los montos a 2 decimales'],
  },

  // =========================================================================
  // 5000-5999: Errores de sistema/comunicación
  // =========================================================================
  '5000': {
    message: 'Error interno del servidor SUNAT',
    category: SunatErrorCategory.SYSTEM_ERROR,
    isRetryable: true,
    isBlocking: false,
    suggestions: ['Reintentar en unos minutos', 'Contactar soporte SUNAT si persiste'],
  },
  '5001': {
    message: 'Servicio temporalmente no disponible',
    category: SunatErrorCategory.SYSTEM_ERROR,
    isRetryable: true,
    isBlocking: false,
    suggestions: ['Reintentar con backoff exponencial', 'Verificar estado servicios SUNAT'],
  },
  '5002': {
    message: 'Timeout en procesamiento',
    category: SunatErrorCategory.SYSTEM_ERROR,
    isRetryable: true,
    isBlocking: false,
    suggestions: ['Reintentar', 'Verificar tamaño de archivo'],
  },
  '5003': {
    message: 'Error de comunicación con SUNAT',
    category: SunatErrorCategory.SYSTEM_ERROR,
    isRetryable: true,
    isBlocking: false,
    suggestions: ['Verificar conectividad', 'Reintentar'],
  },

  // =========================================================================
  // 9000-9999: Errores internos/genéricos
  // =========================================================================
  '9000': {
    message: 'Error interno no especificado',
    category: SunatErrorCategory.INTERNAL_ERROR,
    isRetryable: true,
    isBlocking: false,
    suggestions: ['Reintentar', 'Contactar soporte si persiste'],
  },
  '9999': {
    message: 'Error desconocido',
    category: SunatErrorCategory.UNKNOWN,
    isRetryable: true,
    isBlocking: false,
    suggestions: ['Revisar logs completos', 'Contactar soporte SUNAT'],
  },
};

/**
 * Parser principal de errores SUNAT
 */
export class SunatErrorParser {
  /**
   * Parsea un código de error SUNAT a estructura tipada
   */
  static parse(code: string | number, context?: string): ParsedSunatError {
    const codeStr = code.toString().padStart(4, '0');
    const mapping = SUNAT_ERROR_CODES[codeStr];

    if (mapping) {
      return {
        code: codeStr,
        message: mapping.message,
        category: mapping.category,
        isRetryable: mapping.isRetryable,
        isBlocking: mapping.isBlocking,
        suggestions: mapping.suggestions,
        rawCode: codeStr,
      };
    }

    // Determinar categoría por rango
    const numCode = parseInt(codeStr, 10);
    let category = SunatErrorCategory.UNKNOWN;
    let isRetryable = true;
    let isBlocking = false;

    if (numCode >= 2000 && numCode < 3000) {
      category = SunatErrorCategory.STRUCTURE_ERROR;
      isRetryable = false;
      isBlocking = true;
    } else if (numCode >= 3000 && numCode < 4000) {
      category = SunatErrorCategory.CONTENT_ERROR;
      isRetryable = false;
      isBlocking = true;
    } else if (numCode >= 4000 && numCode < 5000) {
      category = SunatErrorCategory.OBSERVATION;
      isRetryable = false;
      isBlocking = false;
    } else if (numCode >= 5000 && numCode < 6000) {
      category = SunatErrorCategory.SYSTEM_ERROR;
      isRetryable = true;
      isBlocking = false;
    } else if (numCode >= 9000) {
      category = SunatErrorCategory.INTERNAL_ERROR;
      isRetryable = true;
      isBlocking = false;
    }

    return {
      code: codeStr,
      message: context || `Código SUNAT ${codeStr} no documentado`,
      category,
      isRetryable,
      isBlocking,
      suggestions: ['Consultar manual de programador SUNAT', 'Contactar soporte técnico'],
      rawCode: codeStr,
    };
  }

  /**
   * Parsea respuesta CDR (Constancia de Recepción)
   */
  static parseCdrResponse(cdr: CDRResponse): ParsedSunatError[] {
    const errors: ParsedSunatError[] = [];

    // ResponseCode principal
    if (cdr.responseCode && cdr.responseCode !== '0') {
      errors.push(this.parse(cdr.responseCode, cdr.description));
    }

    // Notas adicionales
    if (cdr.notes?.length) {
      cdr.notes.forEach(note => {
        // Intentar extraer código de la nota
        const codeMatch = note.match(/^(\d{4})\s*[-:]\s*(.+)$/);
        if (codeMatch) {
          errors.push(this.parse(codeMatch[1], codeMatch[2]));
        } else {
          errors.push(this.parse('4000', note));
        }
      });
    }

    return errors;
  }

  /**
   * Parsea Fault SOAP de respuesta SUNAT
   */
  static parseSoapFault(xml: string): ParsedSunatError {
    // Extraer faultcode y faultstring
    const faultCodeMatch = xml.match(/<faultcode>([^<]+)<\/faultcode>/);
    const faultStringMatch = xml.match(/<faultstring>([^<]+)<\/faultstring>/);
    const detailMatch = xml.match(/<detail>([\s\S]*?)<\/detail>/);

    const faultCode = faultCodeMatch ? faultCodeMatch[1] : 'SOAP_FAULT';
    const faultString = faultStringMatch ? faultStringMatch[1] : 'SOAP Fault';
    const detail = detailMatch ? detailMatch[1] : undefined;

    // Intentar extraer código SUNAT del detail
    let sunatCode = '5000';
    if (detail) {
      const codeMatch = detail.match(/<faultcode>(\d{4})<\/faultcode>/i) || 
                        detail.match(/codigo[:\s]*(\d{4})/i) ||
                        detail.match(/error[:\s]*(\d{4})/i);
      if (codeMatch) {
        sunatCode = codeMatch[1];
      }
    }

    const parsed = this.parse(sunatCode, faultString);
    parsed.details = detail;
    parsed.rawCode = faultCode;

    return parsed;
  }

  /**
   * Parsea respuesta HTTP de error
   */
  static parseHttpError(status: number, body: string): ParsedSunatError {
    if (status >= 500) {
      return this.parse('5000', `HTTP ${status}: Server Error`);
    }
    if (status === 401 || status === 403) {
      return this.parse('3000', `HTTP ${status}: Credenciales inválidas - ${body}`);
    }
    if (status === 404) {
      return this.parse('5001', `HTTP ${status}: Endpoint no encontrado`);
    }
    if (status === 400) {
      return this.parse('2000', `HTTP ${status}: Bad Request - ${body}`);
    }
    if (status === 429) {
      return this.parse('5001', `HTTP ${status}: Rate Limited`);
    }

    return this.parse('9999', `HTTP ${status}: ${body}`);
  }

  /**
   * Verifica si un CDR indica aceptación
   */
  static isAccepted(cdr: CDRResponse): boolean {
    return cdr.responseCode === '0' || cdr.responseCode === '98'; // 98 = en proceso (asíncrono)
  }

  /**
   * Verifica si un CDR tiene observaciones (aceptado con observaciones)
   */
  static hasObservations(cdr: CDRResponse): boolean {
    const code = parseInt(cdr.responseCode, 10);
    return code >= 4000 && code < 5000;
  }

  /**
   * Verifica si un CDR indica rechazo
   */
  static isRejected(cdr: CDRResponse): boolean {
    const code = parseInt(cdr.responseCode, 10);
    return (code >= 2000 && code < 4000) || code >= 5000;
  }

  /**
   * Obtiene mensaje amigable para usuario final
   */
  static getUserFriendlyMessage(error: ParsedSunatError): string {
    const base = error.message;
    
    if (error.suggestions?.length) {
      return `${base}. ${error.suggestions.join('; ')}`;
    }
    
    return base;
  }

  /**
   * Obtiene lista de todos los códigos documentados
   */
  static getDocumentedCodes(): Array<{ code: string; message: string; category: string }> {
    return Object.entries(SUNAT_ERROR_CODES).map(([code, info]) => ({
      code,
      message: info.message,
      category: info.category,
    }));
  }
}

/**
 * Clase de error personalizada para errores SUNAT
 */
export class SunatException extends Error {
  public readonly parsedError: ParsedSunatError;
  public readonly originalResponse?: string;

  constructor(parsedError: ParsedSunatError, originalResponse?: string) {
    super(SunatErrorParser.getUserFriendlyMessage(parsedError));
    this.name = 'SunatException';
    this.parsedError = parsedError;
    this.originalResponse = originalResponse;
  }

  static fromCode(code: string | number, context?: string): SunatException {
    return new SunatException(SunatErrorParser.parse(code, context));
  }

  static fromCdr(cdr: CDRResponse): SunatException {
    const errors = SunatErrorParser.parseCdrResponse(cdr);
    const mainError = errors[0] || SunatErrorParser.parse('9999', 'CDR sin responseCode');
    return new SunatException(mainError);
  }

  static fromSoapFault(xml: string): SunatException {
    return new SunatException(SunatErrorParser.parseSoapFault(xml), xml);
  }

  isRetryable(): boolean {
    return this.parsedError.isRetryable;
  }

  isBlocking(): boolean {
    return this.parsedError.isBlocking;
  }

  getCategory(): SunatErrorCategory {
    return this.parsedError.category;
  }
}

export const sunatErrorParser = SunatErrorParser;