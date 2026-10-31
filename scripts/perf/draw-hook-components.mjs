// Browser-lane required. First prove exact A/A, then compare native components.
// --control=<landed revision> --candidate=<landed revision> --out=tmp/<owned dir>
// Optional --candidate-draw-hooks=PATH is an explicit isolated source fixture;
// --candidate-upload-ownership=PATH isolates the upload observer, or pairs it
// with the draw fixture for an ownership continuation change.
// Whole-world proof still uses ordinary exact-revision previews.
import { chromium, devices } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildComponents } from './draw-hook-component-build.mjs';
import { readParityFrame } from '../parity/frame-bytes.mjs';

const arg = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const control = arg('control'), candidate = arg('candidate'), output = arg('out');
if (!control || !candidate || !output) throw new Error('Requires --control=REV --candidate=REV --out=tmp/owned');
const out = resolve(output);
if (!out.startsWith(`${resolve('tmp')}/`)) throw new Error('Components require repository tmp output');
mkdirSync(out, { recursive: true });
const drawFixture = arg('candidate-draw-hooks'), uploadFixture = arg('candidate-upload-ownership');
const candidateSourceFixture = drawFixture ?? uploadFixture ?? null;
const candidateModule = !drawFixture && uploadFixture ? 'src/engine/render/uploadOwnership.ts' : 'src/engine/render/drawHooks.ts';
const revisions = await buildComponents(control, candidate, out, candidateSourceFixture ?? undefined, drawFixture ? uploadFixture : undefined, candidateModule);
const result = { revisions, candidateSourceFixture, additionalUploadFixture: drawFixture ? uploadFixture ?? null : null, candidateModule, protocol: 'Metal WebGL2, iPhone 16 Pro PWA 402x874, DPR2, seeded static components, no post; exact RGBA and native counts', rows: [], comparisons: [] };
const save = () => writeFileSync(resolve(out, 'reading.json'), JSON.stringify(result, null, 2));
const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--use-angle=metal'] });
try {
  for (const [index, side] of ['candidate', 'candidate', 'control'].entries()) {
    const context = await browser.newContext({ ...devices['iPhone 16 Pro'], viewport: devices['iPhone 16 Pro'].screen, deviceScaleFactor: 2 });
    try {
      await context.addInitScript(() => { let seed = 357; Math.random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; }; });
      await context.route('https://component.invalid/**', route => route.fulfill(route.request().url().endsWith('/entry.js')
        ? { status: 200, contentType: 'text/javascript', body: readFileSync(resolve(out, side, 'entry.js')) }
        : { status: 200, contentType: 'text/html', body: '<!doctype html><html><body><script type="module" src="/entry.js"></script></body></html>' }));
      const page = await context.newPage(), errors = [];
      page.setDefaultTimeout(30000);
      page.on('pageerror', error => { errors.push(String(error)); });
      await page.goto('https://component.invalid/');
      await page.waitForFunction(() => window.componentProof, undefined, { timeout: 30000 });
      const status = await page.evaluate(() => ({ error: window.componentProof.error, rows: window.componentProof.snapshots?.map(({ id, state }) => ({ id, state })) }));
      if (status.error || errors.length > 0) throw new Error(status.error ?? errors.join('\n'));
      for (const [rowIndex, snapshot] of status.rows.entries()) {
        const handle = await page.evaluateHandle(position => { const frame = window.componentProof.snapshots[position]; return { ...frame, ...frame.state }; }, rowIndex);
        await readParityFrame(page, handle, resolve(out, `${index}-${snapshot.id}.rgba`));
      }
      result.rows.push({ side, rows: status.rows });
      if (index > 0) for (const [rowIndex, row] of result.rows[0].rows.entries()) {
        const other = status.rows[rowIndex];
        if (other?.id !== row.id) throw new Error('Native component inventory differs');
        const a = readFileSync(resolve(out, `0-${row.id}.rgba`)), b = readFileSync(resolve(out, `${index}-${row.id}.rgba`));
        if (a.length !== b.length) throw new Error('Native component dimensions differ');
        let changed = 0;
        for (let offset = 0; offset < a.length; offset += 4) if (!a.subarray(offset, offset + 4).equals(b.subarray(offset, offset + 4))) changed++;
        const stateEqual = JSON.stringify(row) === JSON.stringify(other);
        result.comparisons.push({ phase: index === 1 ? 'A/A' : 'before/after', id: row.id, changed, stateEqual });
        save();
        if (changed !== 0 || !stateEqual) throw new Error(`Nonidentical ${index === 1 ? 'A/A' : 'before/after'} component ${row.id}: ${changed} pixels`);
      }
      save();
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
console.info(`draw-hook-components: ${result.comparisons.length} exact native comparisons`);
