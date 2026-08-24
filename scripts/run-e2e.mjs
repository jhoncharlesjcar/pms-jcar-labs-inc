import { spawn } from 'node:child_process';
import path from 'node:path';

const port = Number(process.env.E2E_PORT || 4173);
const baseURL = process.env.E2E_BASE_URL || `http://127.0.0.1:${port}`;
const extraArgs = process.argv.slice(2).filter((argument) => argument !== '--');
let server;

async function waitForServer(url, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Vite todavía no escucha.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Vite no respondió en ${url} dentro del tiempo esperado`);
}

function run(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, options);
    child.once('error', reject);
    child.once('exit', (code, signal) => resolve(code ?? (signal ? 1 : 0)));
  });
}

try {
  if (!process.env.E2E_BASE_URL) {
    server = spawn(process.execPath, [
      path.resolve('node_modules/vite/bin/vite.js'),
      '--host', '127.0.0.1',
      '--port', String(port),
      '--strictPort',
    ], {
      stdio: 'ignore',
      env: {
        ...process.env,
        VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321',
        VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || 'local-anon-key-for-browser-smoke-tests',
      },
    });
    await waitForServer(baseURL);
  }

  const code = await run(process.execPath, [
    path.resolve('node_modules/@playwright/test/cli.js'),
    'test',
    ...extraArgs,
  ], {
    stdio: 'inherit',
    env: { ...process.env, E2E_BASE_URL: baseURL },
  });
  process.exitCode = code;
} finally {
  if (server && server.exitCode == null) {
    server.kill();
    await Promise.race([
      new Promise((resolve) => server.once('exit', resolve)),
      new Promise((resolve) => setTimeout(resolve, 2_000)),
    ]);
  }
}
