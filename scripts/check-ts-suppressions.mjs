import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const sourceRoot = path.resolve('src');
const forbidden = /@ts-(?:nocheck|ignore|expect-error)\b/;
const violations = [];

function scan(directory) {
  for (const entry of readdirSync(directory)) {
    const target = path.join(directory, entry);
    if (statSync(target).isDirectory()) {
      scan(target);
      continue;
    }
    if (!/\.[cm]?[jt]sx?$/.test(entry)) continue;
    const lines = readFileSync(target, 'utf8').split(/\r?\n/);
    lines.forEach((line, index) => {
      if (forbidden.test(line)) violations.push(`${path.relative(process.cwd(), target)}:${index + 1}`);
    });
  }
}

scan(sourceRoot);
if (violations.length > 0) {
  console.error(['No se permiten supresiones globales o locales de TypeScript en src:', ...violations.map((item) => `- ${item}`)].join('\n'));
  process.exit(1);
}
console.log('src no contiene @ts-nocheck, @ts-ignore ni @ts-expect-error.');
