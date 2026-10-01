#!/usr/bin/env node
// E357 X3 / T3: validate authored inventories; report unused originals without removing them.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function auditInventory(rows, exists) {
  const errors = [];
  for (const row of rows) {
    const packed = new Set(row.packed);
    for (const file of row.files) if (!exists(file)) errors.push(`${row.slug}/${row.tier}: missing declared file ${file}`);
    for (const file of row.packFiles) if (!packed.has(file)) errors.push(`${row.slug}/${row.tier}: file absent from pack ${file}`);
    for (const file of packed) if (!row.packFiles.includes(file)) errors.push(`${row.slug}/${row.tier}: orphan pack member ${file}`);
    for (const [source, target] of Object.entries(row.gpu)) if (!exists(target)) errors.push(`${row.slug}/${row.tier}: missing GPU stand-in ${source} -> ${target}`);
    for (const file of row.ktxFiles) if (!exists(file)) errors.push(`${row.slug}/${row.tier}: missing KTX2-mode file ${file}`);
  }
  return errors;
}

const root = resolve(import.meta.dirname, '..');
const tier = process.argv.find((arg) => arg.startsWith('--collect='))?.slice(10);
if (tier) {
  const { initializeTier } = await import('../src/engine/core/tier.ts'); initializeTier(tier);
  const { SHARDS } = await import('../src/game/shard/shards.generated.ts');
  const { PACKS } = await import('../src/engine/boot/packs.generated.ts');
  const { GPU_FILES: shared } = await import('../src/engine/boot/ktx2.generated.ts');
  const rows = [];
  for (const manifest of SHARDS) {
    if (manifest.status === 'hidden') continue;
    const boot = manifest.boot;
    if (!boot?.sources) throw new Error(`audit-assets: ${manifest.slug} has no authored boot.sources`);
    const audio = await boot.audio?.() ?? [];
    const art = boot.explore?.art ?? [];
    const shown = [];
    const pictures = (value) => {
      if (typeof value === 'string' && /^\/(src|assets)\/.+\.(jpe?g|png|webp)$/.test(value)) shown.push(value);
      else if (value !== null && typeof value === 'object') for (const child of Object.values(value)) pictures(child);
    };
    pictures(manifest.explore);
    for (const image of shown) if (!art.includes(image)) throw new Error(`${manifest.slug}: Explore image absent from boot.explore.art: ${image}`);
    const table = manifest.ktx2 ? (await manifest.ktx2()).GPU_FILES[tier] : {};
    const gpu = { ...shared[tier], ...table };
    const img = boot.sources(tier, 'img'), ktx = boot.sources(tier, 'ktx2');
    const mode = manifest.tiers?.[tier]?.textures ?? 'img';
    const sources = mode === 'ktx2' ? ktx : img;
    const packFiles = [...sources.sky, ...sources.baked, ...sources.terrain, ...sources.trees, ...sources.cabins, ...sources.props];
    const pack = Object.hasOwn(PACKS, manifest.slug) ? PACKS[manifest.slug]?.[tier] : undefined;
    const packed = pack === undefined ? [] : pack.files.map(([path]) => path);
    rows.push({ slug: manifest.slug, tier, files: [...new Set([...boot.files(tier), ...Object.values(img).flat(), ...(boot.lateReads?.(tier, 'img') ?? []), ...(boot.precache ?? []), ...art, ...Object.values(manifest.card).filter((value) => typeof value === 'string' && value.startsWith('/src/')), ...audio])], packFiles: [...new Set(packFiles)], packed, gpu, ktxFiles: [...new Set([...Object.values(ktx).flat(), ...(boot.lateReads?.(tier, 'ktx2') ?? [])])] });
  }
  process.stdout.write(JSON.stringify(rows));
} else if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const rows = ['phone', 'desktop'].flatMap((value) => JSON.parse(execFileSync(process.execPath, ['--experimental-transform-types', '--import', './scripts/bake-loader.mjs', 'scripts/audit-assets.mjs', `--collect=${value}`], { cwd: root, encoding: 'utf8' })));
    const publicFile = (url) => resolve(root, url.startsWith('/src/') ? '.' : 'public', `.${url.split('#')[0]}`);
    const errors = auditInventory(rows, (url) => existsSync(publicFile(url)));
    // Licenced audio has its attribution beside its inventory. CC0/procedural art needs no credit row.
    const credits = [];
    for (const kind of ['music', 'sfx']) {
      const dir = resolve(root, 'public/assets', kind);
      for (const set of readdirSync(dir)) {
        const path = resolve(dir, set, `${kind}.json`); if (!existsSync(path)) continue;
        const text = readFileSync(path, 'utf8'), manifest = JSON.parse(text);
        const required = kind === 'music' && /MiniMax/i.test(text) ? 'MiniMax-Music3' : kind === 'sfx' && /Stable Audio|Stability AI/i.test(text) ? 'Powered by Stability AI' : null;
        if (required && (typeof manifest.credit !== 'string' || !manifest.credit.includes(required))) errors.push(`${kind}/${set}: missing required credit ${required}`);
        credits.push({ set: `${kind}/${set}`, credit: manifest.credit ?? null, required });
      }
    }
    const used = new Set(rows.flatMap((row) => [...row.files, ...row.ktxFiles]));
    const originals = [];
    const texRoot = resolve(root, 'public/assets/tex');
    const walk = (dir) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = resolve(dir, entry.name);
        if (entry.isDirectory()) walk(path);
        else {
          const url = `/${path.slice(resolve(root, 'public').length + 1)}`;
          originals.push({ url, bytes: statSync(path).size, referencedBy: rows.filter((row) => row.files.includes(url)).map((row) => `${row.slug}/${row.tier}`), gpu: Object.fromEntries(rows.map((row) => [`${row.slug}/${row.tier}`, row.gpu[url] ?? row.gpu[`${url}#layer`] ?? null]).filter(([, value]) => value !== null)) });
        }
      }
    };
    walk(texRoot);
    const unreferenced = originals.filter((row) => !used.has(row.url));
    const report = { errors, inventories: rows, credits, originals, unreferencedOriginals: unreferenced, unreferencedBytes: unreferenced.reduce((sum, row) => sum + row.bytes, 0), note: 'Unreferenced originals are review candidates, never automatic deletions; image-mode fallbacks remain supported.' };
    const out = process.argv.find((arg) => arg.startsWith('--out='))?.slice(6);
    if (out) { if (!existsSync(dirname(out))) throw new Error(`audit-assets: output directory does not exist: ${dirname(out)}`); writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`); }
    for (const row of rows) console.log(`${row.slug}/${row.tier}: ${row.files.length} declared, ${row.packed.length} packed, ${row.ktxFiles.length} KTX2-mode files`);
    console.log(`T3: ${originals.length} original texture files; ${unreferenced.length} absent from authored runtime inventories (${(report.unreferencedBytes / 1048576).toFixed(2)} MiB). No deletions.`);
    for (const error of errors) console.error(`audit-assets: ${error}`);
    if (errors.length > 0) process.exitCode = 1;
  } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}
