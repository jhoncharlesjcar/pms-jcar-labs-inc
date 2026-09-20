/**
 * REST Controllers for SUNAT API
 * Endpoints:
 * - POST /api/v1/comprobantes/enviar-sincrono
 * - POST /api/v1/comprobantes/enviar-resumen
 * - GET  /api/v1/comprobantes/ticket/:ticket
 * - GET  /api/v1/comprobantes/cdr
 * - POST /api/v1/comprobantes/enviar-lote (sendPack)
 * - GET  /api/v1/health
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getSunatService } from '@/services/sunat';
import { 
  SunatErrorParser, 
  SunatException,
  SunatErrorCategory 
} from '@/errors';
import type { 
  CertificateConfig,
  DocumentType,
  CDRResponse,
  SunatError,
} from '@/types/sunat';

// ============================================================================
// Validation Schemas
// ============================================================================

// Certificate config schema
const CertificateSchema = z.object({
  pfxBase64: z.string().optional(),
  pfxPassword: z.string().optional(),
  privateKeyPem: z.string().optional(),
  certificatePem: z.string().optional(),
}).refine(
  data => (data.pfxBase64 && data.pfxPassword) || (data.privateKeyPem && data.certificatePem),
  { message: 'Must provide either PFX (base64 + password) or PEM (privateKey + certificate)' }
);

// Party schemas
const PartyIdentificationSchema = z.object({
  id: z.object({
    value: z.string(),
    schemeID: z.string().optional(),
    schemeName: z.string().optional(),
    schemeAgencyName: z.string().optional(),
  }),
});

const PartyNameSchema = z.object({
  name: z.string(),
});

const PostalAddressSchema = z.object({
  id: z.string().optional(),
  streetName: z.string().optional(),
  citySubdivisionName: z.string().optional(),
  cityName: z.string().optional(),
  countrySubentity: z.string().optional(),
  district: z.string().optional(),
  province: z.string().optional(),
  department: z.string().optional(),
  countryCode: z.string().length(2).optional(),
}).optional();

const PartyLegalEntitySchema = z.object({
  registrationName: z.string(),
  registrationAddress: PostalAddressSchema,
});

const PartySchema = z.object({
  partyIdentification: z.array(PartyIdentificationSchema).min(1),
  partyName: PartyNameSchema,
  postalAddress: PostalAddressSchema,
  partyLegalEntity: PartyLegalEntitySchema,
});

// Tax schemas
const TaxSchemeSchema = z.object({
  id: z.string(),
  name: z.string(),
  taxTypeCode: z.string(),
});

const TaxCategorySchema = z.object({
  id: z.string(),
  percent: z.number(),
  taxExemptionReasonCode: z.string().optional(),
  taxScheme: TaxSchemeSchema,
});

const TaxSubtotalSchema = z.object({
  taxableAmount: z.object({
    value: z.number(),
    currencyID: z.string(),
  }),
  taxAmount: z.object({
    value: z.number(),
    currencyID: z.string(),
  }),
  taxCategory: TaxCategorySchema,
});

const TaxTotalSchema = z.object({
  taxAmount: z.object({
    value: z.number(),
    currencyID: z.string(),
  }),
  taxSubtotal: z.array(TaxSubtotalSchema).min(1),
});

const MonetaryTotalSchema = z.object({
  lineExtensionAmount: z.object({ value: z.number(), currencyID: z.string() }),
  taxExclusiveAmount: z.object({ value: z.number(), currencyID: z.string() }),
  taxInclusiveAmount: z.object({ value: z.number(), currencyID: z.string() }),
  allowanceTotalAmount: z.object({ value: z.number(), currencyID: z.string() }).optional(),
  chargeTotalAmount: z.object({ value: z.number(), currencyID: z.string() }).optional(),
  payableRoundingAmount: z.object({ value: z.number(), currencyID: z.string() }).optional(),
  payableAmount: z.object({ value: z.number(), currencyID: z.string() }),
});

// Item/Price schemas
const ItemSchema = z.object({
  description: z.string(),
  name: z.string().optional(),
  sellersItemIdentification: z.object({ id: z.string() }).optional(),
  commodityClassification: z.object({
    itemClassificationCode: z.string(),
    listID: z.string(),
    listName: z.string(),
    listAgencyName: z.string(),
  }).optional(),
});

const PriceSchema = z.object({
  priceAmount: z.object({ value: z.number(), currencyID: z.string() }),
  baseQuantity: z.object({ value: z.number(), unitCode: z.string() }).optional(),
});

const AllowanceChargeSchema = z.object({
  chargeIndicator: z.boolean(),
  allowanceChargeReason: z.string(),
  amount: z.object({ value: z.number(), currencyID: z.string() }),
  baseAmount: z.object({ value: z.number(), currencyID: z.string() }).optional(),
  multiplierFactorNumeric: z.number().optional(),
  taxCategory: TaxCategorySchema.optional(),
});

const InvoiceLineSchema = z.object({
  id: z.string(),
  invoicedQuantity: z.object({ value: z.number(), unitCode: z.string() }),
  lineExtensionAmount: z.object({ value: z.number(), currencyID: z.string() }),
  pricingReference: z.object({
    alternativeConditionPrice: z.object({
      priceAmount: z.object({ value: z.number(), currencyID: z.string() }),
      priceTypeCode: z.string(),
    }),
  }).optional(),
  allowanceCharge: z.array(AllowanceChargeSchema).optional(),
  taxTotal: z.array(TaxTotalSchema).min(1),
  item: ItemSchema,
  price: PriceSchema,
});

// Document base schema
const BaseDocumentSchema = z.object({
  ublVersionID: z.string().default('2.1'),
  customizationID: z.string().default('2.0'),
  id: z.string().regex(/^\d{11}-\d{2}-[A-Z0-9]{1,4}-\d{1,8}$/),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  issueTime: z.string().regex(/^\d{2}:\d{2}:\d{2}$/),
  invoiceTypeCode: z.string(),
  note: z.array(z.string()).optional(),
  documentCurrencyCode: z.enum(['PEN', 'USD']).default('PEN'),
  accountingSupplierParty: PartySchema,
  accountingCustomerParty: PartySchema,
  taxTotal: z.array(TaxTotalSchema).min(1),
  legalMonetaryTotal: MonetaryTotalSchema,
  invoiceLine: z.array(InvoiceLineSchema).min(1),
  paymentTerms: z.array(z.object({
    id: z.string(),
    paymentMeansID: z.string(),
    amount: z.object({ value: z.number(), currencyID: z.string() }).optional(),
  })).optional(),
  paymentMeans: z.array(z.object({
    id: z.string(),
    paymentMeansCode: z.string(),
    paymentDueDate: z.string().optional(),
    payeeFinancialAccount: z.object({
      id: z.string(),
      name: z.string().optional(),
      financialInstitutionBranch: z.object({
        id: z.string(),
        name: z.string(),
      }).optional(),
    }).optional(),
  })).optional(),
  additionalDocumentReference: z.array(z.object({
    id: z.string(),
    documentTypeCode: z.string().optional(),
    attachment: z.object({
      embeddedDocumentBinaryObject: z.object({
        value: z.string(),
        mimeCode: z.string(),
        encodingCode: z.string(),
        filename: z.string(),
      }),
    }).optional(),
  })).optional(),
});

// Invoice (Factura 01 / Boleta 03)
const InvoiceSchema = BaseDocumentSchema.extend({
  invoiceTypeCode: z.enum(['01', '03']),
});

// Credit Note (07)
const CreditNoteSchema = BaseDocumentSchema.extend({
  invoiceTypeCode: z.literal('07'),
  discrepancyResponse: z.array(z.object({
    referenceID: z.string(),
    responseCode: z.string().regex(/^\d{2}$/),
    description: z.string(),
  })).min(1),
  billingReference: z.array(z.object({
    invoiceDocumentReference: z.object({
      id: z.string(),
      documentTypeCode: z.string().optional(),
    }),
  })).min(1),
});

// Debit Note (08)
const DebitNoteSchema = BaseDocumentSchema.extend({
  invoiceTypeCode: z.literal('08'),
  discrepancyResponse: z.array(z.object({
    referenceID: z.string(),
    responseCode: z.string().regex(/^\d{2}$/),
    description: z.string(),
  })).min(1),
  billingReference: z.array(z.object({
    invoiceDocumentReference: z.object({
      id: z.string(),
      documentTypeCode: z.string().optional(),
    }),
  })).min(1),
});

// Summary Documents (Resumen Diario / Comunicación Baja)
const SummaryDocumentLineSchema = z.object({
  id: z.string(),
  documentTypeCode: z.string(),
  documentSerialID: z.string(),
  startDocumentNumberID: z.number(),
  endDocumentNumberID: z.number(),
  totalAmount: z.object({ value: z.number(), currencyID: z.string() }),
  billingPayment: z.array(z.object({
    paidAmount: z.object({ value: z.number(), currencyID: z.string() }),
    instructionID: z.string(),
  })).min(1),
  allowanceCharge: z.array(AllowanceChargeSchema).optional(),
  taxTotal: z.array(TaxTotalSchema).min(1),
});

const SummaryDocumentsSchema = z.object({
  ublVersionID: z.string().default('2.1'),
  customizationID: z.string().default('2.0'),
  id: z.string(), // RUC-RA-YYYYMMDD-XXXX
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  issueTime: z.string().regex(/^\d{2}:\d{2}:\d{2}$/),
  note: z.array(z.string()).optional(),
  accountingSupplierParty: PartySchema,
  summaryDocumentLine: z.array(SummaryDocumentLineSchema).min(1),
});

// Request schemas
const SendBillRequestSchema = z.object({
  document: z.union([InvoiceSchema, CreditNoteSchema, DebitNoteSchema]),
  certificate: CertificateSchema.optional(),
});

const SendSummaryRequestSchema = z.object({
  summary: SummaryDocumentsSchema,
  certificate: CertificateSchema.optional(),
});

const GetStatusParamsSchema = z.object({
  ticket: z.string().min(1),
});

const GetStatusCdrQuerySchema = z.object({
  ruc: z.string().length(11),
  documentType: z.enum(['01', '03', '07', '08']),
  series: z.string().min(1).max(4),
  correlativo: z.coerce.number().int().positive(),
});

const SendPackRequestSchema = z.object({
  documents: z.array(z.union([InvoiceSchema, CreditNoteSchema, DebitNoteSchema])).min(1).max(500),
  certificate: CertificateSchema.optional(),
});

// ============================================================================
// Type inference
// ============================================================================

type SendBillRequest = z.infer<typeof SendBillRequestSchema>;
type SendSummaryRequest = z.infer<typeof SendSummaryRequestSchema>;
type GetStatusParams = z.infer<typeof GetStatusParamsSchema>;
type GetStatusCdrQuery = z.infer<typeof GetStatusCdrQuerySchema>;
type SendPackRequest = z.infer<typeof SendPackRequestSchema>;

// ============================================================================
// Controller Functions
// ============================================================================

/**
 * POST /api/v1/comprobantes/enviar-sincrono
 * Envío síncrono: Factura (01), Boleta (03), Nota Crédito (07), Nota Débito (08)
 */
export async function sendBillController(
  request: FastifyRequest<{ Body: import('@/types/sunat').SendBillRequest }>,
  reply: FastifyReply
): Promise<void> {
  const sunatService = getSunatService();
  const result = await sunatService.sendBill(request.body);

  if (!result.success) {
    const error = result.error!;
    const statusCode = error.isRetryable ? 503 : 400;
    
    return reply.status(statusCode).send({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        isRetryable: error.isRetryable,
        category: SunatErrorParser.parse(error.code).category,
      },
      zipBase64: result.zipBase64,
      xmlBase64: result.xmlBase64,
    });
  }

  return reply.send({
    success: true,
    cdr: result.cdr,
    zipBase64: result.zipBase64,
    xmlBase64: result.xmlBase64,
  });
}

/**
 * POST /api/v1/comprobantes/enviar-resumen
 * Envío asíncrono: Resumen Diario (RC) / Comunicación de Baja (RA)
 */
export async function sendSummaryController(
  request: FastifyRequest<{ Body: import('@/types/sunat').SendSummaryRequest }>,
  reply: FastifyReply
): Promise<void> {
  const sunatService = getSunatService();
  const result = await sunatService.sendSummary(request.body);

  if (!result.success) {
    const error = result.error!;
    const statusCode = error.isRetryable ? 503 : 400;
    
    return reply.status(statusCode).send({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        isRetryable: error.isRetryable,
        category: SunatErrorParser.parse(error.code).category,
      },
      zipBase64: result.zipBase64,
    });
  }

  return reply.send({
    success: true,
    ticket: result.ticket,
    zipBase64: result.zipBase64,
  });
}

/**
 * POST /api/v1/comprobantes/enviar-lote
 * Envío asíncrono de lote (sendPack) - máximo 500 comprobantes
 */
export async function sendPackController(
  request: FastifyRequest<{ Body: import('@/types/sunat').SendPackRequest }>,
  reply: FastifyReply
): Promise<void> {
  const sunatService = getSunatService();
  
  try {
    const result = await sunatService.sendPack(request.body.documents, request.body.certificate);

    if (!result.success) {
      const error = result.error!;
      const statusCode = error.isRetryable ? 503 : 400;
      
      return reply.status(statusCode).send({
        success: false,
        error: {
          code: error.code,
          message: error.message,
          isRetryable: error.isRetryable,
          category: SunatErrorParser.parse(error.code).category,
        },
        zipBase64: result.zipBase64,
      });
    }

    return reply.send({
      success: true,
      ticket: result.ticket,
      zipBase64: result.zipBase64,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('500')) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message,
          isRetryable: false,
        },
      });
    }
    throw error;
  }
}

/**
 * GET /api/v1/comprobantes/ticket/:ticket
 * Consulta estado de ticket asíncrono
 */
export async function getStatusController(
  request: FastifyRequest<{ Params: GetStatusParams }>,
  reply: FastifyReply
): Promise<void> {
  const sunatService = getSunatService();
  const result = await sunatService.getStatus({ ticket: request.params.ticket });

  if (!result.success) {
    const error = result.error!;
    const statusCode = error.isRetryable ? 503 : 400;
    
    return reply.status(statusCode).send({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        isRetryable: error.isRetryable,
        category: SunatErrorParser.parse(error.code).category,
      },
    });
  }

  return reply.send({
    success: true,
    statusCode: result.statusCode,
    statusMessage: result.statusMessage,
    cdr: result.cdr,
  });
}

/**
 * GET /api/v1/comprobantes/cdr
 * Consulta directa de CDR por RUC, tipo, serie, correlativo
 */
export async function getStatusCdrController(
  request: FastifyRequest<{ Querystring: GetStatusCdrQuery }>,
  reply: FastifyReply
): Promise<void> {
  const sunatService = getSunatService();
  const result = await sunatService.getStatusCdr({
    ruc: request.query.ruc,
    documentType: request.query.documentType as DocumentType,
    series: request.query.series,
    correlativo: request.query.correlativo,
  });

  if (!result.success) {
    const error = result.error!;
    const statusCode = error.isRetryable ? 503 : 400;
    
    return reply.status(statusCode).send({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        isRetryable: error.isRetryable,
        category: SunatErrorParser.parse(error.code).category,
      },
    });
  }

  return reply.send({
    success: true,
    statusCode: result.statusCode,
    statusMessage: result.statusMessage,
    cdr: result.cdr,
  });
}

/**
 * GET /api/v1/health
 * Health check endpoint
 */
export async function healthController(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const sunatService = getSunatService();
  const validation = await sunatService.validateConfiguration();
  const info = sunatService.getServiceInfo();

  const status = validation.valid ? 'healthy' : 'degraded';
  const httpStatus = validation.valid ? 200 : 503;

  return reply.status(httpStatus).send({
    status,
    service: 'SUNAT Wrapper',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: info.environment,
    endpoint: info.endpoint,
    username: info.username,
    hasCertificate: info.hasCertificate,
    validation: {
      valid: validation.valid,
      errors: validation.errors,
      warnings: validation.warnings,
    },
  });
}

/**
 * GET /api/v1/comprobantes/codigos-error
 * Retorna lista de códigos de error SUNAT documentados
 */
export async function errorCodesController(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const codes = SunatErrorParser.getDocumentedCodes();
  return reply.send({
    success: true,
    total: codes.length,
    codes,
  });
}

// ============================================================================
// Route Registration
// ============================================================================

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  // Health
  app.get('/api/v1/health', healthController);

  // Error codes reference
  app.get('/api/v1/comprobantes/codigos-error', errorCodesController);

  // Enviar síncrono (sendBill)
  app.post('/api/v1/comprobantes/enviar-sincrono', {
    schema: {
      body: SendBillRequestSchema,
      response: {
        200: z.object({
          success: z.literal(true),
          cdr: z.any().optional(),
          zipBase64: z.string(),
          xmlBase64: z.string(),
        }),
        400: z.object({
          success: z.literal(false),
          error: z.object({
            code: z.string(),
            message: z.string(),
            isRetryable: z.boolean(),
            category: z.string(),
          }),
          zipBase64: z.string().optional(),
          xmlBase64: z.string().optional(),
        }),
        503: z.object({
          success: z.literal(false),
          error: z.object({
            code: z.string(),
            message: z.string(),
            isRetryable: z.boolean(),
            category: z.string(),
          }),
        }),
      },
    },
  }, sendBillController);

  // Enviar resumen (sendSummary)
  app.post('/api/v1/comprobantes/enviar-resumen', {
    schema: {
      body: SendSummaryRequestSchema,
      response: {
        200: z.object({
          success: z.literal(true),
          ticket: z.string(),
          zipBase64: z.string(),
        }),
        400: z.object({
          success: z.literal(false),
          error: z.object({
            code: z.string(),
            message: z.string(),
            isRetryable: z.boolean(),
            category: z.string(),
          }),
          zipBase64: z.string().optional(),
        }),
        503: z.object({
          success: z.literal(false),
          error: z.object({
            code: z.string(),
            message: z.string(),
            isRetryable: z.boolean(),
            category: z.string(),
          }),
        }),
      },
    },
  }, sendSummaryController);

  // Enviar lote (sendPack)
  app.post('/api/v1/comprobantes/enviar-lote', {
    schema: {
      tags: ['Comprobantes'],
      body: SendPackRequestSchema,
      response: {
        200: z.object({
          success: z.literal(true),
          ticket: z.string(),
          zipBase64: z.string(),
        }),
        400: z.object({
          success: z.literal(false),
          error: z.object({
            code: z.string(),
            message: z.string(),
            isRetryable: z.boolean(),
            category: z.string(),
          }),
          zipBase64: z.string().optional(),
        }),
        503: z.object({
          success: z.literal(false),
          error: z.object({
            code: z.string(),
            message: z.string(),
            isRetryable: z.boolean(),
            category: z.string(),
          }),
        }),
      },
    },
  }, sendPackController);

  // Consultar ticket
  app.get('/api/v1/comprobantes/ticket/:ticket', {
    schema: {
      tags: ['Consultas'],
      params: GetStatusParamsSchema,
      response: {
        200: z.object({
          success: z.literal(true),
          statusCode: z.number(),
          statusMessage: z.string(),
          cdr: z.any().optional(),
        }),
        400: z.object({
          success: z.literal(false),
          error: z.object({
            code: z.string(),
            message: z.string(),
            isRetryable: z.boolean(),
            category: z.string(),
          }),
        }),
        503: z.object({
          success: z.literal(false),
          error: z.object({
            code: z.string(),
            message: z.string(),
            isRetryable: z.boolean(),
            category: z.string(),
          }),
        }),
      },
    },
  }, getStatusController);

  // Consultar CDR directo
  app.get('/api/v1/comprobantes/cdr', {
    schema: {
      tags: ['Consultas'],
      querystring: GetStatusCdrQuerySchema,
      response: {
        200: z.object({
          success: z.literal(true),
          statusCode: z.number(),
          statusMessage: z.string(),
          cdr: z.any().optional(),
        }),
        400: z.object({
          success: z.literal(false),
          error: z.object({
            code: z.string(),
            message: z.string(),
            isRetryable: z.boolean(),
            category: z.string(),
          }),
        }),
        503: z.object({
          success: z.literal(false),
          error: z.object({
            code: z.string(),
            message: z.string(),
            isRetryable: z.boolean(),
            category: z.string(),
          }),
        }),
      },
    },
  }, getStatusCdrController);
}