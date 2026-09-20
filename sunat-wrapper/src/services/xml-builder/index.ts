/**
 * XML UBL 2.0 Builder Service
 * Construye documentos XML UBL 2.0 válidos para SUNAT
 * Usa xmlbuilder2 para generar XML estructurado y válido
 */

import { create } from 'xmlbuilder2';
import { 
  Invoice, 
  CreditNote, 
  DebitNote, 
  SummaryDocuments,
  DocumentType,
  DocumentTypeName,
  CurrencyCode,
  TaxTypeCode,
  TaxSubTypeCode,
  UnitCode,
  PartyTypeCode,
  InvoiceTypeCode,
  SignedDocument
} from '@/types/sunat';

export class XmlBuilderService {
  private readonly NAMESPACES = {
    'xmlns:cac': 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
    'xmlns:cbc': 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
    'xmlns:ext': 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2',
    'xmlns:ds': 'http://www.w3.org/2000/09/xmldsig#',
    'xmlns:qdt': 'urn:oasis:names:specification:ubl:schema:xsd:QualifiedDatatypes-2',
    'xmlns:sac': 'urn:sunat:names:specification:ubl:peru:schema:xsd:SunatAggregateComponents-1',
    'xmlns:udt': 'urn:un:unece:uncefact:data:specification:UnqualifiedDataTypesSchemaModule:2',
    'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
  };

  private readonly UBL_VERSION = '2.1';
  private readonly CUSTOMIZATION_ID = '2.0';

  /**
   * Construye una Factura (01) o Boleta (03)
   */
  buildInvoice(doc: Invoice): string {
    const root = create({ version: '1.0', encoding: 'UTF-8' })
      .ele('Invoice', this.NAMESPACES);

    this.addCommonElements(root, doc);
    this.addInvoiceLines(root, doc.invoiceLine);

    return root.end({ prettyPrint: true });
  }

  /**
   * Construye una Nota de Crédito (07)
   */
  buildCreditNote(doc: CreditNote): string {
    const root = create({ version: '1.0', encoding: 'UTF-8' })
      .ele('CreditNote', this.NAMESPACES);

    this.addCommonElements(root, doc);
    this.addDiscrepancyResponse(root, doc.discrepancyResponse);
    this.addBillingReference(root, doc.billingReference);
    this.addInvoiceLines(root, doc.invoiceLine);

    return root.end({ prettyPrint: true });
  }

  /**
   * Construye una Nota de Débito (08)
   */
  buildDebitNote(doc: DebitNote): string {
    const root = create({ version: '1.0', encoding: 'UTF-8' })
      .ele('DebitNote', this.NAMESPACES);

    this.addCommonElements(root, doc);
    this.addDiscrepancyResponse(root, doc.discrepancyResponse);
    this.addBillingReference(root, doc.billingReference);
    this.addInvoiceLines(root, doc.invoiceLine);

    return root.end({ prettyPrint: true });
  }

  /**
   * Construye Resumen Diario / Comunicación de Baja
   */
  buildSummary(doc: SummaryDocuments): string {
    const root = create({ version: '1.0', encoding: 'UTF-8' })
      .ele('SummaryDocuments', this.NAMESPACES);

    // UBLVersionID
    root.ele('cbc:UBLVersionID', this.UBL_VERSION).up();
    
    // CustomizationID
    root.ele('cbc:CustomizationID', this.CUSTOMIZATION_ID).up();

    // ID
    root.ele('cbc:ID', doc.id).up();

    // IssueDate
    root.ele('cbc:IssueDate', doc.issueDate).up();

    // IssueTime
    root.ele('cbc:IssueTime', doc.issueTime).up();

    // Note
    if (doc.note?.length) {
      doc.note.forEach(n => root.ele('cbc:Note', n).up());
    }

    // AccountingSupplierParty
    this.addParty(root, 'cac:AccountingSupplierParty', doc.accountingSupplierParty);

    // SummaryDocumentLine
    doc.summaryDocumentLine.forEach(line => this.addSummaryDocumentLine(root, line));

    return root.end({ prettyPrint: true });
  }

  /**
   * Inserta la firma XMLDSig en el documento
   */
  insertSignature(xml: string, signatureXml: string): string {
    // Usar manipulación de string simple para evitar problemas de tipos con xmlbuilder2
    const ublExtensionsRegex = /(<ext:UBLExtensions>[\s\S]*?<ext:UBLExtension>[\s\S]*?<ext:ExtensionContent>)([\s\S]*?)(<\/ext:ExtensionContent>[\s\S]*?<\/ext:UBLExtension>[\s\S]*?<\/ext:UBLExtensions>)/;
    const match = xml.match(ublExtensionsRegex);
    
    if (match) {
      // Reemplazar contenido existente
      return xml.replace(ublExtensionsRegex, `$1${signatureXml}$3`);
    } else {
      // Insertar UBLExtensions después del elemento raíz
      const rootEnd = xml.indexOf('>');
      if (rootEnd !== -1) {
        const prefix = xml.substring(0, rootEnd + 1);
        const suffix = xml.substring(rootEnd + 1);
        const ublExts = `<ext:UBLExtensions><ext:UBLExtension><ext:ExtensionContent>${signatureXml}</ext:ExtensionContent></ext:UBLExtension></ext:UBLExtensions>`;
        return prefix + ublExts + suffix;
      }
    }
    
    return xml;
  }

  // =========================================================================
  // Métodos privados
  // =========================================================================

  private addCommonElements(root: any, doc: Invoice | CreditNote | DebitNote): void {
    // UBLVersionID
    root.ele('cbc:UBLVersionID', this.UBL_VERSION).up();
    
    // CustomizationID
    root.ele('cbc:CustomizationID', this.CUSTOMIZATION_ID).up();

    // ID (RUC-TIPO-SERIE-CORRELATIVO)
    root.ele('cbc:ID', doc.id).up();

    // IssueDate
    root.ele('cbc:IssueDate', doc.issueDate).up();

    // IssueTime
    root.ele('cbc:IssueTime', doc.issueTime).up();

    // InvoiceTypeCode
    root.ele('cbc:InvoiceTypeCode', { listID: '0101', listAgencyName: 'PE:SUNAT', listName: 'Tipo de Documento' }, doc.invoiceTypeCode).up();

    // Note (observaciones)
    if (doc.note?.length) {
      doc.note.forEach(n => root.ele('cbc:Note', n).up());
    }

    // DocumentCurrencyCode
    root.ele('cbc:DocumentCurrencyCode', { listID: 'ISO 4217', listAgencyName: 'United Nations Economic Commission for Europe' }, doc.documentCurrencyCode).up();

    // AccountingSupplierParty (Emisor)
    this.addParty(root, 'cac:AccountingSupplierParty', doc.accountingSupplierParty);

    // AccountingCustomerParty (Receptor/Adquiriente)
    this.addParty(root, 'cac:AccountingCustomerParty', doc.accountingCustomerParty);

    // TaxTotal
    doc.taxTotal.forEach(tt => this.addTaxTotal(root, tt));

    // LegalMonetaryTotal
    this.addLegalMonetaryTotal(root, doc.legalMonetaryTotal);

    // PaymentTerms
    if (doc.paymentTerms?.length) {
      doc.paymentTerms.forEach(pt => this.addPaymentTerms(root, pt));
    }

    // PaymentMeans
    if (doc.paymentMeans?.length) {
      doc.paymentMeans.forEach(pm => this.addPaymentMeans(root, pm));
    }

    // AdditionalDocumentReference (QR, PDF, etc.)
    if (doc.additionalDocumentReference?.length) {
      doc.additionalDocumentReference.forEach(dr => this.addAdditionalDocumentReference(root, dr));
    }
  }

  private addParty(root: any, elementName: string, party: any): void {
    const partyEl = root.ele(elementName);

    // PartyIdentification
    party.partyIdentification.forEach((pi: any) => {
      const pid = partyEl.ele('cac:PartyIdentification');
      pid.ele('cbc:ID', { 
        schemeID: pi.id.schemeID || '6', 
        schemeName: pi.id.schemeName || 'SUNAT:Identificador de Documento de Identidad',
        schemeAgencyName: pi.id.schemeAgencyName || 'PE:SUNAT'
      }, pi.id.value).up();
    });

    // PartyName
    partyEl.ele('cac:PartyName').ele('cbc:Name', party.partyName.name).up().up();

    // PostalAddress
    if (party.postalAddress) {
      const addr = partyEl.ele('cac:PostalAddress');
      if (party.postalAddress.id) addr.ele('cbc:ID', party.postalAddress.id).up();
      if (party.postalAddress.streetName) addr.ele('cbc:StreetName', party.postalAddress.streetName).up();
      if (party.postalAddress.citySubdivisionName) addr.ele('cbc:CitySubdivisionName', party.postalAddress.citySubdivisionName).up();
      if (party.postalAddress.cityName) addr.ele('cbc:CityName', party.postalAddress.cityName).up();
      if (party.postalAddress.countrySubentity) addr.ele('cbc:CountrySubentity', party.postalAddress.countrySubentity).up();
      if (party.postalAddress.district) addr.ele('cbc:District', party.postalAddress.district).up();
      if (party.postalAddress.province) addr.ele('cbc:Province', party.postalAddress.province).up();
      if (party.postalAddress.department) addr.ele('cbc:Department', party.postalAddress.department).up();
      if (party.postalAddress.countryCode) {
        addr.ele('cac:Country').ele('cbc:IdentificationCode', party.postalAddress.countryCode).up().up();
      }
    }

    // PartyLegalEntity
    const legal = partyEl.ele('cac:PartyLegalEntity');
    legal.ele('cbc:RegistrationName', party.partyLegalEntity.registrationName).up();
    if (party.partyLegalEntity.registrationAddress) {
      this.addPostalAddress(legal, party.partyLegalEntity.registrationAddress);
    }
  }

  private addPostalAddress(parent: any, addr: any): void {
    const addrEl = parent.ele('cac:RegistrationAddress');
    if (addr.id) addrEl.ele('cbc:ID', addr.id).up();
    if (addr.streetName) addrEl.ele('cbc:StreetName', addr.streetName).up();
    if (addr.citySubdivisionName) addrEl.ele('cbc:CitySubdivisionName', addr.citySubdivisionName).up();
    if (addr.cityName) addrEl.ele('cbc:CityName', addr.cityName).up();
    if (addr.countrySubentity) addrEl.ele('cbc:CountrySubentity', addr.countrySubentity).up();
    if (addr.district) addrEl.ele('cbc:District', addr.district).up();
    if (addr.province) addrEl.ele('cbc:Province', addr.province).up();
    if (addr.department) addrEl.ele('cbc:Department', addr.department).up();
    if (addr.countryCode) {
      addrEl.ele('cac:Country').ele('cbc:IdentificationCode', addr.countryCode).up().up();
    }
  }

  private addTaxTotal(root: any, taxTotal: any): void {
    const tt = root.ele('cac:TaxTotal');
    tt.ele('cbc:TaxAmount', { currencyID: taxTotal.taxAmount.currencyID }, taxTotal.taxAmount.value.toFixed(2)).up();
    
    taxTotal.taxSubtotal.forEach((st: any) => {
      const tst = tt.ele('cac:TaxSubtotal');
      tst.ele('cbc:TaxableAmount', { currencyID: st.taxableAmount.currencyID }, st.taxableAmount.value.toFixed(2)).up();
      tst.ele('cbc:TaxAmount', { currencyID: st.taxAmount.currencyID }, st.taxAmount.value.toFixed(2)).up();
      
      const tc = tst.ele('cac:TaxCategory');
      tc.ele('cbc:ID', st.taxCategory.id).up();
      tc.ele('cbc:Percent', st.taxCategory.percent.toFixed(2)).up();
      if (st.taxCategory.taxExemptionReasonCode) {
        tc.ele('cbc:TaxExemptionReasonCode', st.taxCategory.taxExemptionReasonCode).up();
      }
      const ts = tc.ele('cac:TaxScheme');
      ts.ele('cbc:ID', st.taxCategory.taxScheme.id).up();
      ts.ele('cbc:Name', st.taxCategory.taxScheme.name).up();
      ts.ele('cbc:TaxTypeCode', st.taxCategory.taxScheme.taxTypeCode).up();
    });
  }

  private addLegalMonetaryTotal(root: any, total: any): void {
    const lmt = root.ele('cac:LegalMonetaryTotal');
    lmt.ele('cbc:LineExtensionAmount', { currencyID: total.lineExtensionAmount.currencyID }, total.lineExtensionAmount.value.toFixed(2)).up();
    lmt.ele('cbc:TaxExclusiveAmount', { currencyID: total.taxExclusiveAmount.currencyID }, total.taxExclusiveAmount.value.toFixed(2)).up();
    lmt.ele('cbc:TaxInclusiveAmount', { currencyID: total.taxInclusiveAmount.currencyID }, total.taxInclusiveAmount.value.toFixed(2)).up();
    if (total.allowanceTotalAmount) {
      lmt.ele('cbc:AllowanceTotalAmount', { currencyID: total.allowanceTotalAmount.currencyID }, total.allowanceTotalAmount.value.toFixed(2)).up();
    }
    if (total.chargeTotalAmount) {
      lmt.ele('cbc:ChargeTotalAmount', { currencyID: total.chargeTotalAmount.currencyID }, total.chargeTotalAmount.value.toFixed(2)).up();
    }
    if (total.payableRoundingAmount) {
      lmt.ele('cbc:PayableRoundingAmount', { currencyID: total.payableRoundingAmount.currencyID }, total.payableRoundingAmount.value.toFixed(2)).up();
    }
    lmt.ele('cbc:PayableAmount', { currencyID: total.payableAmount.currencyID }, total.payableAmount.value.toFixed(2)).up();
  }

  private addInvoiceLines(root: any, lines: any[]): void {
    lines.forEach((line, index) => {
      const il = root.ele('cac:InvoiceLine');
      il.ele('cbc:ID', (index + 1).toString()).up();
      il.ele('cbc:InvoicedQuantity', { unitCode: line.invoicedQuantity.unitCode }, line.invoicedQuantity.value.toFixed(4)).up();
      il.ele('cbc:LineExtensionAmount', { currencyID: line.lineExtensionAmount.currencyID }, line.lineExtensionAmount.value.toFixed(2)).up();

      // PricingReference
      if (line.pricingReference) {
        const pr = il.ele('cac:PricingReference');
        pr.ele('cac:AlternativeConditionPrice')
          .ele('cbc:PriceAmount', { currencyID: line.pricingReference.alternativeConditionPrice.priceAmount.currencyID }, line.pricingReference.alternativeConditionPrice.priceAmount.value.toFixed(4)).up()
          .ele('cbc:PriceTypeCode', '01').up()
        .up();
      }

      // AllowanceCharge
      if (line.allowanceCharge?.length) {
        line.allowanceCharge.forEach((ac: any) => this.addAllowanceCharge(il, ac));
      }

      // TaxTotal
      line.taxTotal.forEach((tt: any) => this.addTaxTotal(il, tt));

      // Item
      const item = il.ele('cac:Item');
      item.ele('cbc:Description', line.item.description).up();
      if (line.item.name) item.ele('cbc:Name', line.item.name).up();
      if (line.item.sellersItemIdentification) {
        item.ele('cac:SellersItemIdentification').ele('cbc:ID', line.item.sellersItemIdentification.id).up().up();
      }

      // Price
      const price = il.ele('cac:Price');
      price.ele('cbc:PriceAmount', { currencyID: line.price.priceAmount.currencyID }, line.price.priceAmount.value.toFixed(4)).up();
      if (line.price.baseQuantity) {
        price.ele('cbc:BaseQuantity', { unitCode: line.price.baseQuantity.unitCode }, line.price.baseQuantity.value.toFixed(4)).up();
      }
    });
  }

  private addAllowanceCharge(parent: any, ac: any): void {
    const alc = parent.ele('cac:AllowanceCharge');
    alc.ele('cbc:ChargeIndicator', ac.chargeIndicator).up();
    alc.ele('cbc:AllowanceChargeReason', ac.allowanceChargeReason).up();
    alc.ele('cbc:Amount', { currencyID: ac.amount.currencyID }, ac.amount.value.toFixed(2)).up();
    if (ac.baseAmount) {
      alc.ele('cbc:BaseAmount', { currencyID: ac.baseAmount.currencyID }, ac.baseAmount.value.toFixed(2)).up();
    }
    if (ac.multiplierFactorNumeric !== undefined) {
      alc.ele('cbc:MultiplierFactorNumeric', ac.multiplierFactorNumeric.toString()).up();
    }
    if (ac.taxCategory) {
      const tc = alc.ele('cac:TaxCategory');
      tc.ele('cbc:ID', ac.taxCategory.id).up();
      tc.ele('cbc:Percent', ac.taxCategory.percent.toFixed(2)).up();
      if (ac.taxCategory.taxExemptionReasonCode) {
        tc.ele('cbc:TaxExemptionReasonCode', ac.taxCategory.taxExemptionReasonCode).up();
      }
      const ts = tc.ele('cac:TaxScheme');
      ts.ele('cbc:ID', ac.taxCategory.taxScheme.id).up();
      ts.ele('cbc:Name', ac.taxCategory.taxScheme.name).up();
      ts.ele('cbc:TaxTypeCode', ac.taxCategory.taxScheme.taxTypeCode).up();
    }
  }

  private addDiscrepancyResponse(root: any, responses: any[]): void {
    responses.forEach(r => {
      const dr = root.ele('cac:DiscrepancyResponse');
      dr.ele('cbc:ReferenceID', r.referenceID).up();
      dr.ele('cbc:ResponseCode', r.responseCode).up();
      dr.ele('cbc:Description', r.description).up();
    });
  }

  private addBillingReference(root: any, refs: any[]): void {
    refs.forEach(ref => {
      const br = root.ele('cac:BillingReference');
      const idr = br.ele('cac:InvoiceDocumentReference');
      idr.ele('cbc:ID', ref.invoiceDocumentReference.id).up();
      if (ref.invoiceDocumentReference.documentTypeCode) {
        idr.ele('cbc:DocumentTypeCode', ref.invoiceDocumentReference.documentTypeCode).up();
      }
    });
  }

  private addPaymentTerms(root: any, pt: any): void {
    const ptEl = root.ele('cac:PaymentTerms');
    ptEl.ele('cbc:ID', pt.id).up();
    ptEl.ele('cbc:PaymentMeansID', pt.paymentMeansID).up();
    if (pt.amount) {
      ptEl.ele('cbc:Amount', { currencyID: pt.amount.currencyID }, pt.amount.value.toFixed(2)).up();
    }
  }

  private addPaymentMeans(root: any, pm: any): void {
    const pmEl = root.ele('cac:PaymentMeans');
    pmEl.ele('cbc:ID', pm.id).up();
    pmEl.ele('cbc:PaymentMeansCode', pm.paymentMeansCode).up();
    if (pm.paymentDueDate) {
      pmEl.ele('cbc:PaymentDueDate', pm.paymentDueDate).up();
    }
    if (pm.payeeFinancialAccount) {
      const pfa = pmEl.ele('cac:PayeeFinancialAccount');
      pfa.ele('cbc:ID', pm.payeeFinancialAccount.id).up();
      if (pm.payeeFinancialAccount.name) {
        pfa.ele('cbc:Name', pm.payeeFinancialAccount.name).up();
      }
      if (pm.payeeFinancialAccount.financialInstitutionBranch) {
        const fib = pfa.ele('cac:FinancialInstitutionBranch');
        fib.ele('cbc:ID', pm.payeeFinancialAccount.financialInstitutionBranch.id).up();
        fib.ele('cbc:Name', pm.payeeFinancialAccount.financialInstitutionBranch.name).up();
      }
    }
  }

  private addAdditionalDocumentReference(root: any, dr: any): void {
    const adr = root.ele('cac:AdditionalDocumentReference');
    adr.ele('cbc:ID', dr.id).up();
    if (dr.documentTypeCode) {
      adr.ele('cbc:DocumentTypeCode', dr.documentTypeCode).up();
    }
    if (dr.attachment?.embeddedDocumentBinaryObject) {
      const att = adr.ele('cac:Attachment');
      att.ele('cbc:EmbeddedDocumentBinaryObject', {
        mimeCode: dr.attachment.embeddedDocumentBinaryObject.mimeCode,
        encodingCode: dr.attachment.embeddedDocumentBinaryObject.encodingCode,
        filename: dr.attachment.embeddedDocumentBinaryObject.filename,
        characterSetCode: 'UTF-8'
      }, dr.attachment.embeddedDocumentBinaryObject.value).up();
    }
  }

  private addSummaryDocumentLine(root: any, line: any): void {
    const sdl = root.ele('cac:SummaryDocumentLine');
    sdl.ele('cbc:ID', line.id).up();
    sdl.ele('cbc:DocumentTypeCode', line.documentTypeCode).up();
    sdl.ele('cbc:DocumentSerialID', line.documentSerialID).up();
    sdl.ele('cbc:StartDocumentNumberID', line.startDocumentNumberID.toString()).up();
    sdl.ele('cbc:EndDocumentNumberID', line.endDocumentNumberID.toString()).up();
    sdl.ele('cbc:TotalAmount', { currencyID: line.totalAmount.currencyID }, line.totalAmount.value.toFixed(2)).up();

    line.billingPayment.forEach((bp: any) => {
      const bpe = sdl.ele('cac:BillingPayment');
      bpe.ele('cbc:PaidAmount', { currencyID: bp.paidAmount.currencyID }, bp.paidAmount.value.toFixed(2)).up();
      bpe.ele('cbc:InstructionID', bp.instructionID).up();
    });

    if (line.allowanceCharge?.length) {
      line.allowanceCharge.forEach((ac: any) => this.addAllowanceCharge(sdl, ac));
    }

    line.taxTotal.forEach((tt: any) => this.addTaxTotal(sdl, tt));
  }
}

export const xmlBuilderService = new XmlBuilderService();