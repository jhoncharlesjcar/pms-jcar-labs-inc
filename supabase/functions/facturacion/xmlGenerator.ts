// @ts-nocheck — Supabase Edge Function (Deno runtime, npm: specifiers)
import { create } from "npm:xmlbuilder2@3.1.1";
import Decimal from "npm:decimal.js@10.4.3";

// Catálogo 01 (tipo de documento)
export type TipoDocumento = "01" | "03" | "07" | "08";

export interface DetalleLinea {
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
}

export interface ReferenciaComprobante {
  tipoDoc: "01" | "03" | "07" | "08";
  serie: string;
  numero: string;
}

const NS_COMMON = {
  "xmlns:cac": "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
  "xmlns:cbc": "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
  "xmlns:ds":  "http://www.w3.org/2000/09/xmldsig#",
  "xmlns:ext": "urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2",
};

const ROOT_AND_NS: Record<TipoDocumento, { root: string; xmlns: string }> = {
  "01": { root: "Invoice",    xmlns: "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" },
  "03": { root: "Invoice",    xmlns: "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" },
  "07": { root: "CreditNote", xmlns: "urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2" },
  "08": { root: "DebitNote",  xmlns: "urn:oasis:names:specification:ubl:schema:xsd:DebitNote-2" },
};

const TYPE_CODE_ELEMENT: Record<TipoDocumento, string> = {
  "01": "cbc:InvoiceTypeCode",
  "03": "cbc:InvoiceTypeCode",
  "07": "cbc:CreditNoteTypeCode",
  "08": "cbc:DebitNoteTypeCode",
};

const LINE_ELEMENT: Record<TipoDocumento, string> = {
  "01": "cac:InvoiceLine",
  "03": "cac:InvoiceLine",
  "07": "cac:CreditNoteLine",
  "08": "cac:DebitNoteLine",
};

const QUANTITY_ELEMENT: Record<TipoDocumento, string> = {
  "01": "cbc:InvoicedQuantity",
  "03": "cbc:InvoicedQuantity",
  "07": "cbc:CreditedQuantity",
  "08": "cbc:DebitedQuantity",
};

const IGV_TRIBUTO = { id: "1000", nombre: "IGV", codigoInternacional: "VAT" };

// Catálogo 07 (tipo de afectación del IGV): 10 = Gravado - Operación Onerosa
const AFECTACION_GRAVADA = "10";
// UN/ECE 5305 (tax category): S = Gravado (con IGV)
const TAX_CATEGORY_GRAVADA = "S";

function limaNow(): { date: string; time: string } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });
  const parts: Record<string, string> = {};
  for (const p of fmt.formatToParts(new Date())) parts[p.type] = p.value;
  const hour = parts.hour === "24" ? "00" : parts.hour;
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${hour}:${minuteSafe(parts.minute)}:${secondSafe(parts.second)}` };
}

function minuteSafe(v: string): string { return v; }
function secondSafe(v: string): string { return v; }

function taxScheme(parent: any): any {
  return parent.ele("cac:TaxScheme")
    .ele("cbc:ID", { schemeID: "UN/ECE 5153", schemeName: "Código de tributo", schemeAgencyName: "PE:SUNAT" }).txt(IGV_TRIBUTO.id).up()
    .ele("cbc:Name").txt(IGV_TRIBUTO.nombre).up()
    .ele("cbc:TaxTypeCode").txt(IGV_TRIBUTO.codigoInternacional).up().up();
}

function taxCategory(parent: any, percent: string, affectCode: string): any {
  const cat = parent.ele("cac:TaxCategory");
  cat.ele("cbc:ID", { schemeID: "UN/ECE 5305", schemeName: "Tax Category Identifier", schemeAgencyName: "United Nations Economic Commission for Europe" }).txt(TAX_CATEGORY_GRAVADA).up();
  cat.ele("cbc:Percent").txt(percent).up();
  cat.ele("cbc:TaxExemptionReasonCode", { listID: "Código de tipo de afectación del IGV", listName: "Código de tipo de afectación del IGV", listAgencyName: "PE:SUNAT" }).txt(affectCode).up();
  taxScheme(cat);
  return cat;
}

function taxSubtotal(parent: any, taxableAmount: string, taxAmount: string, percent: string, moneda: string): any {
  const sub = parent.ele("cac:TaxSubtotal");
  sub.ele("cbc:TaxableAmount", { currencyID: moneda }).txt(taxableAmount).up();
  sub.ele("cbc:TaxAmount", { currencyID: moneda }).txt(taxAmount).up();
  taxCategory(sub, percent, AFECTACION_GRAVADA);
  return sub;
}

function supplierParty(doc: any, hotel: Record<string, any>): any {
  const supplier = doc.ele("cac:AccountingSupplierParty").ele("cac:Party");
  supplier.ele("cac:PartyIdentification").ele("cbc:ID", { schemeID: "6" }).txt(hotel.ruc || "20600000001").up().up();
  supplier.ele("cac:PartyName").ele("cbc:Name").dat(hotel.nombre || "HOTEL").up().up();
  const legal = supplier.ele("cac:PartyLegalEntity");
  legal.ele("cbc:RegistrationName").dat(hotel.razon_social || hotel.nombre || "HOTEL").up();
  const addr = legal.ele("cac:RegistrationAddress");
  addr.ele("cbc:ID", { schemeName: "Ubigeos", schemeAgencyName: "PE:INEI" }).txt(hotel.ubigeo || "080101").up();
  addr.ele("cbc:AddressTypeCode", { listAgencyName: "PE:SUNAT", listName: "Tipo de dirección" }).txt("0000").up();
  addr.ele("cbc:CitySubdivisionName").dat(hotel.departamento || hotel.ciudad || "CUSCO").up();
  addr.ele("cbc:CityName").dat(hotel.provincia || hotel.ciudad || "CUSCO").up();
  addr.ele("cbc:CountrySubentity").dat(hotel.departamento || hotel.ciudad || "CUSCO").up();
  addr.ele("cbc:District").dat(hotel.distrito || hotel.ciudad || "CUSCO").up();
  addr.ele("cac:AddressLine").ele("cbc:Line").dat(hotel.direccion || "-").up().up();
  addr.ele("cac:Country").ele("cbc:IdentificationCode", { listID: "ISO 3166-1", listAgencyName: "United Nations Economic Commission for Europe" }).txt("PE").up().up();
  return supplier;
}

function customerParty(doc: any, comp: Record<string, any>): any {
  const customer = doc.ele("cac:AccountingCustomerParty").ele("cac:Party");
  customer.ele("cac:PartyIdentification")
    .ele("cbc:ID", {
      schemeID: comp.cliente_tipo || "1",
      schemeName: "Documento de Identidad",
      schemeAgencyName: "PE:SUNAT",
      schemeURI: "urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo06",
    }).txt(comp.cliente_documento || "0").up().up();
  customer.ele("cac:PartyLegalEntity").ele("cbc:RegistrationName").dat(comp.cliente_nombre || "CLIENTE GENERAL").up().up();
  return customer;
}

function lineElement(parent: any, lineName: string, quantityName: string, id: number, cantidad: number, unitCode: string, precioUnitarioBase: number, percent: string, descripcion: string, moneda: string): any {
  const cant = new Decimal(cantidad || 0);
  const unitBase = new Decimal(precioUnitarioBase || 0);
  const lineExt = cant.mul(unitBase).toDecimalPlaces(2);
  const lineIgv = lineExt.mul(0.18).toDecimalPlaces(2);
  const unitPriceIgv = unitBase.mul(1.18).toDecimalPlaces(2);

  const line = parent.ele(lineName);
  line.ele("cbc:ID").txt(String(id)).up();
  line.ele(quantityName, { unitCode }).txt(cant.toFixed(2)).up();
  line.ele("cbc:LineExtensionAmount", { currencyID: moneda }).txt(lineExt.toFixed(2)).up();
  line.ele("cac:PricingReference").ele("cac:AlternativeConditionPrice")
    .ele("cbc:PriceAmount", { currencyID: moneda }).txt(unitPriceIgv.toFixed(2)).up()
    .ele("cbc:PriceTypeCode", { listName: "Tipo de precio", listAgencyName: "PE:SUNAT" }).txt("01").up().up().up();
  const lineTax = line.ele("cac:TaxTotal");
  lineTax.ele("cbc:TaxAmount", { currencyID: moneda }).txt(lineIgv.toFixed(2)).up();
  taxSubtotal(lineTax, lineExt.toFixed(2), lineIgv.toFixed(2), percent, moneda);
  line.ele("cac:Item").ele("cbc:Description").dat(descripcion).up().up();
  line.ele("cac:Price").ele("cbc:PriceAmount", { currencyID: moneda }).txt(unitBase.toFixed(2)).up().up();
  return line;
}

export function buildUblXml(
  comp: Record<string, any>,
  hotel: Record<string, any>,
  formattedNumber: string,
  detalle: DetalleLinea[] = [],
  referencia: ReferenciaComprobante | null = null,
): string {
  const tipoDoc: TipoDocumento = comp.tipo === "Factura" ? "01" : comp.tipo === "Boleta" ? "03" : comp.tipo === "Nota Credito" ? "07" : "08";
  const { root, xmlns } = ROOT_AND_NS[tipoDoc];
  const typeCodeElement = TYPE_CODE_ELEMENT[tipoDoc];
  const lineName = LINE_ELEMENT[tipoDoc];
  const quantityName = QUANTITY_ELEMENT[tipoDoc];

  const { date: issueDate, time: issueTime } = limaNow();
  const moneda = "PEN";
  const idComprobante = `${comp.serie}-${formattedNumber}`;

  const totalAmount = new Decimal(comp.total || 0).toFixed(2);
  const subtotalAmount = new Decimal(comp.subtotal || 0).toFixed(2);
  const igvAmount = new Decimal(comp.igv || 0).toFixed(2);
  const isGravada = parseFloat(igvAmount) > 0;
  const percent = isGravada ? "18.00" : "0.00";

  const doc = create({ version: "1.0", encoding: "UTF-8" })
    .ele(root, { ...NS_COMMON, "xmlns": xmlns });

  doc.ele("ext:UBLExtensions").ele("ext:UBLExtension").ele("ext:ExtensionContent").up().up().up();

  doc.ele("cbc:UBLVersionID").txt("2.1").up();
  doc.ele("cbc:CustomizationID").txt("2.0").up();
  doc.ele("cbc:ID").txt(idComprobante).up();
  doc.ele("cbc:IssueDate").txt(issueDate).up();
  doc.ele("cbc:IssueTime").txt(issueTime).up();

  if (tipoDoc === "07" || tipoDoc === "08") {
    doc.ele(typeCodeElement, { listAgencyName: "PE:SUNAT", listName: "Tipo de nota", listURI: "urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo09" }).txt(comp.tipo_nota || "01").up();
  } else {
    doc.ele(typeCodeElement, { listID: "0101" }).txt(tipoDoc).up();
  }

  doc.ele("cbc:DocumentCurrencyCode", { listID: "ISO 4217 Alpha", listName: "Currency", listAgencyName: "United Nations Economic Commission for Europe" }).txt(moneda).up();

  // Referencia al comprobante original (solo notas)
  if (tipoDoc === "07" || tipoDoc === "08") {
    if (referencia) {
      const refId = `${referencia.serie}-${referencia.numero}`;
      const disc = doc.ele("cac:DiscrepancyResponse");
      disc.ele("cbc:ReferenceID").txt(refId).up();
      disc.ele("cbc:ResponseCode").txt(comp.tipo_nota || "01").up();
      disc.ele("cbc:Description").dat(comp.motivo || "Nota de crédito/débito").up().up();
      const bill = doc.ele("cac:BillingReference").ele("cac:InvoiceDocumentReference");
      bill.ele("cbc:ID").txt(refId).up();
      bill.ele("cbc:DocumentTypeCode").txt(referencia.tipoDoc).up().up().up();
    }
  }

  supplierParty(doc, hotel);
  customerParty(doc, comp);

  // Tax Total Global
  const taxTotal = doc.ele("cac:TaxTotal");
  taxTotal.ele("cbc:TaxAmount", { currencyID: moneda }).txt(igvAmount).up();
  taxSubtotal(taxTotal, subtotalAmount, igvAmount, percent, moneda);

  // Totales monetarios
  const legalMonetary = doc.ele("cac:LegalMonetaryTotal");
  legalMonetary.ele("cbc:LineExtensionAmount", { currencyID: moneda }).txt(subtotalAmount).up();
  legalMonetary.ele("cbc:TaxInclusiveAmount", { currencyID: moneda }).txt(totalAmount).up();
  legalMonetary.ele("cbc:PayableAmount", { currencyID: moneda }).txt(totalAmount).up();

  // Líneas de detalle
  if (detalle.length > 0) {
    let idx = 1;
    for (const d of detalle) {
      lineElement(doc, lineName, quantityName, idx, Number(d.cantidad || 1), "NIU", Number(d.precio_unitario || 0), percent, d.descripcion, moneda);
      idx += 1;
    }
  } else {
    // Línea única consolidada
    lineElement(doc, lineName, quantityName, 1, 1, "NIU", Number(subtotalAmount), percent, "SERVICIO DE HOSPEDAJE / CONSUMO", moneda);
  }

  return doc.end({ prettyPrint: false });
}
