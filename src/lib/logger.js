/**
 * Logger Utility — Centraliza y controla la salida de logs en producción.
 *
 * - En desarrollo (process.env.NODE_ENV !== 'production'): todos los niveles se muestran.
 * - En producción: solo `warn` y `error` se muestran; `info` y `debug` se silencian.
 *
 * Compatible con Vite (reemplaza process.env.NODE_ENV en build) y Jest (NODE_ENV='test').
 *
 * Uso:
 *   import logger from '@/lib/logger';
 *   logger.info('Mensaje informativo');
 *   logger.warn('Advertencia', detalle);
 *   logger.error('Error crítico', err);
 *   logger.debug('Solo en desarrollo', data);
 */

const IS_DEV = process.env.NODE_ENV !== 'production';

const logger = {
  info: (...args) => {
    if (IS_DEV) console.log(...args);
  },
  warn: (...args) => {
    console.warn(...args);
  },
  error: (...args) => {
    console.error(...args);
  },
  debug: (...args) => {
    if (IS_DEV) console.log('[DEBUG]', ...args);
  },
};

export default logger;
