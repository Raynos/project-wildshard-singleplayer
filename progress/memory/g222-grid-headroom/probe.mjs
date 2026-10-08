import { chromium, devices } from 'playwright';
import { writeFileSync } from 'node:fs';
import { saveFixture } from '../../../scripts/debug-settings.mjs';
import { GL_INIT } from '../../../scripts/parity/glbytes.mjs';
const [base, out, mode = 'both'] = process.argv.slice(2);
const version = await (await fetch(new URL('version.json', base))).json();
const report = { version, grid: { snapshots: [], errors: [], console: [] }, warning: {} };
const save = () => writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
 if (mode !== 'warning') {
 const context = await browser.newContext({ ...devices['iPhone 16 Pro'], serviceWorkers: 'block' });
 await saveFixture(context, { scope: 'global', key: 'settings', data: { tier: 'phone', fps: 'auto' }, merge: true });
 await saveFixture(context, { scope: 'global', key: 'gfx', data: { dpr: '2', aa: 'auto' } });
 await saveFixture(context, { scope: 'device', key: 'devMode', data: true });
 await context.addInitScript(GL_INIT);
 const page = await context.newPage();
 page.on('pageerror', error => { report.grid.errors.push(error.message); });
 page.on('console', message => { if (['warn', 'error'].includes(message.type())) report.grid.console.push(message.text().slice(0, 2000)); });
 try {
  await page.goto(`${base}?mute=1&nolock=1&sw=0`, { waitUntil: 'commit', timeout: 180000 }); console.log('GRID navigation');
  await page.locator('.ws-main-grid').waitFor({ timeout: 120000 });
  report.grid.developer = await page.evaluate(() => document.documentElement.hasAttribute('data-dev'));
  if (!report.grid.developer) throw new Error('Developer fixture was not applied'); await page.locator('.ws-main-grid').click();
  await page.waitForFunction(() => Boolean(document.querySelector('#wserr .msg')?.textContent) || (!document.querySelector('.ws-load') && Boolean(window.__wildshard?.shard?.grid?.state().live?.live)), null, { timeout: 240000 });
  const failure = await page.evaluate(() => document.querySelector('#wserr .msg')?.textContent); if (failure) throw new Error(failure);
  await page.evaluate(() => window.__wildshard.world.hud.enterNow());
  await page.waitForFunction(() => window.__wsReveal?.endedMs != null, null, { timeout: 45000 });
  const snapshot = async label => {
   const value = await page.evaluate(() => ({ state: window.__wildshard.shard.grid.state(), residency: window.__wildshard.shard.grid.residency(), road: window.__wildshard.shard.grid.roadResident(), gl: window.__sc_gl(), bar: document.querySelector('.ws-grid-budget')?.textContent }));
   report.grid.snapshots.push({ label, ...value }); save(); console.log(label, value.state.playingMB, 'MB');
  };
  await page.waitForTimeout(15000); await snapshot('home-settled');
  // Diagnostic ledger poses, not a crossing or physics verdict: native input/frame drivers still perform every step.
  await page.evaluate(() => { const w = window.__wildshard.world; w.player.spawn(-277.5, -277.5, 0); w.player.setHover(true); });
  await page.waitForTimeout(15000); await snapshot('southwest-crossroads');
  await page.locator('.ws-grid-budget').click();
  await page.screenshot({ path: out + '.crossroads.jpg', type: 'jpeg', quality: 65 });
  report.grid.contrast = await page.evaluate(() => {
   const root = document.querySelector('.ws-grid-budget'), red = root?.querySelector('[data-tone="red"]');
   const style = root && getComputedStyle(root); return { background: style?.backgroundColor, text: style?.color, red: red ? getComputedStyle(red).color : null };
  });
 } catch (error) { report.grid.bootError = await page.locator('.ws-load-error').textContent().catch(() => null); report.grid.failure = String(error); console.log('GRID FAIL', report.grid.failure); await page.screenshot({ path: out + '.grid-failed.jpg', type: 'jpeg', quality: 65 }).catch(() => {}); }
 finally { await context.close(); save(); }
 }
 if (mode !== 'grid') {
 const pine = await browser.newContext({ ...devices['iPhone 16 Pro'], serviceWorkers: 'block' });
 await saveFixture(pine, { scope: 'global', key: 'settings', data: { tier: 'phone', fps: 'auto' }, merge: true });
 await saveFixture(pine, { scope: 'global', key: 'gfx', data: { dpr: '2', aa: 'auto' } });
 await saveFixture(pine, { scope: 'device', key: 'devMode', data: true });
 const pp = await pine.newPage(); const errors = []; report.warning.errors = errors; pp.on('pageerror', error => { errors.push(error.message); });
 try {
  await pp.goto(`${base}?chunk=pine-hollow&touch=1&tier=phone&mute=1&sw=0&nolock=1`, { waitUntil: 'commit', timeout: 180000 }); console.log('PINE navigation');
  await pp.waitForFunction(() => Boolean(window.__wildshard?.world?.hud) && !document.querySelector('.ws-load'), null, { timeout: 180000 });
  report.warning.developer = await pp.evaluate(() => document.documentElement.hasAttribute('data-dev'));
  if (!report.warning.developer) throw new Error('Developer fixture was not applied');
  const bootError = await pp.locator('.ws-load-error').textContent().catch(() => null);
  if (bootError) throw new Error(bootError);
  await pp.evaluate(() => window.__wildshard.world.hud.enterNow());
  await pp.locator('.ws-memory-warning-chip').waitFor({ timeout: 30000 }); await pp.waitForTimeout(4000);
  const warningState = () => pp.evaluate(() => {
   const root = document.querySelector('.ws-memory-warning'), chip = root?.querySelector('button'), details = root?.querySelector('.ws-memory-warning-details');
   const b = chip?.getBoundingClientRect(), r = root?.getBoundingClientRect();
   const x = Math.max(0, (r?.left ?? 0) - 5), y = (r?.top ?? 0) + 40;
   return { text: chip?.textContent, expanded: chip?.getAttribute('aria-expanded'), hidden: details?.hidden, rootPointers: root && getComputedStyle(root).pointerEvents, chipPointers: chip && getComputedStyle(chip).pointerEvents, detailsPointers: details && getComputedStyle(details).pointerEvents, chipRect: b?.toJSON(), rootRect: r?.toJSON(), outsideHit: document.elementFromPoint(x, y)?.className, reports: [...(details?.querySelectorAll('[data-owner]') ?? [])].map(row => ({ owner: row.dataset.owner, claimed: row.dataset.claimedBytes, text: row.textContent })) };
  });
  report.warning.collapsed = await warningState(); await pp.screenshot({ path: out + '.warning-collapsed.jpg', type: 'jpeg', quality: 65 });
  await pp.locator('.ws-memory-warning-chip').click(); report.warning.expanded = await warningState(); await pp.screenshot({ path: out + '.warning-expanded.jpg', type: 'jpeg', quality: 65 });
  await pp.locator('.ws-memory-warning-chip').click(); report.warning.recollapsed = await warningState();
  report.warning.pass = report.warning.collapsed.hidden === true && report.warning.collapsed.chipRect.height < 32 && report.warning.collapsed.rootPointers === 'none' && report.warning.collapsed.chipPointers === 'auto' && report.warning.expanded.hidden === false && report.warning.recollapsed.hidden === true && errors.length === 0;
  console.log('WARNING', report.warning.pass, report.warning.collapsed.chipRect);
 } catch (error) { report.warning.failure = String(error); console.log('WARNING FAIL', report.warning.failure); }
 finally { await pine.close(); save(); }
 }
} finally { await browser.close(); save(); }
console.log('CLOSED');
