/**
 * Logger — Centraliza y controla la salida de logs según el entorno.
 *
 * - En desarrollo (`import.meta.env.DEV`): todos los niveles se muestran.
 * - En producción: solo `warn` y `error` se muestran; `info` y `debug` se silencian.
 *
 * Uso:
 *   import logger from '@/lib/logger';
 *   logger.info('Mensaje informativo');
 *   logger.warn('Advertencia', detalle);
 *   logger.error('Error crítico', err);
 *   logger.debug('Solo en desarrollo', data);
 */

const IS_DEV = import.meta.env.DEV;

const logger = {
  /** Muestra un mensaje informativo (solo en desarrollo). */
  info: (...args) => {
    if (IS_DEV) console.log(...args);
  },
  /** Muestra una advertencia (siempre visible). */
  warn: (...args) => {
    console.warn(...args);
  },
  /** Muestra un error (siempre visible). */
  error: (...args) => {
    console.error(...args);
  },
  /** Muestra un mensaje de depuración con prefijo [DEBUG] (solo en desarrollo). */
  debug: (...args) => {
    if (IS_DEV) console.log('[DEBUG]', ...args);
  },
};

export default logger;
