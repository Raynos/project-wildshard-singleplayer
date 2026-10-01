/** E335: inspect every actual Model Explorer card and variant in a served build.
 * Run through scripts/browser-lane.sh. This reads skins, bones and weights; it does not infer clip quality.
 * node scripts/audit-animation-models.mjs http://127.0.0.1:4400 docs/audits/animation-models.json
 */
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const [base, output] = process.argv.slice(2);
if (!base || !output) throw new Error('Usage: audit-animation-models.mjs <served URL> <output.json>');
const shards = ['driftwood-isle', 'pine-hollow', 'nalati-grasslands', 'nine-dragon-stack'];
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal'] });
const report = { date: '2026-09-30', method: 'Live Model Explorer registry, all cards and all variants; structural inspection only', shards: [] };
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  for (const shard of shards) {
    const url = new URL(base);
    url.search = new URLSearchParams({ chunk: shard, touch: '', tier: 'phone', skipintro: '', nolock: '', mute: '' }).toString();
    await page.goto(url.href);
    await page.waitForFunction(() => Boolean(window.__wildshard?.world?.registry?.models().length), undefined, { timeout: 300000 });
    await page.waitForTimeout(1500);
    const entries = await page.evaluate(() => window.__wildshard.world.registry.models().map((e) => ({
      id: e.id, name: e.name, category: e.category, file: e.file, drawnAs: e.drawnAs, pipeline: e.pipeline,
      variants: e.variants ?? [],
    })));
    const cards = [];
    for (const entry of entries) {
      const samples = [];
      for (const variant of entry.variants.length > 0 ? entry.variants : [{ id: '', label: 'Default' }]) {
        await page.evaluate(({ id, variant: variantId }) => {
          const e = window.__wildshard.world.registry.models().find((x) => x.id === id);
          if (!e) throw new Error(`Missing card ${id}`);
          if (variantId) e.rebuild?.(variantId);
          e.object();
        }, { id: entry.id, variant: variant.id });
        await page.waitForTimeout(['people', 'creatures', 'gear'].includes(entry.category) || entry.id.includes('dummy') ? 450 : 30);
        const sample = await page.evaluate((id) => {
          const e = window.__wildshard.world.registry.models().find((x) => x.id === id);
          const root = e.object();
          const skins = [], bones = new Set();
          let meshes = 0, vertices = 0, children = 0;
          root.traverse((o) => {
            children++;
            if (o.isBone) bones.add(o.name);
            if (!o.isMesh) return;
            meshes++; vertices += o.geometry.getAttribute('position')?.count ?? 0;
            if (!o.isSkinnedMesh) return;
            const w = o.geometry.getAttribute('skinWeight'), ix = o.geometry.getAttribute('skinIndex');
            let badWeights = 0, badIndices = 0;
            if (w && ix) for (let i = 0; i < w.count; i++) {
              const ws = [w.getX(i), w.getY(i), w.getZ(i), w.getW(i)];
              const ids = [ix.getX(i), ix.getY(i), ix.getZ(i), ix.getW(i)];
              const sum = ws.reduce((a, b) => a + b, 0);
              if (!Number.isFinite(sum) || Math.abs(sum - 1) > 0.015 || ws.some((x) => x < 0)) badWeights++;
              if (ids.some((j, k) => ws[k] > 0 && (j < 0 || j >= o.skeleton.bones.length))) badIndices++;
            }
            skins.push({ joints: o.skeleton.bones.map((b) => b.name), vertices: w?.count ?? 0, badWeights, badIndices });
          });
          return { meshes, vertices, children, bones: [...bones], skins, state: skins.length > 0 ? 'skinned' : bones.size > 0 ? 'bones-without-skin' : 'no-skin' };
        }, entry.id);
        samples.push({ variant: variant.id, label: variant.label, ...sample });
      }
      cards.push({ ...entry, samples });
      console.log(shard, entry.id, samples.map((s) => `${s.variant.length > 0 ? s.variant : 'default'}:${s.state}`).join(', '));
    }
    report.shards.push({ shard, cards });
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, `${JSON.stringify(report, null, 2)  }\n`);
  }
} finally { await browser.close(); }
