/**
 * SOAP Client with WS-Security for SUNAT
 * Implementa cliente SOAP con cabecera WS-Security UsernameToken
 * Username = RUC + USUARIO_SOL, Password = CLAVE_SOL
 */

import { SunatCredentials, SunatError } from '@/types/sunat';

export interface SoapHeader {
  UsernameToken: {
    Username: string;
    Password: string;
    Nonce?: string;
    Created?: string;
  };
}

export interface SoapEnvelope {
  Header: {
    Security: {
      UsernameToken: SoapHeader['UsernameToken'];
    };
  };
  Body: any;
}

export interface SoapResponse<T> {
  success: boolean;
  data?: T;
  error?: SunatError;
  rawResponse?: string;
}

export interface SendBillResponse {
  applicationResponse: string; // Base64 del ZIP con CDR
}

export interface SendSummaryResponse {
  ticket: string;
}

export interface GetStatusResponse {
  statusCode: number;
  statusMessage: string;
  content?: string; // Base64 del ZIP con CDR
}

export interface GetStatusCdrResponse {
  statusCode: number;
  statusMessage: string;
  content?: string; // Base64 del CDR
}

/**
 * Cliente SOAP para servicios SUNAT
 */
export class SoapClient {
  private readonly endpoint: string;
  private readonly credentials: SunatCredentials;
  private readonly timeout: number;

  constructor(credentials: SunatCredentials, timeout = 30000) {
    this.endpoint = credentials.endpoint;
    this.credentials = credentials;
    this.timeout = timeout;
  }

  /**
   * Construye la cabecera WS-Security UsernameToken
   */
  private buildWsSecurityHeader(): string {
    const username = `${this.credentials.ruc}${this.credentials.usuarioSol}`;
    const password = this.credentials.claveSol;
    const nonce = this.generateNonce();
    const created = new Date().toISOString();

    return `<wsse:Security xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd" 
      xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">
  <wsse:UsernameToken wsu:Id="UsernameToken-1">
    <wsse:Username>${username}</wsse:Username>
    <wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText">${password}</wsse:Password>
    <wsse:Nonce EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary">${nonce}</wsse:Nonce>
    <wsu:Created>${created}</wsu:Created>
  </wsse:UsernameToken>
</wsse:Security>`;
  }

  /**
   * Genera un nonce aleatorio en Base64
   */
  private generateNonce(): string {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Buffer.from(bytes).toString('base64');
  }

  /**
   * Construye el sobre SOAP completo
   */
  private buildSoapEnvelope(bodyContent: string): string {
    const securityHeader = this.buildWsSecurityHeader();

    return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope 
  xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd"
  xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">
  <soapenv:Header>
    ${securityHeader}
  </soapenv:Header>
  <soapenv:Body>
    ${bodyContent}
  </soapenv:Body>
</soapenv:Envelope>`;
  }

  /**
   * Envía petición SOAP genérica
   */
  private async sendSoapRequest(action: string, bodyContent: string): Promise<SoapResponse<any>> {
    const soapEnvelope = this.buildSoapEnvelope(bodyContent);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': `urn:${action}`,
          'User-Agent': 'SUNAT-Wrapper/1.0.0',
        },
        body: soapEnvelope,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseText = await response.text();

      if (!response.ok) {
        return this.parseSoapFault(responseText, response.status);
      }

      return {
        success: true,
        data: responseText,
        rawResponse: responseText,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          success: false,
          error: {
            code: 'TIMEOUT',
            message: `Request timeout after ${this.timeout}ms`,
            isRetryable: true,
          },
        };
      }

      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: error instanceof Error ? error.message : 'Network error',
          isRetryable: true,
        },
      };
    }
  }

  /**
   * Parsea Fault SOAP
   */
  private parseSoapFault(xml: string, httpStatus: number): SoapResponse<string> {
    const faultCodeMatch = xml.match(/<faultcode>([^<]+)<\/faultcode>/);
    const faultStringMatch = xml.match(/<faultstring>([^<]+)<\/faultstring>/);
    const detailMatch = xml.match(/<detail>([\s\S]*?)<\/detail>/);

    return {
      success: false,
      error: {
        code: faultCodeMatch ? faultCodeMatch[1] : `HTTP_${httpStatus}`,
        message: faultStringMatch ? faultStringMatch[1] : 'SOAP Fault',
        detail: detailMatch ? detailMatch[1] : undefined,
        isRetryable: httpStatus >= 500,
      },
      rawResponse: xml,
    };
  }

  /**
   * sendBill - Envío síncrono de comprobantes
   * Tipos: 01 (Factura), 03 (Boleta), 07 (Nota Crédito), 08 (Nota Débito)
   */
  async sendBill(fileName: string, zipBase64: string): Promise<SoapResponse<SendBillResponse>> {
    const bodyContent = `<sendBill xmlns="urn:sunat:billService">
  <fileName>${fileName}</fileName>
  <contentFile>${zipBase64}</contentFile>
</sendBill>`;

    const result = await this.sendSoapRequest('sendBill', bodyContent);
    
    if (!result.success || !result.data) {
      return result as SoapResponse<SendBillResponse>;
    }

    // Parsear respuesta sendBillResponse
    const appResponseMatch = result.data.match(/<applicationResponse>([^<]+)<\/applicationResponse>/);
    if (!appResponseMatch) {
      return {
        success: false,
        error: {
          code: 'PARSE_ERROR',
          message: 'No applicationResponse in sendBill response',
          isRetryable: false,
        },
        rawResponse: result.data,
      };
    }

    return {
      success: true,
      data: {
        applicationResponse: appResponseMatch[1],
      },
      rawResponse: result.data,
    };
  }

  /**
   * sendSummary - Envío asíncrono de Resumen Diario / Comunicación de Baja
   */
  async sendSummary(fileName: string, zipBase64: string): Promise<SoapResponse<SendSummaryResponse>> {
    const bodyContent = `<sendSummary xmlns="urn:sunat:billService">
  <fileName>${fileName}</fileName>
  <contentFile>${zipBase64}</contentFile>
</sendSummary>`;

    const result = await this.sendSoapRequest('sendSummary', bodyContent);
    
    if (!result.success || !result.data) {
      return result as SoapResponse<SendSummaryResponse>;
    }

    const ticketMatch = result.data.match(/<ticket>([^<]+)<\/ticket>/);
    if (!ticketMatch) {
      return {
        success: false,
        error: {
          code: 'PARSE_ERROR',
          message: 'No ticket in sendSummary response',
          isRetryable: false,
        },
        rawResponse: result.data,
      };
    }

    return {
      success: true,
      data: {
        ticket: ticketMatch[1],
      },
      rawResponse: result.data,
    };
  }

  /**
   * sendPack - Envío asíncrono de lote de comprobantes (máx 500)
   */
  async sendPack(fileName: string, zipBase64: string): Promise<SoapResponse<SendSummaryResponse>> {
    const bodyContent = `<sendPack xmlns="urn:sunat:billService">
  <fileName>${fileName}</fileName>
  <contentFile>${zipBase64}</contentFile>
</sendPack>`;

    const result = await this.sendSoapRequest('sendPack', bodyContent);
    
    if (!result.success || !result.data) {
      return result as SoapResponse<SendSummaryResponse>;
    }

    const ticketMatch = result.data.match(/<ticket>([^<]+)<\/ticket>/);
    if (!ticketMatch) {
      return {
        success: false,
        error: {
          code: 'PARSE_ERROR',
          message: 'No ticket in sendPack response',
          isRetryable: false,
        },
        rawResponse: result.data,
      };
    }

    return {
      success: true,
      data: {
        ticket: ticketMatch[1],
      },
      rawResponse: result.data,
    };
  }

  /**
   * getStatus - Consulta estado de ticket asíncrono
   */
  async getStatus(ticket: string): Promise<SoapResponse<GetStatusResponse>> {
    const bodyContent = `<getStatus xmlns="urn:sunat:billService">
  <ticket>${ticket}</ticket>
</getStatus>`;

    const result = await this.sendSoapRequest('getStatus', bodyContent);
    
    if (!result.success || !result.data) {
      return result as SoapResponse<GetStatusResponse>;
    }

    const statusCodeMatch = result.data.match(/<statusCode>([^<]+)<\/statusCode>/);
    const statusMessageMatch = result.data.match(/<statusMessage>([^<]+)<\/statusMessage>/);
    const contentMatch = result.data.match(/<content>([^<]+)<\/content>/);

    const statusCode = statusCodeMatch ? parseInt(statusCodeMatch[1], 10) : -1;

    return {
      success: true,
      data: {
        statusCode,
        statusMessage: statusMessageMatch ? statusMessageMatch[1] : '',
        content: contentMatch ? contentMatch[1] : undefined,
      },
      rawResponse: result.data,
    };
  }

  /**
   * getStatusCdr - Consulta directa de CDR
   */
  async getStatusCdr(
    ruc: string,
    documentType: string,
    series: string,
    correlative: number
  ): Promise<SoapResponse<GetStatusCdrResponse>> {
    const bodyContent = `<getStatusCdr xmlns="urn:sunat:billService">
  <ruc>${ruc}</ruc>
  <documentType>${documentType}</documentType>
  <series>${series}</series>
  <correlative>${correlative}</correlative>
</getStatusCdr>`;

    const result = await this.sendSoapRequest('getStatusCdr', bodyContent);
    
    if (!result.success || !result.data) {
      return result as SoapResponse<GetStatusCdrResponse>;
    }

    const statusCodeMatch = result.data.match(/<statusCode>([^<]+)<\/statusCode>/);
    const statusMessageMatch = result.data.match(/<statusMessage>([^<]+)<\/statusMessage>/);
    const contentMatch = result.data.match(/<content>([^<]+)<\/content>/);

    const statusCode = statusCodeMatch ? parseInt(statusCodeMatch[1], 10) : -1;

    return {
      success: true,
      data: {
        statusCode,
        statusMessage: statusMessageMatch ? statusMessageMatch[1] : '',
        content: contentMatch ? contentMatch[1] : undefined,
      },
      rawResponse: result.data,
    };
  }
}

export const createSoapClient = (credentials: SunatCredentials, timeout?: number) => 
  new SoapClient(credentials, timeout);