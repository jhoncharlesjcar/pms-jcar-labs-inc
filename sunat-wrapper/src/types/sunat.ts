/**
 * SUNAT UBL 2.0 Types
 * Tipos TypeScript para documentos UBL 2.0 según especificaciones SUNAT
 * Referencia: Manual de Programador UBL 2.0 SUNAT
 */

// ============================================================================
// Enums y Constantes
// ============================================================================

export enum DocumentType {
  FACTURA = '01',
  BOLETA = '03',
  NOTA_CREDITO = '07',
  NOTA_DEBITO = '08',
  RESUMEN_DIARIO = 'RC',
  COMUNICACION_BAJA = 'RA',
}

export enum DocumentTypeName {
  FACTURA = 'Invoice',
  BOLETA = 'Invoice', // Boletas usan Invoice en UBL
  NOTA_CREDITO = 'CreditNote',
  NOTA_DEBITO = 'DebitNote',
}

export enum CurrencyCode {
  PEN = 'PEN',
  USD = 'USD',
}

export enum TaxTypeCode {
  IGV = '1000',      // IGV - Impuesto General a las Ventas
  ISC = '2000',      // ISC - Impuesto Selectivo al Consumo
  OTROS = '9999',    // Otros tributos
  EXPORTACION = '9998', // Exportación
}

export enum TaxSubTypeCode {
  IGV_GRAVADO = '10',    // Gravado - Operación Onerosa
  IGV_EXONERADO = '20',  // Exonerado - Operación Onerosa
  IGV_INAFECTO = '30',   // Inafecto - Operación Onerosa
  IGV_EXPORTACION = '40', // Exportación
}

export enum UnitCode {
  UNIDAD = 'NIU',     // Unidad (NIU - Número de Items Unitarios)
  KILOGRAMO = 'KGM',
  LITRO = 'LTR',
  METRO = 'MTR',
  METRO_CUADRADO = 'MTK',
  METRO_CUBICO = 'MTQ',
  PAQUETE = 'PK',
  CAJA = 'BX',
  BOLSA = 'BG',
  UNIDAD_SERVICIO = 'ZZ', // Para servicios
}

export enum PartyTypeCode {
  RUC = '6',
  DNI = '1',
  CARNET_EXTRANJERIA = '4',
  PASAPORTE = '7',
  OTROS = '0',
}

export enum InvoiceTypeCode {
  FACTURA = '01',
  BOLETA = '03',
  NOTA_CREDITO = '07',
  NOTA_DEBITO = '08',
  GUIA_REMISION = '09',
}

export enum NoteTypeCode {
  ANULACION = '01',           // Anulación de la operación
  ANULACION_ERROR = '02',     // Anulación por error en el RUC
  CORRECCION_DESCRIPCION = '03', // Corrección por error en la descripción
  DESCUENTO_GLOBAL = '04',    // Descuento global
  DESCUENTO_ITEM = '05',      // Descuento por item
  DEVOLUCION_TOTAL = '06',    // Devolución total
  DEVOLUCION_PARCIAL = '07',  // Devolución parcial
  BONIFICACION = '08',        // Bonificación
  DISMINUCION_VALOR = '09',   // Disminución en el valor
  OTROS_CONCEPTOS = '10',     // Otros conceptos
  AJUSTES_PRECIOS = '11',     // Ajustes de precios
  AUMENTO_VALOR = '12',       // Aumento en el valor
  PENALIDADES = '13',         // Penalidades/Intereses
}

// ============================================================================
// Interfaces Base
// ============================================================================

export interface UBLExtension {
  extensionContent: string; // XMLDSig Signature
}

export interface UBLExtensions {
  ext: UBLExtension[];
}

export interface Identifier {
  value: string;
  schemeID?: string;
  schemeName?: string;
  schemeAgencyName?: string;
}

export interface PartyIdentification {
  id: Identifier;
}

export interface PartyName {
  name: string;
}

export interface PostalAddress {
  id?: string;
  streetName?: string;
  citySubdivisionName?: string; // Urbanización
  cityName?: string;            // Distrito
  countrySubentity?: string;    // Provincia
  district?: string;            // Distrito
  province?: string;            // Provincia
  department?: string;          // Departamento
  countryCode?: string;         // PE
}

export interface PartyLegalEntity {
  registrationName: string;
  registrationAddress?: PostalAddress;
}

export interface Party {
  partyIdentification: PartyIdentification[];
  partyName: PartyName;
  postalAddress?: PostalAddress;
  partyLegalEntity: PartyLegalEntity;
}

export interface TaxScheme {
  id: string;           // 1000, 2000, 9999
  name: string;         // IGV, ISC, OTROS
  taxTypeCode: string;  // VAT, EXC, OTH
}

export interface TaxCategory {
  id: string;           // S, E, O, Z, G
  percent: number;      // 18.00, 0.00
  taxExemptionReasonCode?: string; // 10, 20, 30, 40
  taxScheme: TaxScheme;
}

export interface TaxTotal {
  taxAmount: {
    value: number;
    currencyID: CurrencyCode;
  };
  taxSubtotal: TaxSubtotal[];
}

export interface TaxSubtotal {
  taxableAmount: {
    value: number;
    currencyID: CurrencyCode;
  };
  taxAmount: {
    value: number;
    currencyID: CurrencyCode;
  };
  taxCategory: TaxCategory;
}

export interface MonetaryTotal {
  lineExtensionAmount: { value: number; currencyID: CurrencyCode };
  taxExclusiveAmount: { value: number; currencyID: CurrencyCode };
  taxInclusiveAmount: { value: number; currencyID: CurrencyCode };
  allowanceTotalAmount?: { value: number; currencyID: CurrencyCode };
  chargeTotalAmount?: { value: number; currencyID: CurrencyCode };
  payableRoundingAmount?: { value: number; currencyID: CurrencyCode };
  payableAmount: { value: number; currencyID: CurrencyCode };
}

export interface BillingReference {
  invoiceDocumentReference: DocumentReference;
}

export interface DocumentReference {
  id: string;
  documentTypeCode?: string;
  attachment?: {
    embeddedDocumentBinaryObject: {
      value: string; // Base64
      mimeCode: string;
      encodingCode: string;
      filename: string;
    };
  };
}

export interface Signature {
  id: string;
  signatoryParty: Party;
  digitalSignatureAttachment: {
    externalReference: {
      uri: string;
    };
  };
}

export interface PaymentTerms {
  id: string;
  paymentMeansID: string;
  amount?: { value: number; currencyID: CurrencyCode };
}

export interface PaymentMeans {
  id: string;
  paymentMeansCode: string; // Forma de pago: Contado, Credito
  paymentDueDate?: string;
  payeeFinancialAccount?: {
    id: string;
    name?: string;
    financialInstitutionBranch?: {
      id: string;
      name: string;
    };
  };
}

export interface AllowanceCharge {
  chargeIndicator: boolean; // false = allowance (descuento), true = charge (cargo)
  allowanceChargeReason: string;
  amount: { value: number; currencyID: CurrencyCode };
  baseAmount?: { value: number; currencyID: CurrencyCode };
  multiplierFactorNumeric?: number;
  taxCategory?: TaxCategory;
}

// ============================================================================
// Invoice / Boleta / Nota Crédito / Nota Débito
// ============================================================================

export interface InvoiceLine {
  id: string;
  invoicedQuantity: { value: number; unitCode: UnitCode };
  lineExtensionAmount: { value: number; currencyID: CurrencyCode };
  pricingReference?: {
    alternativeConditionPrice: {
      priceAmount: { value: number; currencyID: CurrencyCode };
      priceTypeCode: string; // 01 = Precio unitario
    };
  };
  allowanceCharge?: AllowanceCharge[];
  taxTotal: TaxTotal[];
  item: Item;
  price: Price;
}

export interface Item {
  description: string;
  name?: string;
  sellersItemIdentification?: {
    id: string;
  };
  commodityClassification?: {
    itemClassificationCode: string;
    listID: string;
    listName: string;
    listAgencyName: string;
  };
  commodityClassificationScheme?: {
    id: string;
    name: string;
  };
}

export interface Price {
  priceAmount: { value: number; currencyID: CurrencyCode };
  baseQuantity?: { value: number; unitCode: UnitCode };
}

// ============================================================================
// Documentos Principales
// ============================================================================

export interface BaseDocument {
  ublVersionID: string;
  customizationID: string;
  id: string;                    // RUC-TIPO-SERIE-CORRELATIVO
  issueDate: string;             // YYYY-MM-DD
  issueTime: string;             // HH:MM:SS
  invoiceTypeCode: string;       // 01, 03, 07, 08
  note?: string[];               // Observaciones
  documentCurrencyCode: CurrencyCode;
  accountingSupplierParty: Party;
  accountingCustomerParty: Party;
  taxTotal: TaxTotal[];
  legalMonetaryTotal: MonetaryTotal;
  invoiceLine: InvoiceLine[];
  paymentTerms?: PaymentTerms[];
  paymentMeans?: PaymentMeans[];
  billingReference?: BillingReference[]; // Para notas crédito/débito
  additionalDocumentReference?: DocumentReference[]; // Para QR, PDF, etc.
}

export interface Invoice extends BaseDocument {
  invoiceTypeCode: InvoiceTypeCode.FACTURA | InvoiceTypeCode.BOLETA;
}

export interface CreditNote extends BaseDocument {
  invoiceTypeCode: InvoiceTypeCode.NOTA_CREDITO;
  discrepancyResponse: {
    referenceID: string;
    responseCode: string; // Catálogo 09
    description: string;
  }[];
  billingReference: BillingReference[]; // Obligatorio
}

export interface DebitNote extends BaseDocument {
  invoiceTypeCode: InvoiceTypeCode.NOTA_DEBITO;
  discrepancyResponse: {
    referenceID: string;
    responseCode: string; // Catálogo 09
    description: string;
  }[];
  billingReference: BillingReference[]; // Obligatorio
}

// ============================================================================
// Resumen Diario y Comunicación de Baja
// ============================================================================

export interface SummaryDocumentLine {
  id: string;
  documentTypeCode: string;
  documentSerialID: string;
  startDocumentNumberID: number;
  endDocumentNumberID: number;
  totalAmount: { value: number; currencyID: CurrencyCode };
  billingPayment: {
    paidAmount: { value: number; currencyID: CurrencyCode };
    instructionID: string;
  }[];
  allowanceCharge?: AllowanceCharge[];
  taxTotal: TaxTotal[];
}

export interface SummaryDocuments {
  ublVersionID: string;
  customizationID: string;
  id: string; // RUC-RA-YYYYMMDD-XXXX
  issueDate: string;
  issueTime: string;
  note?: string[];
  accountingSupplierParty: Party;
  summaryDocumentLine: SummaryDocumentLine[];
}

// ============================================================================
// Request/Response DTOs para la API
// ============================================================================

export interface SendBillRequest {
  document: Invoice | CreditNote | DebitNote;
  certificate?: {
    pfxBase64?: string;
    pfxPassword?: string;
    privateKeyPem?: string;
    certificatePem?: string;
  };
}

export interface SendBillResponse {
  success: boolean;
  ticket?: string;
  cdr?: CDRResponse;
  error?: SunatError;
  zipBase64?: string;
  xmlBase64?: string;
}

export interface SendSummaryRequest {
  summary: SummaryDocuments;
  certificate?: {
    pfxBase64?: string;
    pfxPassword?: string;
    privateKeyPem?: string;
    certificatePem?: string;
  };
}

export interface SendSummaryResponse {
  success: boolean;
  ticket: string;
  error?: SunatError;
  zipBase64?: string;
}

export interface GetStatusRequest {
  ticket: string;
}

export interface GetStatusResponse {
  success: boolean;
  statusCode: number; // 0 = procesado, 98 = en proceso, 99 = error
  statusMessage: string;
  cdr?: CDRResponse;
  error?: SunatError;
}

export interface GetStatusCdrRequest {
  ruc: string;
  documentType: DocumentType;
  series: string;
  correlativo: number;
}

export interface SendPackRequest {
  documents: Array<Invoice | CreditNote | DebitNote>;
  certificate?: {
    pfxBase64?: string;
    pfxPassword?: string;
    privateKeyPem?: string;
    certificatePem?: string;
  };
}

export interface CDRResponse {
  responseCode: string;
  description: string;
  notes?: string[];
  signature?: {
    digestValue: string;
    signatureValue: string;
    x509Certificate: string;
  };
  documentReference?: {
    uuid: string;
  };
}

export interface SunatError {
  code: string;
  message: string;
  detail?: string;
  isRetryable: boolean;
}

// ============================================================================
// Configuración de Certificado
// ============================================================================

export interface CertificateConfig {
  pfxBase64?: string;
  pfxPassword?: string;
  privateKeyPem?: string;
  certificatePem?: string;
}

export interface SunatCredentials {
  ruc: string;
  usuarioSol: string;
  claveSol: string;
  endpoint: string;
}

export interface SignedDocument {
  xml: string;
  xmlBase64: string;
  zipBase64: string;
  fileName: string;
  hash: string; // SHA-256 del XML firmado
}