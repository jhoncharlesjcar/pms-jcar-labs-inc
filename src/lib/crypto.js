import CryptoJS from 'crypto-js';
import logger from '@/lib/logger';

// Obligatorio: VITE_ENCRYPTION_KEY debe estar definida en .env
// Si no está definida, se lanza un error en tiempo de ejecución
const SECRET_KEY = import.meta.env.VITE_ENCRYPTION_KEY;
if (!SECRET_KEY) {
  throw new Error('⚠️ Variable de entorno faltante: VITE_ENCRYPTION_KEY. Defínela en .env');
}

export const encryptData = (data) => {
    if (!data) return data;
    try {
        return CryptoJS.AES.encrypt(data, SECRET_KEY).toString();
    } catch (error) {
        logger.error('Encryption error:', error);
        return data;
    }
};

export const decryptData = (ciphertext) => {
    if (!ciphertext) return ciphertext;
    // Evitar intentar descifrar algo que no está cifrado (si viene en texto plano de BD antigua)
    if (!ciphertext.startsWith('U2FsdGVkX1')) {
        return ciphertext;
    }
    
    try {
        const bytes = CryptoJS.AES.decrypt(ciphertext, SECRET_KEY);
        const originalText = bytes.toString(CryptoJS.enc.Utf8);
        return originalText || ciphertext; // fallback al original si falla (llave incorrecta)
    } catch (error) {
        logger.error('Decryption error:', error);
        return ciphertext; // Devolver texto tal cual si no se puede descifrar
    }
};
