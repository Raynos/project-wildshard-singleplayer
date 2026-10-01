// Screenshot-only B placement; A is the shipped E319 ring plus reserved discs above JUMP.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { installInit } from '../../../scripts/parity/init.mjs';

const [url, output] = process.argv.slice(2);
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--mute-audio'] });
try {
  for (const shard of ['pine-hollow', 'nalati-grasslands']) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
    await installInit(context, { lane: 'm5', sha: 'df398947', browser: browser.version(), capture: 30, tier: 'phone' });
    const page = await context.newPage();
    page.setDefaultTimeout(120000);
    await page.goto(url + '/?chunk=' + shard + '&tier=phone&touch=1&skipintro=1&nolock=1&mute=1&sw=0');
    await page.waitForFunction(() => window.__wildshard && !document.querySelector('.ws-load'));
    await page.evaluate(() => window.__parity.advance(30));
    if (shard === 'pine-hollow') {
      await page.evaluate(() => window.__wildshard.combat.equip('crossbow'));
      await page.evaluate(() => window.__parity.advance(30));
    } else {
      await page.evaluate(async () => {
        const w = window.__wildshard, ride = w.world.game.app.debug.snapshot()['nalati.ride'];
        const herd = ride.taming.opts.herds().find((entry) => entry.stallion !== null);
        if (!herd) throw new Error('No herd for the OFFER board');
        const horse = herd.stallion;
        horse.harnessHold = true;
        await w.pose({ x: horse.position.x, z: horse.position.z + 8, y: horse.position.y, yaw: 0 });
        herd.alert = 0;
        const bonded = ride.mount.mountables[0];
        if (bonded) bonded.a.mem.whistle = 1;
        await window.__parity.advance(60);
        herd.alert = 0;
        ride.hud.update(ride.taming.view);
        w.world.game.app.input.repaint();
      });
    }
    writeFileSync(output + '/' + shard + '-verbs.json', JSON.stringify(await page.evaluate(() => ({ offer: window.__wildshard.world.game.app.debug.snapshot()['nalati.ride']?.taming.view, buttons: [...document.querySelectorAll('.ws-touch-verb')].map((b) => ({ label:b.textContent, cls:b.className, display:getComputedStyle(b).display, rect:b.getBoundingClientRect().toJSON() })) })),null,2));
    await page.screenshot({ path: output + '/' + shard + '-verbs-a.jpg', type: 'jpeg', quality: 88 });
    const style = await page.addStyleTag({ content: '/* board B */' });
    // B stacks the same reserved verbs one row higher. The HORSE/HOVER/SWAP ring is unchanged.
    await style.evaluate((node) => { node.textContent = '.ws-touch-disc.ws-touch-verb:not(.at-edge-l){bottom:calc(var(--row) + 2 * var(--rslot));}.ws-touch-disc.verb-one:not(.at-edge-l){left:calc(var(--r0) - var(--rslot));}.ws-touch-disc.verb-two:not(.at-edge-l){left:calc(var(--r0) - 2 * var(--rslot));}'; });
    await page.screenshot({ path: output + '/' + shard + '-verbs-b.jpg', type: 'jpeg', quality: 88 });
    await context.close();
  }
} finally { await browser.close(); }
