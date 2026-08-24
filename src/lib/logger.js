const IS_DEV = import.meta.env.DEV;
const RELEASE = import.meta.env.VITE_RELEASE || 'development';
const ENVIRONMENT = import.meta.env.VITE_ENVIRONMENT || (IS_DEV ? 'development' : 'production');
const REDACTED = '[REDACTED]';
const SENSITIVE_KEY = /(authorization|cookie|password|secret|token|email|phone|telefono|document|dni|ruc|guest|huesped|content|message)/i;

function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `corr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function getCorrelationId() {
  if (typeof sessionStorage === 'undefined') return createId();
  const existing = sessionStorage.getItem('jcar_correlation_id');
  if (existing) return existing;
  const value = createId();
  sessionStorage.setItem('jcar_correlation_id', value);
  return value;
}

function scrubString(value) {
  return String(value)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, REDACTED)
    .replace(/\b(?:Bearer\s+)?eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, REDACTED)
    .replace(/\b\d{8,15}\b/g, REDACTED)
    .slice(0, 1000);
}

function sanitize(value, key = '', depth = 0) {
  if (SENSITIVE_KEY.test(key)) return REDACTED;
  if (value == null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') return scrubString(value);
  if (value instanceof Error) {
    return {
      name: value.name,
      message: scrubString(value.message),
      ...(IS_DEV && value.stack ? { stack: scrubString(value.stack) } : {}),
    };
  }
  if (depth >= 3) return '[TRUNCATED]';
  if (Array.isArray(value)) return value.slice(0, 10).map((item) => sanitize(item, '', depth + 1));
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 30)
        .map(([entryKey, entryValue]) => [entryKey, sanitize(entryValue, entryKey, depth + 1)]),
    );
  }
  return scrubString(value);
}

function emit(level, event, details = {}) {
  const record = Object.freeze({
    timestamp: new Date().toISOString(),
    level,
    event: scrubString(event || 'application.event'),
    correlation_id: getCorrelationId(),
    release: RELEASE,
    environment: ENVIRONMENT,
    details: sanitize(details),
  });

  if (level === 'error') console.error(record);
  else if (level === 'warn') console.warn(record);
  else if (IS_DEV) console.info(record);

  // Punto de integración para un proveedor explícitamente configurado. No
  // se envían datos por red y la carga del evento ya está redactada.
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('jcar:telemetry', { detail: record }));
  }

  return record;
}

const logger = {
  info: (event, ...details) => emit('info', event, details.length <= 1 ? details[0] : details),
  warn: (event, ...details) => emit('warn', event, details.length <= 1 ? details[0] : details),
  error: (event, ...details) => emit('error', event, details.length <= 1 ? details[0] : details),
  debug: (event, ...details) => {
    if (IS_DEV) return emit('debug', event, details.length <= 1 ? details[0] : details);
    return undefined;
  },
  withCorrelation: (correlationId, event, details = {}) => emit('info', event, {
    ...details,
    upstream_correlation_id: scrubString(correlationId),
  }),
};

export { emit, sanitize };
export default logger;
