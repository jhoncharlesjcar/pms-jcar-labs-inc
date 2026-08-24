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
  { name: 'URL de proyecto Supabase incrustada', pattern: /https:\/\/[a-z]{20}\.supabase\.co/i },
];

const findings = [];
for (const file of tracked) {
  // Deleted files remain in `git ls-files` until the change is committed.
  if (!existsSync(file)) continue;
  const content = readFileSync(file, 'utf8');
  for (const rule of rules) {
    if (rule.pattern.test(content)) findings.push(`${file}: ${rule.name}`);
  }
}

if (findings.length > 0) {
  console.error(['Posibles secretos o configuraciones peligrosas:', ...findings.map((item) => `- ${item}`)].join('\n'));
  process.exit(1);
}

console.log(`${tracked.length} archivos rastreados revisados sin secretos conocidos.`);
