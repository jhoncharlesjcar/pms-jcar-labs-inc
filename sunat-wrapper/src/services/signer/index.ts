/**
 * XMLDSig Signing Utility
 * Firma digital de documentos XML UBL 2.0 según estándar SUNAT
 * Soporta certificados PFX (PKCS#12) y PEM (clave privada + certificado)
 * Estándar: XMLDSig en <ext:UBLExtensions>/<ext:UBLExtension>/<ext:ExtensionContent>
 */

import * as forge from 'node-forge';
import { CertificateConfig, SignedDocument } from '@/types/sunat';
import { createHash } from 'crypto';

export class XmlSignerService {
  /**
   * Firma un documento XML UBL 2.0 con certificado digital
   * @param xml - XML sin firmar (string)
   * @param certConfig - Configuración del certificado (PFX o PEM)
   * @returns Documento firmado con XML, ZIP y hash
   */
  async signXml(xml: string, certConfig: CertificateConfig): Promise<SignedDocument> {
    // 1. Obtener clave privada y certificado
    const { privateKey, certificate } = await this.loadCredentials(certConfig);

    // 2. Canonicalizar XML (C14N) - necesario para XMLDSig
    const canonicalXml = this.canonicalizeXml(xml);

    // 3. Calcular hash SHA-256 del XML canonicalizado
    const hash = this.computeSha256(canonicalXml);

    // 4. Generar firma XMLDSig
    const signatureXml = this.generateXmlDsig(
      canonicalXml,
      hash,
      privateKey,
      certificate
    );

    // 5. Insertar firma en el XML
    const signedXml = this.insertSignature(xml, signatureXml);

    // 6. Calcular hash del XML firmado (para verificación)
    const signedHash = this.computeSha256(this.canonicalizeXml(signedXml));

    // 7. Generar nombre de archivo
    const fileName = this.extractFileName(xml);

    // 8. Crear ZIP
    const zipBase64 = await this.createZip(fileName + '.xml', signedXml);

    return {
      xml: signedXml,
      xmlBase64: Buffer.from(signedXml, 'utf-8').toString('base64'),
      zipBase64,
      fileName: fileName + '.xml',
      hash: signedHash,
    };
  }

  /**
   * Carga credenciales desde PFX o PEM
   */
  private async loadCredentials(config: CertificateConfig): Promise<{
    privateKey: forge.pki.PrivateKey;
    certificate: forge.pki.Certificate;
  }> {
    if (config.pfxBase64 && config.pfxPassword) {
      return this.loadFromPfx(config.pfxBase64, config.pfxPassword);
    }

    if (config.privateKeyPem && config.certificatePem) {
      return this.loadFromPem(config.privateKeyPem, config.certificatePem);
    }

    throw new Error('No certificate configuration provided. Need either PFX or PEM.');
  }

  /**
   * Carga desde PFX (PKCS#12)
   */
  private loadFromPfx(pfxBase64: string, password: string): {
    privateKey: forge.pki.PrivateKey;
    certificate: forge.pki.Certificate;
  } {
    const pfxDer = forge.util.decode64(pfxBase64);
    const pfx = forge.pkcs12.pkcs12FromAsn1(
      forge.asn1.fromDer(pfxDer),
      password
    );

    // Obtener clave privada
    const privateKeyBags = pfx.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
    if (!privateKeyBags || Object.keys(privateKeyBags).length === 0) {
      throw new Error('No private key found in PFX');
    }
    // getBags returns object with bagType as keys, get first one
    const privateKeyBag = Object.values(privateKeyBags)[0];
    if (!privateKeyBag || privateKeyBag.length === 0) {
      throw new Error('No private key found in PFX');
    }
    const privateKey = privateKeyBag[0].key as forge.pki.PrivateKey;

    // Obtener certificado
    const certBags = pfx.getBags({ bagType: forge.pki.oids.certBag });
    if (!certBags || Object.keys(certBags).length === 0) {
      throw new Error('No certificate found in PFX');
    }
    const certBag = Object.values(certBags)[0];
    if (!certBag || certBag.length === 0) {
      throw new Error('No certificate found in PFX');
    }
    const certificate = certBag[0].cert as forge.pki.Certificate;

    return { privateKey, certificate };
  }

  /**
   * Carga desde PEM (clave privada + certificado separados)
   */
  private loadFromPem(privateKeyPem: string, certificatePem: string): {
    privateKey: forge.pki.PrivateKey;
    certificate: forge.pki.Certificate;
  } {
    const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);
    const certificate = forge.pki.certificateFromPem(certificatePem);

    // Verificar que la clave privada corresponde al certificado
    if (!this.verifyKeyMatch(privateKey, certificate)) {
      throw new Error('Private key does not match certificate');
    }

    return { privateKey, certificate };
  }

  /**
   * Verifica que la clave privada coincide con el certificado
   */
  private verifyKeyMatch(privateKey: forge.pki.PrivateKey, certificate: forge.pki.Certificate): boolean {
    const publicKey = certificate.publicKey;
    const testData = 'test';
    const md = forge.md.sha256.create();
    md.update(testData, 'utf8');
    const signature = (privateKey as any).sign(md);
    return (publicKey as any).verify(md.digest().bytes(), signature);
  }

  /**
   * Canonicalización XML C14N (simplificada)
   * Nota: Para producción, usar una librería C14N completa como xmldsigjs
   */
  private canonicalizeXml(xml: string): string {
    // Normalizar saltos de línea
    let canonical = xml.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // Remover declaración XML si existe
    canonical = canonical.replace(/^\s*<\?xml[^?]*\?>\s*/, '');
    
    // Normalizar espacios en atributos
    canonical = canonical.replace(/\s*=\s*/g, '=');
    
    // Ordenar atributos alfabéticamente por elemento (simplificado)
    // En producción usar xmldsigjs o similar para C14N real
    
    return canonical.trim();
  }

  /**
   * Calcula SHA-256 en Base64
   */
  private computeSha256(data: string): string {
    return createHash('sha256').update(data, 'utf-8').digest('base64');
  }

  /**
   * Genera la estructura XMLDSig
   */
  private generateXmlDsig(
    canonicalXml: string,
    digestValue: string,
    privateKey: forge.pki.PrivateKey,
    certificate: forge.pki.Certificate
  ): string {
    const certPem = forge.pki.certificateToPem(certificate);
    const certBase64 = certPem
      .replace('-----BEGIN CERTIFICATE-----', '')
      .replace('-----END CERTIFICATE-----', '')
      .replace(/\s/g, '');

    // Calcular SignatureValue (firma del SignedInfo)
    const signedInfo = this.buildSignedInfo(digestValue);
    const signedInfoCanonical = this.canonicalizeXml(signedInfo);
    const signatureValue = this.signData(signedInfoCanonical, privateKey);

    // Construir XMLDSig completo
    return `<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Id="SignatureSP">
  <ds:SignedInfo>
    <ds:CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315" />
    <ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256" />
    <ds:Reference URI="">
      <ds:Transforms>
        <ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature" />
      </ds:Transforms>
      <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256" />
      <ds:DigestValue>${digestValue}</ds:DigestValue>
    </ds:Reference>
  </ds:SignedInfo>
  <ds:SignatureValue>${signatureValue}</ds:SignatureValue>
  <ds:KeyInfo>
    <ds:X509Data>
      <ds:X509Certificate>${certBase64}</ds:X509Certificate>
    </ds:X509Data>
  </ds:KeyInfo>
</ds:Signature>`;
  }

  /**
   * Construye el SignedInfo para firmar
   */
  private buildSignedInfo(digestValue: string): string {
    return `<ds:SignedInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
  <ds:CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315" />
  <ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256" />
  <ds:Reference URI="">
    <ds:Transforms>
      <ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature" />
    </ds:Transforms>
    <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256" />
    <ds:DigestValue>${digestValue}</ds:DigestValue>
  </ds:Reference>
</ds:SignedInfo>`;
  }

  /**
   * Firma datos con clave privada RSA-SHA256
   */
  private signData(data: string, privateKey: forge.pki.PrivateKey): string {
    const md = forge.md.sha256.create();
    md.update(data, 'utf8');
    const signature = (privateKey as any).sign(md);
    return forge.util.encode64(signature);
  }

  /**
   * Inserta la firma en el XML UBL
   */
  private insertSignature(xml: string, signatureXml: string): string {
    // Buscar si ya existe UBLExtensions
    const ublExtensionsRegex = /<ext:UBLExtensions>([\s\S]*?)<\/ext:UBLExtensions>/;
    const match = xml.match(ublExtensionsRegex);

    if (match) {
      // Reemplazar ExtensionContent existente o agregar nuevo
      const ublExtensionRegex = /<ext:UBLExtension>([\s\S]*?)<\/ext:UBLExtension>/;
      const extMatch = match[1].match(ublExtensionRegex);
      
      if (extMatch) {
        // Reemplazar ExtensionContent
        const newExt = `<ext:UBLExtension><ext:ExtensionContent>${signatureXml}</ext:ExtensionContent></ext:UBLExtension>`;
        const newExtensions = match[1].replace(ublExtensionRegex, newExt);
        return xml.replace(ublExtensionsRegex, `<ext:UBLExtensions>${newExtensions}</ext:UBLExtensions>`);
      } else {
        // Agregar nuevo UBLExtension
        const newExt = `<ext:UBLExtension><ext:ExtensionContent>${signatureXml}</ext:ExtensionContent></ext:UBLExtension>`;
        return xml.replace(ublExtensionsRegex, `<ext:UBLExtensions>${match[1]}${newExt}</ext:UBLExtensions>`);
      }
    } else {
      // Insertar UBLExtensions al inicio (después de declaraciones de namespace)
      const firstElementEnd = xml.indexOf('>');
      if (firstElementEnd !== -1) {
        const prefix = xml.substring(0, firstElementEnd + 1);
        const suffix = xml.substring(firstElementEnd + 1);
        const ublExts = `<ext:UBLExtensions><ext:UBLExtension><ext:ExtensionContent>${signatureXml}</ext:ExtensionContent></ext:UBLExtension></ext:UBLExtensions>`;
        return prefix + ublExts + suffix;
      }
    }

    return xml;
  }

  /**
   * Extrae el nombre del archivo del ID del documento
   */
  private extractFileName(xml: string): string {
    const idMatch = xml.match(/<cbc:ID>([^<]+)<\/cbc:ID>/);
    if (idMatch) {
      return idMatch[1];
    }
    return 'document';
  }

  /**
   * Crea archivo ZIP con el XML firmado
   */
  private async createZip(fileName: string, xmlContent: string): Promise<string> {
    // Usar node-forge para crear ZIP (alternativa: jszip)
    const zip = forge.util.createBuffer();
    // Nota: node-forge no tiene ZIP nativo completo
    // En producción usar 'jszip' o 'adm-zip'
    
    // Implementación simple usando zlib + estructura ZIP manual
    // Para simplicidad, usar jszip en el paquete
    throw new Error('ZIP creation requires jszip dependency. Use ZipService.createZip() instead.');
  }

  /**
   * Verifica una firma XMLDSig
   */
  async verifySignature(signedXml: string): Promise<{
    valid: boolean;
    certificate?: forge.pki.Certificate;
    errors: string[];
  }> {
    const errors: string[] = [];
    
    try {
      // Extraer Signature
      const signatureMatch = signedXml.match(/<ds:Signature[^>]*>([\s\S]*?)<\/ds:Signature>/);
      if (!signatureMatch) {
        return { valid: false, errors: ['No signature found'] };
      }

      // Extraer certificado
      const certMatch = signedXml.match(/<ds:X509Certificate>([^<]+)<\/ds:X509Certificate>/);
      if (!certMatch) {
        return { valid: false, errors: ['No certificate in signature'] };
      }

      const certPem = `-----BEGIN CERTIFICATE-----\n${certMatch[1]}\n-----END CERTIFICATE-----`;
      const certificate = forge.pki.certificateFromPem(certPem);

      // Verificar validez del certificado
      const now = new Date();
      if (now < certificate.validity.notBefore || now > certificate.validity.notAfter) {
        errors.push('Certificate expired or not yet valid');
      }

      // TODO: Verificar cadena de confianza (CA SUNAT)
      // TODO: Verificar firma del SignedInfo
      // TODO: Verificar DigestValue vs XML canonicalizado

      return { valid: errors.length === 0, certificate, errors };
    } catch (error) {
      return { valid: false, errors: [error instanceof Error ? error.message : 'Verification failed'] };
    }
  }
}

export const xmlSignerService = new XmlSignerService();