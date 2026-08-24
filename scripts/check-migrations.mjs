import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const directory = path.resolve('supabase/migrations');
const migrations = readdirSync(directory)
  .filter((name) => name.endsWith('.sql'))
  .sort();
const errors = [];
const timestamps = new Map();

for (const name of migrations) {
  const match = /^(\d{14})_[a-z0-9_]+\.sql$/.exec(name);
  if (!match) {
    errors.push(`${name}: use YYYYMMDDHHMMSS_descripcion_en_snake_case.sql`);
    continue;
  }

  if (timestamps.has(match[1])) {
    errors.push(`${name}: timestamp duplicado con ${timestamps.get(match[1])}`);
  }
  timestamps.set(match[1], name);

  const sql = readFileSync(path.join(directory, name), 'utf8');
  if (/^(<{7}|={7}|>{7})/m.test(sql)) errors.push(`${name}: contiene marcadores de conflicto`);
  if (/\b(?:DROP\s+DATABASE|ALTER\s+SYSTEM)\b/i.test(sql)) errors.push(`${name}: contiene una operación global prohibida`);
  if (/\b(?:service_role|postgres)\b\s*,?\s*\b(?:anon|authenticated)\b/i.test(sql)) {
    errors.push(`${name}: revisar grants que mezclan roles privilegiados y públicos`);
  }
}

if (migrations.length === 0) errors.push('No existen migraciones SQL');

if (errors.length > 0) {
  console.error(['Falló la higiene de migraciones:', ...errors.map((error) => `- ${error}`)].join('\n'));
  process.exit(1);
}

console.log(`${migrations.length} migraciones con nombres únicos y sin patrones globales peligrosos.`);
