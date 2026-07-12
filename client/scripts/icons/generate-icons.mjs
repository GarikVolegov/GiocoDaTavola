// Rasterise the SCHIERATI brand tile into the PNG icons the PWA manifest +
// iOS apple-touch-icon need. Run once when the brand art changes; the PNGs are
// committed as static assets so there is no standing build dependency.
//
// Usage (sharp is not a project dependency — install it transiently):
//   npm install --no-save sharp && node client/scripts/icons/generate-icons.mjs
//
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = join(here, '..', '..', 'public');
const fullbleed = join(here, 'icon-fullbleed.svg');
const maskable = join(here, 'icon-maskable.svg');

// density >> viewBox so librsvg rasterises crisply before any downscale.
const render = (src, size, out) =>
  sharp(src, { density: 512 }).resize(size, size).png({ compressionLevel: 9 }).toFile(join(publicDir, out));

await Promise.all([
  render(fullbleed, 192, 'icon-192.png'),
  render(fullbleed, 512, 'icon-512.png'),
  render(fullbleed, 180, 'apple-touch-icon.png'),
  render(maskable, 512, 'icon-maskable-512.png'),
]);

console.log('PWA icons generated into', publicDir);
