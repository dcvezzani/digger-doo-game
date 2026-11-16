// Writes the content-hash VERSION into sw.js. Run after changing any game file:
//   npm run stamp
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { contentVersion } from './sw-version.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(root, 'sw.js');
const v = contentVersion(root);
const src = fs.readFileSync(file, 'utf8').replace(/const VERSION = '[^']*';/, `const VERSION = '${v}';`);
fs.writeFileSync(file, src);
console.log(`sw.js VERSION = ${v}`);
