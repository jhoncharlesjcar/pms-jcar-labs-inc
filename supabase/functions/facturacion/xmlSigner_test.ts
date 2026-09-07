// @ts-nocheck — Supabase Edge Function (Deno runtime, npm: specifiers)
import { buildUblXml } from "./xmlGenerator.ts";
import { signXmlDocument, getOrCreateTestPfx } from "./xmlSigner.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const mockHotel = {
  ruc: "20123456789",
  razon_social: "HOTEL TEST SAC",
  direccion: "AV TEST 123",
  ubigeo: "150101",
};

const mockComprobante = (tipo: string) => ({
  tipo,
  serie: "F001",
  total: "100.00",
  subtotal: "84.75",
  igv: "15.25",
  cliente_tipo_documento: "6",
  cliente_documento: "20123456789",
  cliente_nombre: "CLIENTE TEST",
  tipo_nota: "01",
  motivo: "Anulación de la operación",
});

const referencia = { serie: "F001", numero: "00000001", tipoDoc: "01" };

Deno.test("signXmlDocument — firma Invoice correctamente", () => {
  const xml = buildUblXml(mockComprobante("Factura"), mockHotel, "00000001");
  const pfx = getOrCreateTestPfx();
  const signed = signXmlDocument(xml, pfx);
  assert(signed.includes("Signature"), "Debe contener Signature");
  assert(signed.includes("DigestValue"), "Debe contener DigestValue");
});

Deno.test("signXmlDocument — firma CreditNote correctamente con su propio root", () => {
  const xml = buildUblXml(mockComprobante("Nota Credito"), mockHotel, "00000001", [], referencia);
  const pfx = getOrCreateTestPfx();
  const signed = signXmlDocument(xml, pfx);
  assert(signed.includes("Signature"), "Debe contener Signature");
  assert(signed.includes("CreditNote"), "Debe ser documento CreditNote");
  assert(signed.includes("DigestValue"), "Debe contener DigestValue");
});

Deno.test("signXmlDocument — firma DebitNote correctamente con su propio root", () => {
  const xml = buildUblXml(mockComprobante("Nota Debito"), mockHotel, "00000001", [], referencia);
  const pfx = getOrCreateTestPfx();
  const signed = signXmlDocument(xml, pfx);
  assert(signed.includes("Signature"), "Debe contener Signature");
  assert(signed.includes("DebitNote"), "Debe ser documento DebitNote");
  assert(signed.includes("DigestValue"), "Debe contener DigestValue");
});

Deno.test("buildUblXml — CreditNote usa CreditedQuantity y no InvoicedQuantity", () => {
  const xml = buildUblXml(mockComprobante("Nota Credito"), mockHotel, "00000001", [], referencia);
  assert(xml.includes("cbc:CreditedQuantity"), "Debe usar cbc:CreditedQuantity");
  assert(!xml.includes("cbc:InvoicedQuantity"), "No debe contener cbc:InvoicedQuantity");
});

Deno.test("buildUblXml — DebitNote usa DebitedQuantity y no InvoicedQuantity", () => {
  const xml = buildUblXml(mockComprobante("Nota Debito"), mockHotel, "00000001", [], referencia);
  assert(xml.includes("cbc:DebitedQuantity"), "Debe usar cbc:DebitedQuantity");
  assert(!xml.includes("cbc:InvoicedQuantity"), "No debe contener cbc:InvoicedQuantity");
});

Deno.test("buildUblXml — Factura usa InvoicedQuantity", () => {
  const xml = buildUblXml(mockComprobante("Factura"), mockHotel, "00000001");
  assert(xml.includes("cbc:InvoicedQuantity"), "Factura debe usar cbc:InvoicedQuantity");
});
