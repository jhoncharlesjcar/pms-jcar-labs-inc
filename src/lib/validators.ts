import { FORMATOS_PERU } from '@/config/constants';

/**
 * Valida un número de DNI (debe tener exactamente 8 dígitos numéricos)
 */
export function validateDNI(dni: string | number): boolean {
  const cleanDni = String(dni).trim();
  return /^\d{8}$/.test(cleanDni);
}

/**
 * Valida un número de RUC (debe tener exactamente 11 dígitos y cumplir con el algoritmo Sunat)
 */
export function validateRUC(ruc: string | number): boolean {
  const cleanRuc = String(ruc).trim();
  if (!/^\d{11}$/.test(cleanRuc)) return false;

  // Los RUCs válidos en Perú comienzan habitualmente con 10, 15, 17, 20
  const rucPrefixes = ['10', '15', '17', '20'];
  if (!rucPrefixes.includes(cleanRuc.substring(0, 2))) return false;

  // Algoritmo de validación de dígito verificador módulo 11
  const factors = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleanRuc[i]) * factors[i];
  }

  const remainder = sum % 11;
  const expectedVerifier = 11 - remainder;
  const actualVerifier = parseInt(cleanRuc[10]);

  if (expectedVerifier === 10) return actualVerifier === 0;
  if (expectedVerifier === 11) return actualVerifier === 1;
  return actualVerifier === expectedVerifier;
}

/**
 * Valida un número de celular de Perú (debe empezar con 9 y tener 9 dígitos)
 */
export function validateCelular(cel: string | number): boolean {
  const cleanCel = String(cel).trim();
  return /^9\d{8}$/.test(cleanCel);
}

/**
 * Valida una dirección de correo electrónico estándar
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email.trim());
}

/**
 * Valida una operación de Yape/Plin (código de operación suele ser de 6 a 8 dígitos alfanuméricos)
 */
export function validateOperacionBancaria(code: string): boolean {
  const cleanCode = code.trim();
  return cleanCode.length >= 4 && cleanCode.length <= 12;
}
