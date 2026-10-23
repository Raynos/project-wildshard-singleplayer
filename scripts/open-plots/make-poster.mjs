// G633 (Night Market pilot NM3): an open plot's poster: the idea's hero picture over its name and the invitation to build
// it, on a navy board with a cyan rim (the round 49 posters, art/grid/round-49-night-market-billboards-2x2/bb-b.jpg), 16:9.
// Usage: node scripts/open-plots/make-poster.mjs <hero.jpg> <crop x,y,w,h> <NAME> <out.webp>
import { writeFileSync } from 'node:fs';
import sharp from 'sharp';

if (process.argv.length !== 6) throw new Error('usage: make-poster.mjs <hero> <x,y,w,h> <NAME> <out.webp>');
const [hero, crop, name, out] = process.argv.slice(2);
const [left, top, width, height] = crop.split(',').map(Number);
const W = 1024, H = 576, RIM = 12, PAD = 34, PICTURE = { w: W - 2 * PAD, h: 330 };
const picture = await sharp(hero).extract({ left, top, width, height }).resize(PICTURE.w, PICTURE.h, { fit: 'cover' }).toBuffer();
const mask = Buffer.from(`<svg width="${PICTURE.w}" height="${PICTURE.h}"><rect width="${PICTURE.w}" height="${PICTURE.h}" rx="14" ry="14"/></svg>`);
const rounded = await sharp(picture).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
const text = Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <rect x="${RIM / 2}" y="${RIM / 2}" width="${W - RIM}" height="${H - RIM}" rx="20" ry="20" fill="none" stroke="#46e6ff" stroke-width="${RIM}"/>
  <text x="${W / 2}" y="${PAD + PICTURE.h + 112}" text-anchor="middle" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-weight="800" font-size="104" fill="#ffffff" letter-spacing="2">${name}</text>
  <text x="${W / 2}" y="${PAD + PICTURE.h + 170}" text-anchor="middle" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-weight="700" font-size="44" fill="#ffcf73" letter-spacing="6">BUILD THIS SHARD</text>
</svg>`);
const poster = await sharp({ create: { width: W, height: H, channels: 3, background: '#14203f' } })
  .composite([{ input: rounded, left: PAD, top: PAD }, { input: text, left: 0, top: 0 }]).webp({ quality: 86 }).toBuffer();
writeFileSync(out, poster);
console.info(`poster ${out} ${poster.length} bytes`);
