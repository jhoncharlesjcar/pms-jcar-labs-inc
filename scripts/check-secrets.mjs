import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const tracked = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean)
  .filter((file) => !/\.(?:jpg|jpeg|png|gif|woff2?|pdf)$/i.test(file))
  .filter((file) => file !== 'pnpm-lock.yaml' && !file.startsWith('supabase/dist/'));

const rules = [
  { name: 'clave service_role expuesta a Vite', pattern: /VITE_[A-Z0-9_]*SERVICE[_-]?ROLE/i },
  { name: 'clave privada PEM', pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: 'JWT Supabase incrustado', pattern: /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.eyJ[A-Za-z0-9_-]{40,}\.[A-Za-z0-9_-]{20,}/ },
  { name: 'API key o secreto expuesto a Vite', pattern: /VITE_[A-Z0-9_]*(API[_-]?KEY|SECRET[_-]?KEY|PRIVATE[_-]?KEY)/i },
  { name: 'clave API con prefijo sk-', pattern: /\bsk-[A-Za-z0-9._-]{20,}/ },
  { name: 'clave privada de pasarela expuesta a Vite', pattern: /VITE_[A-Z0-9_]*(PRIVATE|SECRET|PASSWORD|CREDENTIAL)/i },
  // La URL del proyecto Supabase es pública (equivale a VITE_SUPABASE_URL) y las
  // migraciones SQL de cron jobs (pg_cron + net.http_post) la requieren embebida
  // para invocar las Edge Functions. No es un secreto, por eso se omite en .sql.
  { name: 'URL de proyecto Supabase incrustada', pattern: /https:\/\/[a-z]{20}\.supabase\.co/i, skipSql: true },
];

const findings = [];
for (const file of tracked) {
  // Deleted files remain in `git ls-files` until the change is committed.
  if (!existsSync(file)) continue;
  const content = readFileSync(file, 'utf8');
  for (const rule of rules) {
    if (rule.skipSql && file.endsWith('.sql')) continue;
    if (rule.pattern.test(content)) findings.push(`${file}: ${rule.name}`);
  }
}

if (findings.length > 0) {
  console.error(['Posibles secretos o configuraciones peligrosas:', ...findings.map((item) => `- ${item}`)].join('\n'));
  process.exit(1);
}

console.log(`${tracked.length} archivos rastreados revisados sin secretos conocidos.`);
