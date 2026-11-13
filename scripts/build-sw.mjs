import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

async function walk(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async entry => entry.isDirectory()
    ? walk(join(directory, entry.name), `${prefix}${entry.name}/`)
    : [`/${prefix}${entry.name}`]));
  return files.flat();
}
const files = (await walk('dist')).filter(file => file !== '/sw.js').sort();
// A new trained model or manifest also invalidates the offline cache.
const assetHash = createHash('sha256');
for (const file of files) {
  assetHash.update(file);
  assetHash.update(await readFile(join('dist', file.slice(1))));
}
const hash = assetHash.digest('hex').slice(0, 12);
const cacheName = `ghostpilot-${hash}`;
await writeFile('dist/sw.js', `
const CACHE = ${JSON.stringify(cacheName)};
const FILES = ${JSON.stringify(['/', ...files])};
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('ghostpilot-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match('/').then(response => response || Response.error())));
    return;
  }
  // Assets are immutable and same-origin. Ignore Vary: Origin, which development
  // preview servers add and which differs between precache and module requests.
  event.respondWith(caches.open(CACHE).then(cache => cache.match(event.request, { ignoreVary: true })).then(cached => cached || fetch(event.request)));
});
`);
console.log(`Offline cache prepared: ${files.length} local assets, including pose and trained 4DGS models.`);
