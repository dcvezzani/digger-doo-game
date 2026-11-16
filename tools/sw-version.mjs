// Content hash of every file the service worker precaches. sw.js's VERSION
// must equal it, so any change to a game file changes the cache name and
// installed copies pick up the new version on their next launch.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export function listedFiles(swSource) {
  const block = swSource.match(/const FILES = \[([\s\S]*?)\];/)[1];
  return [...block.matchAll(/'([^']+)'/g)].map((m) => m[1]).filter((f) => f !== './');
}

export function contentVersion(root) {
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  const h = crypto.createHash('sha256');
  for (const f of listedFiles(sw).sort()) {
    h.update(f);
    h.update(fs.readFileSync(path.join(root, f)));
  }
  return `h${h.digest('hex').slice(0, 12)}`;
}

export function stampedVersion(root) {
  return fs.readFileSync(path.join(root, 'sw.js'), 'utf8').match(/const VERSION = '([^']+)'/)[1];
}
