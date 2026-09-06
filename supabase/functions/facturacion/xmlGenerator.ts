// @ts-nocheck — Supabase Edge Function (Deno runtime, npm: specifiers)
import { create } from "npm:xmlbuilder2@3.1.1";
import Decimal from "npm:decimal.js@10.4.3";

const NAMESPACES = {
  "xmlns":     "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2",
  "xmlns:cac": "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
  "xmlns:cbc": "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
  "xmlns:ds":  "http://www.w3.org/2000/09/xmldsig#",
  "xmlns:ext": "urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2",
};

const IGV_TRIBUTO = { id: "1000", nombre: "IGV", codigoInternacional: "VAT" };

// Catálogo 07 (tipo de afectación del IGV): 10 = Gravado - Operación Onerosa
const AFECTACION_GRAVADA = "10";
// UN/ECE 5305 (tax category): S = Gravado (con IGV)
const TAX_CATEGORY_GRAVADA = "S";

/**
 * Fecha y hora de emisión en zona horaria de Perú (America/Lima).
 * El runtime de Deno corre en UTC por defecto; sin esto, una venta nocturna
 * quedaría registrada con fecha del día siguiente.
 */
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
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${hour}:${parts.minute}:${parts.second}`,
  };
}

/** TaxScheme compartido entre el total global y las líneas. */
function taxScheme(ele: any): any {
  return ele.ele("cac:TaxScheme")
    .ele("cbc:ID", { schemeID: "UN/ECE 5153", schemeName: "Código de tributo", schemeAgencyName: "PE:SUNAT" }).txt(IGV_TRIBUTO.id).up()
    .ele("cbc:Name").txt(IGV_TRIBUTO.nombre).up()
    .ele("cbc:TaxTypeCode").txt(IGV_TRIBUTO.codigoInternacional).up().up();
}

/** TaxCategory conforme al XSD SUNAT (gravado 18%). */
function taxCategory(parent: any, percent: string, affectCode: string, taxAmount: string, taxableAmount: string, moneda: string): any {
  const cat = parent.ele("cac:TaxCategory");
  cat.ele("cbc:ID", { schemeID: "UN/ECE 5305", schemeName: "Tax Category Identifier", schemeAgencyName: "United Nations Economic Commission for Europe" }).txt(TAX_CATEGORY_GRAVADA).up();
  cat.ele("cbc:Percent").txt(percent).up();
  cat.ele("cbc:TaxExemptionReasonCode", { listID: "Código de tipo de afectación del IGV", listName: "Código de tipo de afectación del IGV", listAgencyName: "PE:SUNAT" }).txt(affectCode).up();
  taxScheme(cat);
  return cat;
}

export function buildUblXml(comp: Record<string, any>, hotel: Record<string, any>, formattedNumber: string): string {
  const tipoDoc = comp.tipo === "Factura" ? "01" : "03";
  // Catálogo 06: 6 = RUC, 1 = DNI. Para boleta sin documento, SUNAT usa "0".
  const clienteTipoDoc = comp.cliente_tipo || (comp.tipo === "Factura" ? "6" : "1");
  const clienteDocumento = comp.cliente_documento || "0";
  const clienteNombre = comp.cliente_nombre || "CLIENTE GENERAL";

  const { date: issueDate, time: issueTime } = limaNow();

  const moneda = "PEN";
  const idComprobante = `${comp.serie}-${formattedNumber}`;
  const rucHotel = hotel.ruc || "20600000001";
  const nombreHotel = hotel.nombre || "HOTEL";
  const razonSocialHotel = hotel.razon_social || nombreHotel;
  const direccionHotel = hotel.direccion || "-";
  const ubigeo = hotel.ubigeo || "080101";
  const departamento = hotel.departamento || hotel.ciudad || "CUSCO";
  const provincia = hotel.provincia || hotel.ciudad || "CUSCO";
  const distrito = hotel.distrito || hotel.ciudad || "CUSCO";

  const totalAmount = new Decimal(comp.total || 0).toFixed(2);
  const subtotalAmount = new Decimal(comp.subtotal || 0).toFixed(2);
  const igvAmount = new Decimal(comp.igv || 0).toFixed(2);
  const isGravada = parseFloat(igvAmount) > 0;
  const percent = isGravada ? "18.00" : "0.00";

  const doc = create({ version: "1.0", encoding: "UTF-8" })
    .ele("Invoice", NAMESPACES);

  // Extensión para firma digital (vacía; el firmador inyecta ds:Signature aquí)
  doc.ele("ext:UBLExtensions")
     .ele("ext:UBLExtension")
     .ele("ext:ExtensionContent").up().up().up();

  doc.ele("cbc:UBLVersionID").txt("2.1").up();
  doc.ele("cbc:CustomizationID").txt("2.0").up();
  doc.ele("cbc:ID").txt(idComprobante).up();
  doc.ele("cbc:IssueDate").txt(issueDate).up();
  doc.ele("cbc:IssueTime").txt(issueTime).up();
  doc.ele("cbc:InvoiceTypeCode", { listID: "0101" }).txt(tipoDoc).up();
  doc.ele("cbc:DocumentCurrencyCode", { listID: "ISO 4217 Alpha", listName: "Currency", listAgencyName: "United Nations Economic Commission for Europe" }).txt(moneda).up();

  // Emisor
  const supplier = doc.ele("cac:AccountingSupplierParty").ele("cac:Party");
  supplier.ele("cac:PartyIdentification").ele("cbc:ID", { schemeID: "6" }).txt(rucHotel).up().up();
  supplier.ele("cac:PartyName").ele("cbc:Name").dat(nombreHotel).up().up();
  const supplierLegal = supplier.ele("cac:PartyLegalEntity");
  supplierLegal.ele("cbc:RegistrationName").dat(razonSocialHotel).up();
  const supplierAddr = supplierLegal.ele("cac:RegistrationAddress");
  supplierAddr.ele("cbc:ID", { schemeName: "Ubigeos", schemeAgencyName: "PE:INEI" }).txt(ubigeo).up();
  supplierAddr.ele("cbc:AddressTypeCode", { listAgencyName: "PE:SUNAT", listName: "Tipo de dirección" }).txt("0000").up();
  supplierAddr.ele("cbc:CitySubdivisionName").dat(departamento).up();
  supplierAddr.ele("cbc:CityName").dat(provincia).up();
  supplierAddr.ele("cbc:CountrySubentity").dat(departamento).up();
  supplierAddr.ele("cbc:District").dat(distrito).up();
  supplierAddr.ele("cac:AddressLine").ele("cbc:Line").dat(direccionHotel).up().up();
  supplierAddr.ele("cac:Country").ele("cbc:IdentificationCode", { listID: "ISO 3166-1", listAgencyName: "United Nations Economic Commission for Europe" }).txt("PE").up().up();

  // Receptor
  const customer = doc.ele("cac:AccountingCustomerParty").ele("cac:Party");
  customer.ele("cac:PartyIdentification")
    .ele("cbc:ID", {
      schemeID: clienteTipoDoc,
      schemeName: "Documento de Identidad",
      schemeAgencyName: "PE:SUNAT",
      schemeURI: "urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo06",
    }).txt(clienteDocumento).up().up();
  customer.ele("cac:PartyLegalEntity").ele("cbc:RegistrationName").dat(clienteNombre).up().up();

  // Tax Total Global
  const taxTotal = doc.ele("cac:TaxTotal");
  taxTotal.ele("cbc:TaxAmount", { currencyID: moneda }).txt(igvAmount).up();
  const taxSub = taxTotal.ele("cac:TaxSubtotal");
  taxSub.ele("cbc:TaxableAmount", { currencyID: moneda }).txt(subtotalAmount).up();
  taxSub.ele("cbc:TaxAmount", { currencyID: moneda }).txt(igvAmount).up();
  taxCategory(taxSub, percent, AFECTACION_GRAVADA, igvAmount, subtotalAmount, moneda);

  // Totales monetarios
  const legalMonetary = doc.ele("cac:LegalMonetaryTotal");
  legalMonetary.ele("cbc:LineExtensionAmount", { currencyID: moneda }).txt(subtotalAmount).up();
  legalMonetary.ele("cbc:TaxInclusiveAmount", { currencyID: moneda }).txt(totalAmount).up();
  legalMonetary.ele("cbc:PayableAmount", { currencyID: moneda }).txt(totalAmount).up();

  // Línea consolidada (se reemplaza por detalle por líneas en la siguiente fase)
  const invLine = doc.ele("cac:InvoiceLine");
  invLine.ele("cbc:ID").txt("1").up();
  invLine.ele("cbc:InvoicedQuantity", { unitCode: "NIU" }).txt("1.00").up();
  invLine.ele("cbc:LineExtensionAmount", { currencyID: moneda }).txt(subtotalAmount).up();

  invLine.ele("cac:PricingReference").ele("cac:AlternativeConditionPrice")
    .ele("cbc:PriceAmount", { currencyID: moneda }).txt(totalAmount).up()
    .ele("cbc:PriceTypeCode", { listName: "Tipo de precio", listAgencyName: "PE:SUNAT" }).txt("01").up().up().up();

  const lineTax = invLine.ele("cac:TaxTotal");
  lineTax.ele("cbc:TaxAmount", { currencyID: moneda }).txt(igvAmount).up();
  const lineTaxSub = lineTax.ele("cac:TaxSubtotal");
  lineTaxSub.ele("cbc:TaxableAmount", { currencyID: moneda }).txt(subtotalAmount).up();
  lineTaxSub.ele("cbc:TaxAmount", { currencyID: moneda }).txt(igvAmount).up();
  taxCategory(lineTaxSub, percent, AFECTACION_GRAVADA, igvAmount, subtotalAmount, moneda);

  invLine.ele("cac:Item").ele("cbc:Description").dat("SERVICIO DE HOSPEDAJE / CONSUMO").up().up();
  invLine.ele("cac:Price").ele("cbc:PriceAmount", { currencyID: moneda }).txt(subtotalAmount).up().up();

  return doc.end({ prettyPrint: false });
}
