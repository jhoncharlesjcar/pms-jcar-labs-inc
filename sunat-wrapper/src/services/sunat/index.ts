/**
 * SUNAT Service - Orquestador principal
 * Coordina: XML Builder → XML Signer → ZIP → SOAP Client
 * Expone métodos de alto nivel para la API REST
 */

import { getConfig, getSunatEndpoint, getSunatUsername } from '@/config';
import { 
  XmlBuilderService, 
  xmlBuilderService 
} from '@/services/xml-builder';
import { 
  XmlSignerService, 
  xmlSignerService 
} from '@/services/signer';
import { 
  ZipService, 
  zipService 
} from '@/services/zip';
import { 
  SoapClient, 
  createSoapClient 
} from '@/services/soap';
import {
  Invoice,
  CreditNote,
  DebitNote,
  SummaryDocuments,
  SendBillRequest,
  SendBillResponse,
  SendSummaryRequest,
  SendSummaryResponse,
  GetStatusRequest,
  GetStatusResponse,
  GetStatusCdrRequest,
  CDRResponse,
  SunatError,
  CertificateConfig,
  DocumentType,
  SunatCredentials,
  SignedDocument,
} from '@/types/sunat';

export interface SunatServiceConfig {
  credentials?: SunatCredentials;
  certificate?: CertificateConfig;
  timeout?: number;
}

export interface ProcessedDocument {
  signedDocument: SignedDocument;
  soapResponse: any;
  cdr?: CDRResponse;
}

export class SunatService {
  private xmlBuilder: XmlBuilderService;
  private xmlSigner: XmlSignerService;
  private zipService: ZipService;
  private soapClient: SoapClient;
  private config: SunatServiceConfig;

  constructor(config: SunatServiceConfig = {}) {
    this.xmlBuilder = xmlBuilderService;
    this.xmlSigner = xmlSignerService;
    this.zipService = zipService;
    this.config = config;

    // Inicializar credenciales SUNAT
    const credentials = config.credentials || this.buildDefaultCredentials();
    this.soapClient = createSoapClient(credentials, config.timeout);
  }

  /**
   * Construye credenciales por defecto desde variables de entorno
   */
  private buildDefaultCredentials(): SunatCredentials {
    return {
      ruc: getConfig().SUNAT_RUC,
      usuarioSol: getConfig().SUNAT_USUARIO_SOL,
      claveSol: getConfig().SUNAT_CLAVE_SOL,
      endpoint: getSunatEndpoint(),
    };
  }

  /**
   * Obtiene configuración de certificado
   */
  private getCertificateConfig(requestCert?: CertificateConfig): CertificateConfig {
    if (requestCert) return requestCert;
    if (this.config.certificate) return this.config.certificate;

    // Desde variables de entorno
    const env = getConfig();
    if (env.SUNAT_PFX_BASE64 && env.SUNAT_PFX_PASSWORD) {
      return {
        pfxBase64: env.SUNAT_PFX_BASE64,
        pfxPassword: env.SUNAT_PFX_PASSWORD,
      };
    }
    if (env.SUNAT_PRIVATE_KEY_PEM && env.SUNAT_CERTIFICATE_PEM) {
      return {
        privateKeyPem: env.SUNAT_PRIVATE_KEY_PEM,
        certificatePem: env.SUNAT_CERTIFICATE_PEM,
      };
    }

    throw new Error('No certificate configuration available');
  }

  // =========================================================================
  // MÉTODOS PÚBLICOS - API PRINCIPAL
  // =========================================================================

  /**
   * Envío síncrono: Factura (01), Boleta (03), Nota Crédito (07), Nota Débito (08)
   * Flujo: JSON → XML UBL 2.0 → Firmar XMLDSig → ZIP → SOAP sendBill → CDR
   */
  async sendBill(request: SendBillRequest): Promise<SendBillResponse> {
    try {
      // 1. Construir XML UBL 2.0
      let unsignedXml: string;
      const doc = request.document;

      // Type guard for CreditNote/DebitNote (have discrepancyResponse)
      const isNote = 'discrepancyResponse' in doc && 'billingReference' in doc;
      
      if (isNote) {
        // Nota de Crédito o Débito
        if (doc.invoiceTypeCode === '07') {
          unsignedXml = this.xmlBuilder.buildCreditNote(doc as CreditNote);
        } else {
          unsignedXml = this.xmlBuilder.buildDebitNote(doc as DebitNote);
        }
      } else {
        // Factura o Boleta
        unsignedXml = this.xmlBuilder.buildInvoice(doc as Invoice);
      }

      // 2. Firmar XML con XMLDSig
      const certConfig = this.getCertificateConfig(request.certificate);
      const signedDoc = await this.xmlSigner.signXml(unsignedXml, certConfig);

      // 3. Enviar vía SOAP sendBill
      const soapResponse = await this.soapClient.sendBill(signedDoc.fileName.replace('.xml', '.zip'), signedDoc.zipBase64);

      if (!soapResponse.success) {
        return {
          success: false,
          error: soapResponse.error,
          zipBase64: signedDoc.zipBase64,
          xmlBase64: signedDoc.xmlBase64,
        };
      }

      // 4. Parsear CDR (Constancia de Recepción)
      const cdr = await this.parseCdr(soapResponse.data!.applicationResponse);

      return {
        success: true,
        cdr,
        zipBase64: signedDoc.zipBase64,
        xmlBase64: signedDoc.xmlBase64,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'PROCESS_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error processing sendBill',
          isRetryable: false,
        },
      };
    }
  }

  /**
   * Envío asíncrono: Resumen Diario (RC) / Comunicación de Baja (RA)
   * Flujo: JSON → XML UBL 2.0 → Firmar → ZIP → SOAP sendSummary → Ticket
   */
  async sendSummary(request: SendSummaryRequest): Promise<SendSummaryResponse> {
    try {
      // 1. Construir XML UBL 2.0 para Resumen
      const unsignedXml = this.xmlBuilder.buildSummary(request.summary);

      // 2. Firmar XML
      const certConfig = this.getCertificateConfig(request.certificate);
      const signedDoc = await this.xmlSigner.signXml(unsignedXml, certConfig);

      // 3. Enviar vía SOAP sendSummary
      const soapResponse = await this.soapClient.sendSummary(
        signedDoc.fileName.replace('.xml', '.zip'), 
        signedDoc.zipBase64
      );

      if (!soapResponse.success) {
        return {
          success: false,
          ticket: '',
          error: soapResponse.error,
          zipBase64: signedDoc.zipBase64,
        };
      }

      return {
        success: true,
        ticket: soapResponse.data!.ticket,
        zipBase64: signedDoc.zipBase64,
      };
    } catch (error) {
      return {
        success: false,
        ticket: '',
        error: {
          code: 'PROCESS_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error processing sendSummary',
          isRetryable: false,
        },
      };
    }
  }

  /**
   * Consulta estado de ticket (sendSummary / sendPack)
   */
  async getStatus(request: GetStatusRequest): Promise<GetStatusResponse> {
    try {
      const soapResponse = await this.soapClient.getStatus(request.ticket);

      if (!soapResponse.success) {
        return {
          success: false,
          statusCode: -1,
          statusMessage: '',
          error: soapResponse.error,
        };
      }

      const data = soapResponse.data!;
      let cdr: CDRResponse | undefined;

      // Si statusCode = 0 (procesado), parsear CDR del content
      if (data.statusCode === 0 && data.content) {
        cdr = await this.parseCdr(data.content);
      }

      return {
        success: true,
        statusCode: data.statusCode,
        statusMessage: data.statusMessage,
        cdr,
      };
    } catch (error) {
      return {
        success: false,
        statusCode: -1,
        statusMessage: '',
        error: {
          code: 'PROCESS_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error getting status',
          isRetryable: true,
        },
      };
    }
  }

  /**
   * Consulta directa de CDR por RUC, tipo, serie, correlativo
   */
  async getStatusCdr(request: GetStatusCdrRequest): Promise<GetStatusResponse> {
    try {
      const soapResponse = await this.soapClient.getStatusCdr(
        request.ruc,
        request.documentType,
        request.series,
        request.correlativo
      );

      if (!soapResponse.success) {
        return {
          success: false,
          statusCode: -1,
          statusMessage: '',
          error: soapResponse.error,
        };
      }

      const data = soapResponse.data!;
      let cdr: CDRResponse | undefined;

      if (data.statusCode === 0 && data.content) {
        cdr = await this.parseCdr(data.content);
      }

      return {
        success: true,
        statusCode: data.statusCode,
        statusMessage: data.statusMessage,
        cdr,
      };
    } catch (error) {
      return {
        success: false,
        statusCode: -1,
        statusMessage: '',
        error: {
          code: 'PROCESS_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error getting CDR',
          isRetryable: true,
        },
      };
    }
  }

  /**
   * Envío de lote (sendPack) - hasta 500 comprobantes
   */
  async sendPack(
    documents: Array<Invoice | CreditNote | DebitNote>,
    certificate?: CertificateConfig
  ): Promise<SendSummaryResponse> {
    if (documents.length > 500) {
      throw new Error('sendPack permite máximo 500 comprobantes');
    }

    try {
      // Construir y firmar cada documento
      const signedDocs: SignedDocument[] = [];
      
      for (const doc of documents) {
        let unsignedXml: string;
        
        if ('discrepancyResponse' in doc) {
          unsignedXml = doc.invoiceTypeCode === '07'
            ? this.xmlBuilder.buildCreditNote(doc as CreditNote)
            : this.xmlBuilder.buildDebitNote(doc as DebitNote);
        } else {
          unsignedXml = this.xmlBuilder.buildInvoice(doc as Invoice);
        }

        const certConfig = this.getCertificateConfig(certificate);
        const signed = await this.xmlSigner.signXml(unsignedXml, certConfig);
        signedDocs.push(signed);
      }

      // Crear ZIP múltiple
      const zipResult = await this.zipService.createMultiZip(
        signedDocs.map(d => ({ fileName: d.fileName, xmlContent: d.xml }))
      );

      // Enviar via sendPack
      const soapResponse = await this.soapClient.sendPack(
        zipResult.fileName,
        zipResult.zipBase64
      );

      if (!soapResponse.success) {
        return {
          success: false,
          ticket: '',
          error: soapResponse.error,
          zipBase64: zipResult.zipBase64,
        };
      }

      return {
        success: true,
        ticket: soapResponse.data!.ticket,
        zipBase64: zipResult.zipBase64,
      };
    } catch (error) {
      return {
        success: false,
        ticket: '',
        error: {
          code: 'PROCESS_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error processing sendPack',
          isRetryable: false,
        },
      };
    }
  }

  // =========================================================================
  // UTILIDADES
  // =========================================================================

  /**
   * Parsea CDR desde Base64 (ZIP con CDR XML)
   */
  private async parseCdr(cdrBase64: string): Promise<CDRResponse> {
    try {
      // El CDR viene como ZIP en Base64
      const zipBuffer = Buffer.from(cdrBase64, 'base64');
      
      // Extraer XML del ZIP
      const extracted = await this.zipService.extractXmlFromZip(cdrBase64);
      const cdrXml = extracted.xml;

      // Parsear XML del CDR
      return this.parseCdrXml(cdrXml);
    } catch (error) {
      throw new Error(`Failed to parse CDR: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Parsea XML del CDR a objeto estructurado
   */
  private parseCdrXml(xml: string): CDRResponse {
    // Extraer campos principales del CDR
    const responseCodeMatch = xml.match(/<cbc:ResponseCode>([^<]+)<\/cbc:ResponseCode>/);
    const descriptionMatch = xml.match(/<cbc:Description>([^<]+)<\/cbc:Description>/);
    
    // Notas adicionales
    const noteMatches = xml.match(/<cbc:Note>([^<]+)<\/cbc:Note>/g) || [];
    const notes = noteMatches.map(n => n.replace(/<\/?cbc:Note>/g, ''));

    // Firma del CDR
    const digestMatch = xml.match(/<ds:DigestValue>([^<]+)<\/ds:DigestValue>/);
    const signatureMatch = xml.match(/<ds:SignatureValue>([^<]+)<\/ds:SignatureValue>/);
    const certMatch = xml.match(/<ds:X509Certificate>([^<]+)<\/ds:X509Certificate>/);

    // DocumentReference UUID
    const uuidMatch = xml.match(/<cbc:UUID>([^<]+)<\/cbc:UUID>/);

    return {
      responseCode: responseCodeMatch ? responseCodeMatch[1] : '9999',
      description: descriptionMatch ? descriptionMatch[1] : 'Sin descripción',
      notes: notes.length > 0 ? notes : undefined,
      signature: digestMatch && signatureMatch && certMatch ? {
        digestValue: digestMatch[1],
        signatureValue: signatureMatch[1],
        x509Certificate: certMatch[1],
      } : undefined,
      documentReference: uuidMatch ? {
        uuid: uuidMatch[1],
      } : undefined,
    };
  }

  /**
   * Valida configuración completa
   */
  async validateConfiguration(): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Verificar credenciales
    const creds = this.buildDefaultCredentials();
    if (!creds.ruc || creds.ruc.length !== 11) {
      errors.push('RUC inválido (debe tener 11 dígitos)');
    }
    if (!creds.usuarioSol) {
      errors.push('USUARIO_SOL no configurado');
    }
    if (!creds.claveSol) {
      errors.push('CLAVE_SOL no configurado');
    }

    // Verificar certificado
    try {
      this.getCertificateConfig();
    } catch {
      errors.push('Certificado digital no configurado (PFX o PEM requerido)');
    }

    // Verificar endpoint
    try {
      new URL(creds.endpoint);
    } catch {
      errors.push('Endpoint SUNAT inválido');
    }

    // Advertencias
    if (creds.endpoint.includes('beta')) {
      warnings.push('Usando entorno BETA/SQA - cambiar a producción para uso real');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Obtiene información del servicio
   */
  getServiceInfo(): {
    environment: string;
    endpoint: string;
    username: string;
    hasCertificate: boolean;
  } {
    const creds = this.buildDefaultCredentials();
    let hasCert = false;
    try {
      this.getCertificateConfig();
      hasCert = true;
    } catch {}

    return {
      environment: getConfig().SUNAT_ENV,
      endpoint: creds.endpoint,
      username: getSunatUsername(),
      hasCertificate: hasCert,
    };
  }
}

// Factory function
export const createSunatService = (config?: SunatServiceConfig) => new SunatService(config);

// Singleton para uso en controllers
let defaultSunatService: SunatService | null = null;

export function getSunatService(config?: SunatServiceConfig): SunatService {
  if (!defaultSunatService || config) {
    defaultSunatService = new SunatService(config);
  }
  return defaultSunatService;
}