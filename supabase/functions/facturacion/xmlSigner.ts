// @ts-nocheck — Supabase Edge Function (Deno runtime, npm: specifiers)
import { SignedXml } from "npm:xml-crypto@6.0.0";
import forge from "npm:node-forge@1.3.1";

let cachedTestPfx: { privateKeyPem: string; certPem: string; certBase64: string } | null = null;

export function getOrCreateTestPfx() {
  if (cachedTestPfx) return cachedTestPfx;

  console.log("Generating self-signed test certificate for SUNAT Sandbox...");
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = "00000001";
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 2);

  const attrs = [
    { name: "commonName", value: "CERTIFICADO PRUEBA SUNAT" },
    { name: "countryName", value: "PE" },
    { name: "organizationName", value: "JCAR LABS" },
    { name: "organizationalUnitName", value: "TI" },
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey, forge.md.sha256.create());

  const privateKeyPem = forge.pki.privateKeyToPem(keys.privateKey);
  const certPem = forge.pki.certificateToPem(cert);
  const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
  const certBase64 = forge.util.encode64(certDer);

  cachedTestPfx = { privateKeyPem, certPem, certBase64 };
  return cachedTestPfx;
}

export function signXmlDocument(xmlString: string, pfxCache: { privateKeyPem: string; certPem: string }): string {
  const { privateKeyPem, certPem } = pfxCache;

  const sig = new SignedXml({
    privateKey: privateKeyPem,
    publicCert: certPem,
    signatureAlgorithm: "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256",
    canonicalizationAlgorithm: "http://www.w3.org/2001/10/xml-exc-c14n#",
  });

  sig.addReference({
    xpath: "//*[local-name()='Invoice']",
    digestAlgorithm: "http://www.w3.org/2001/04/xmlenc#sha256",
    transforms: [
      "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
      "http://www.w3.org/2001/10/xml-exc-c14n#",
    ],
    isEmptyUri: true,
  });

  sig.computeSignature(xmlString, {
    location: {
      reference: "//*[local-name()='ExtensionContent']",
      action: "append",
    },
  });

  return sig.getSignedXml();
}
