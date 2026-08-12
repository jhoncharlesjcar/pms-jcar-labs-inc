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

const IGV_TRIBUTO = {
  id: "1000",
  nombre: "IGV",
  codigoInternacional: "VAT",
};

export function buildUblXml(comp: any, hotel: any, formattedNumber: string): string {
  const tipoDoc = comp.tipo === "Factura" ? "01" : "03";
  // Si no viene cliente_tipo, inferimos 6 para Factura y 1 para Boleta
  const clienteTipoDoc = comp.cliente_tipo || (comp.tipo === "Factura" ? "6" : "1");
  const clienteDocumento = comp.cliente_documento || "00000000";
  const clienteNombre = comp.cliente_nombre || "CLIENTE GENERAL";

  const dateObj = new Date();
  const issueDate = dateObj.toISOString().split("T")[0];
  const issueTime = dateObj.toTimeString().split(" ")[0];

  const moneda = "PEN";
  const idComprobante = `${comp.serie}-${formattedNumber}`;
  const rucHotel = hotel.ruc || "20600000001";
  const nombreHotel = hotel.nombre || "HOTEL";
  const direccionHotel = hotel.direccion || "JR. PRINCIPAL 123";
  const ciudadHotel = hotel.ciudad || "CUSCO";

  // Valores (aseguramos decimales con Decimal.js)
  const totalAmount = new Decimal(comp.total || 0).toFixed(2);
  const subtotalAmount = new Decimal(comp.subtotal || 0).toFixed(2);
  const igvAmount = new Decimal(comp.igv || 0).toFixed(2);
  const isGravada = parseFloat(igvAmount) > 0;
  
  const doc = create({ version: "1.0", encoding: "UTF-8" })
    .ele("Invoice", NAMESPACES);

  // Extensión para firma
  doc.ele("ext:UBLExtensions")
     .ele("ext:UBLExtension")
     .ele("ext:ExtensionContent").up().up().up();

  // Cabecera
  doc.ele("cbc:UBLVersionID").txt("2.1").up();
  doc.ele("cbc:CustomizationID").txt("2.0").up();
  doc.ele("cbc:ID").txt(idComprobante).up();
  doc.ele("cbc:IssueDate").txt(issueDate).up();
  doc.ele("cbc:IssueTime").txt(issueTime).up();
  doc.ele("cbc:InvoiceTypeCode", { listID: "0101" }).txt(tipoDoc).up();
  doc.ele("cbc:DocumentCurrencyCode").txt(moneda).up();

  // Firma (placeholder que coincida con el cert)
  const sig = doc.ele("cac:Signature");
  sig.ele("cbc:ID").txt(rucHotel).up();
  const sigParty = sig.ele("cac:SignatoryParty");
  sigParty.ele("cac:PartyIdentification").ele("cbc:ID").txt(rucHotel).up().up();
  sigParty.ele("cac:PartyName").ele("cbc:Name").dat(nombreHotel).up().up();
  sig.ele("cac:DigitalSignatureAttachment")
     .ele("cac:ExternalReference")
     .ele("cbc:URI").txt(`#SignatureSP`).up().up().up(); // SignatureSP is expected by SUNAT sometimes or just the ID

  // Emisor
  const supplier = doc.ele("cac:AccountingSupplierParty").ele("cac:Party");
  supplier.ele("cac:PartyIdentification")
          .ele("cbc:ID", { schemeID: "6" }).txt(rucHotel).up().up();
  supplier.ele("cac:PartyName")
          .ele("cbc:Name").dat(nombreHotel).up().up();
  
  const supplierLegal = supplier.ele("cac:PartyLegalEntity");
  supplierLegal.ele("cbc:RegistrationName").dat(nombreHotel).up();
  const supplierAddr = supplierLegal.ele("cac:RegistrationAddress");
  supplierAddr.ele("cbc:ID").txt("080101").up(); // UBIGEO default si no hay
  supplierAddr.ele("cbc:AddressTypeCode").txt("0000").up();
  supplierAddr.ele("cbc:CitySubdivisionName").dat(ciudadHotel).up();
  supplierAddr.ele("cbc:CityName").dat(ciudadHotel).up();
  supplierAddr.ele("cbc:CountrySubentity").dat(ciudadHotel).up();
  supplierAddr.ele("cbc:District").dat(ciudadHotel).up();
  supplierAddr.ele("cac:AddressLine").ele("cbc:Line").dat(direccionHotel).up().up();
  supplierAddr.ele("cac:Country").ele("cbc:IdentificationCode").txt("PE").up().up();

  // Receptor
  const customer = doc.ele("cac:AccountingCustomerParty").ele("cac:Party");
  customer.ele("cac:PartyIdentification")
          .ele("cbc:ID", { schemeID: clienteTipoDoc }).txt(clienteDocumento).up().up();
  customer.ele("cac:PartyLegalEntity")
          .ele("cbc:RegistrationName").dat(clienteNombre).up().up();

  // Tax Total Global
  const taxTotal = doc.ele("cac:TaxTotal");
  taxTotal.ele("cbc:TaxAmount", { currencyID: moneda }).txt(igvAmount).up();
  const taxSub = taxTotal.ele("cac:TaxSubtotal");
  taxSub.ele("cbc:TaxableAmount", { currencyID: moneda }).txt(subtotalAmount).up();
  taxSub.ele("cbc:TaxAmount", { currencyID: moneda }).txt(igvAmount).up();
  const taxCat = taxSub.ele("cac:TaxCategory");
  taxCat.ele("cac:TaxScheme")
        .ele("cbc:ID").txt(IGV_TRIBUTO.id).up()
        .ele("cbc:Name").txt(IGV_TRIBUTO.nombre).up()
        .ele("cbc:TaxTypeCode").txt(IGV_TRIBUTO.codigoInternacional).up().up();

  // Totales monetarios
  const legalMonetary = doc.ele("cac:LegalMonetaryTotal");
  legalMonetary.ele("cbc:LineExtensionAmount", { currencyID: moneda }).txt(subtotalAmount).up();
  legalMonetary.ele("cbc:TaxInclusiveAmount", { currencyID: moneda }).txt(totalAmount).up();
  legalMonetary.ele("cbc:PayableAmount", { currencyID: moneda }).txt(totalAmount).up();

  // Linea (Simplificado a 1 linea consolidada como estaba en index.ts)
  const invLine = doc.ele("cac:InvoiceLine");
  invLine.ele("cbc:ID").txt("1").up();
  invLine.ele("cbc:InvoicedQuantity", { unitCode: "NIU" }).txt("1").up();
  invLine.ele("cbc:LineExtensionAmount", { currencyID: moneda }).txt(subtotalAmount).up();
  
  invLine.ele("cac:PricingReference")
         .ele("cac:AlternativeConditionPrice")
         .ele("cbc:PriceAmount", { currencyID: moneda }).txt(totalAmount).up()
         .ele("cbc:PriceTypeCode").txt("01").up().up().up();

  const lineTax = invLine.ele("cac:TaxTotal");
  lineTax.ele("cbc:TaxAmount", { currencyID: moneda }).txt(igvAmount).up();
  const lineTaxSub = lineTax.ele("cac:TaxSubtotal");
  lineTaxSub.ele("cbc:TaxableAmount", { currencyID: moneda }).txt(subtotalAmount).up();
  lineTaxSub.ele("cbc:TaxAmount", { currencyID: moneda }).txt(igvAmount).up();
  
  const lineTaxCat = lineTaxSub.ele("cac:TaxCategory");
  lineTaxCat.ele("cbc:Percent").txt(isGravada ? "18.00" : "0.00").up();
  lineTaxCat.ele("cbc:TaxExemptionReasonCode").txt(isGravada ? "10" : "20").up();
  lineTaxCat.ele("cac:TaxScheme")
            .ele("cbc:ID").txt(IGV_TRIBUTO.id).up()
            .ele("cbc:Name").txt(IGV_TRIBUTO.nombre).up()
            .ele("cbc:TaxTypeCode").txt(IGV_TRIBUTO.codigoInternacional).up().up();

  invLine.ele("cac:Item").ele("cbc:Description").dat("SERVICIO DE HOSPEDAJE / CONSUMO").up().up();
  invLine.ele("cac:Price").ele("cbc:PriceAmount", { currencyID: moneda }).txt(subtotalAmount).up().up();

  return doc.end({ prettyPrint: false });
}
