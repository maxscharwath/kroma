// Post-build pre-compression: emit a `.br` and `.gz` sibling for every
// compressible asset in dist/client. The Rust server's ServeDir is configured
// with `precompressed_br()/precompressed_gzip()`, so it serves these files
// as-is and the NAS never spends CPU compressing static assets at runtime.
// Zero-dependency on purpose (node:zlib ships both codecs).
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import zlib from 'node:zlib';

const brotli = promisify(zlib.brotliCompress);
const gzip = promisify(zlib.gzip);

const ROOT = path.resolve(process.argv[2] ?? 'dist/client');
const EXTENSIONS = new Set(['.js', '.mjs', '.css', '.html', '.svg', '.json', '.txt', '.map', '.webmanifest']);
// Below this, compression overhead beats the savings.
const MIN_BYTES = 1024;

async function* walk(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(abs);
    else yield abs;
  }
}

let files = 0;
let saved = 0;
for await (const file of walk(ROOT)) {
  if (!EXTENSIONS.has(path.extname(file))) continue;
  const source = await fs.readFile(file);
  if (source.length < MIN_BYTES) continue;
  const [br, gz] = await Promise.all([
    brotli(source, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } }),
    gzip(source, { level: 9 }),
  ]);
  await Promise.all([fs.writeFile(`${file}.br`, br), fs.writeFile(`${file}.gz`, gz)]);
  files += 1;
  saved += source.length - br.length;
}
console.log(`precompress: ${files} assets, ${(saved / 1024).toFixed(0)} KiB saved (brotli)`);
