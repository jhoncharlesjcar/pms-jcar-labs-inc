import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const functionsRoot = path.resolve('supabase/functions');
const entries = readdirSync(functionsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
  .map((entry) => path.join(functionsRoot, entry.name, 'index.ts'))
  .sort();
const tests = [path.join(functionsRoot, '_shared', 'runtime_test.ts')];

if (entries.length === 0) {
  throw new Error('No se encontraron Edge Functions para validar');
}

const binary = process.platform === 'win32' ? 'deno.exe' : 'deno';
const updateLock = process.argv.includes('--update-lock');
const result = spawnSync(binary, [
  'check',
  '--config',
  path.join(functionsRoot, 'deno.json'),
  '--lock',
  path.resolve('deno.lock'),
  updateLock ? '--frozen=false' : '--frozen',
  ...entries,
], { stdio: 'inherit' });

if (result.error) {
  console.error(`No se pudo ejecutar Deno: ${result.error.message}`);
  process.exit(1);
}

if ((result.status ?? 1) !== 0) process.exit(result.status ?? 1);

const testResult = spawnSync(binary, [
  'test',
  '--config',
  path.join(functionsRoot, 'deno.json'),
  '--lock',
  path.resolve('deno.lock'),
  updateLock ? '--frozen=false' : '--frozen',
  ...tests,
], { stdio: 'inherit' });

if (testResult.error) {
  console.error(`No se pudieron ejecutar los tests Edge: ${testResult.error.message}`);
  process.exit(1);
}

process.exit(testResult.status ?? 1);
