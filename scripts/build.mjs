import { mkdir, copyFile, rm } from 'node:fs/promises';

// Publish only the self-contained app and explicit hosting configuration.
// Clearing this generated folder prevents stale development files from shipping.
const output = new URL('../dist/', import.meta.url);
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await copyFile(new URL('../index.html', import.meta.url), new URL('index.html', output));
await copyFile(new URL('../public/_headers', import.meta.url), new URL('_headers', output));
console.log('Built dist/index.html and dist/_headers for Cloudflare Pages. Zero runtime dependencies.');
