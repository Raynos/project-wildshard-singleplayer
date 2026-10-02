// Run against the lead's commit after both Opus weapon callbacks adopt app.combat targets.
// browserPool leases each browser through browser-lane.sh; no outer lane wrapper is needed.
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { cachedTree, serve } from '../../../scripts/parity/serve.mjs';
import { browserPool } from '../../../scripts/parity/pool.mjs';
import { installInit } from '../../../scripts/parity/init.mjs';
import { advance, poseAt } from '../../../scripts/parity/frames.mjs';
import { touch, TOUCH } from '../../../scripts/parity/walk.mjs';
import { debugSettings } from '../../../scripts/debug-settings.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url)).replace(/\/$/u, '');
const sha = process.argv[2];
if (!sha) throw new Error('usage: node progress/normalization/arena/capture.mjs <candidate sha> [outdir]');
const out = process.argv[3] ?? fileURLToPath(new URL('./', import.meta.url));
mkdirSync(out, { recursive: true });
const tree = await cachedTree(root, sha), preview = await serve(tree.tree, sha, true), pool = browserPool(root, 1, 'metal');
const results = [];
try {
  const browser = await pool.browser(0);
  for (const [shard, weapon] of [['far-reach', 'fan'], ['sunscar-dunes', 'whip']]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
    try {
      await installInit(context, { lane: 'm5', sha, browser: browser.version(), capture: 30, accelerated: true, tier: 'phone' });
      await debugSettings(context, { touch: 'on', developer: 'on' });
      const page = await context.newPage(); page.setDefaultTimeout(120000);
      await page.goto(`${preview.url}/?chunk=${shard}&tier=phone&touch&skipintro&nolock&mute&sw=0`);
      await page.waitForFunction(() => Boolean(window.__wildshard) && !document.querySelector('.ws-load') && !document.querySelector('.ws-load-error'));
      await advance(page, 30);
      await page.evaluate(() => window.__wildshard.arena());
      await advance(page, 3);
      await page.evaluate(async () => { await window.__wildshard.world.arena.preload(); });
      for (let index = 0; index < 3; index++) {
        const setup = await page.evaluate((i) => {
          const target = window.__wildshard.world.arena.targets[i];
          if (!target) throw new Error('missing practice dummy');
          const p = target.position;
          return { variant: target.variant, pose: { x: p.x, y: p.y, z: p.z + 1.8, yaw: 0 }, aimY: p.y + 1.05 };
        }, index);
        await poseAt(page, setup.pose); await advance(page, 30);
        await page.evaluate((aimY) => { const p = window.__wildshard.world.player; p.pitch = Math.atan2(aimY - (p.position.y + 1.68), 1.8); }, setup.aimY);
        await advance(page, 3);
        for (const heavy of [false, true]) {
          await advance(page, 45);
          const before = await page.evaluate(() => window.__wildshard.combat.hits.length);
          await touch(page, TOUCH.attack, heavy ? { hold: 800 } : {});
          for (let frame = 0; frame < 25; frame++) {
            if (await page.evaluate((n) => window.__wildshard.combat.hits.length > n, before)) break;
            await advance(page, 1);
          }
          const proof = await page.evaluate(({ n, i }) => {
            const probe = window.__wildshard, target = probe.world.arena.targets[i];
            return { weapon: probe.world.weapons.current.row.id, hits: probe.combat.hits.slice(n),
              floats: [...document.querySelectorAll('.ws-practice-float.hit')].map((node) => node.textContent),
              reaction: { rock: target.motion.rock.y, chest: target.motion.chest.x, velocity: target.motion.rock.vy },
              errors: probe.fingerprint().errors, sunDiscVisible: probe.world.game.sky.sunDisc.visible };
          }, { n: before, i: index });
          if (!proof.hits.some((hit) => hit.kind === 'training-dummy') || proof.floats.length === 0)
            throw new Error(`${weapon} ${setup.variant} ${heavy ? 'heavy' : 'light'} did not damage the dummy`);
          const filename = `${weapon}-${setup.variant}-${heavy ? 'heavy' : 'light'}.jpg`;
          await page.screenshot({ path: join(out, filename), type: 'jpeg', quality: 85, scale: 'css' });
          results.push({ shard, variant: setup.variant, heavy, filename, ...proof });
        }
      }
      const leak = await page.evaluate(() => window.__wildshard.leak());
      writeFileSync(join(out, `${weapon}-leak.json`), JSON.stringify(leak, null, 2));
      if (leak.after.geometries !== 0 || leak.disposalErrors.length > 0) throw new Error(`${weapon} unload leaked geometry or raised disposal errors`);
    } finally { await context.close(); }
  }
  writeFileSync(join(out, 'hits.json'), JSON.stringify({ sha, viewport: { width: 390, height: 844 }, results }, null, 2));
} finally { await pool.close(); preview.close(); tree.cleanup(); }
