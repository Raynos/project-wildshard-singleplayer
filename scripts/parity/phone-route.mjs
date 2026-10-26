#!/usr/bin/env node
// Seventh exact-dist leg. The browser driver never supplies content, readiness, collision or pixels.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve as resolvePath, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { runFloorGridRoute, gridFloorDocumentIdentity, gridFloorWitnessFailures } from '../frame-floor-grid.mjs';
import { phoneRouteObservation, phoneBoardWall, watchPhoneEntry, installPhoneTitlePaint } from './phone-route-page.mjs';
import { openPhoneBrowser } from './phone-route-browser.mjs';
import { serve } from './serve.mjs';

/** @param {import('./phone-route.mjs').PhoneObservation} state */
export function phoneRoutePlans(state) {
  const home = state.cells.find(row => row.instance === state.home && row.slug === 'driftwood-isle');
  if (home === undefined) throw new Error('Phone route needs unambiguous Driftwood/Night Market cells and lattice');
  const markets = state.cells.filter(row => row.slug === 'open-plot-night-market' && row.cell[0] === home.cell[0] - 1 && row.cell[1] === home.cell[1] + 1);
  const market = markets[0];
  if (markets.length !== 1 || market === undefined || !Number.isFinite(state.pitch) || state.pitch <= 500) throw new Error('Phone route needs unambiguous Driftwood/Night Market cells and lattice');
  const origin = { x: home.cell[0] * state.pitch, z: home.cell[1] * state.pitch };
  const target = { x: market.cell[0] * state.pitch, z: market.cell[1] * state.pitch };
  if (market.cell[1] !== home.cell[1] + 1) throw new Error('Night Market route south road no longer matches its declared cell');
  // The cold spawn is on the south beach. Leave through its south socket,
  // then follow the west perimeter road instead of walking through town walls.
  const road = { x: origin.x, z: origin.z - state.pitch / 2 };
  const southwestRoad = { x: origin.x - state.pitch / 2, z: road.z };
  const northwestRoad = { x: southwestRoad.x, z: origin.z + state.pitch / 2 };
  const marketRoad = { x: target.x - 93.75, z: target.z - state.pitch / 2 };
  const wallStart = { x: target.x - 93.75, z: target.z - 218.75 };
  /** @type {import('../frame-floor-grid.mjs').FloorGridPlan[]} */
  const plans = [
    { name: 'phone-driftwood-road', from: home.instance, to: null, movement: 'road-hover', waypoints: [road], requiredResidents: [] },
    { name: 'phone-road-night-market', from: null, to: market.instance, movement: 'road-hover', waypoints: [southwestRoad, northwestRoad, marketRoad, wallStart], requiredResidents: [market.instance] },
    { name: 'phone-night-market-road', from: market.instance, to: null, movement: 'road-hover', waypoints: [marketRoad, northwestRoad, southwestRoad, road], requiredResidents: [] },
    { name: 'phone-road-driftwood-return', from: null, to: home.instance, movement: 'road-hover', waypoints: [{ x: origin.x, z: origin.z - 242.5 }], requiredResidents: [home.instance] },
  ];
  return { market: market.instance, plans };
}

/** Exact clocks and substantive gates are separate from report-only rollout policy.
 * @param {import('./phone-route.mjs').PhoneReceipt} receipt */
export function phoneRouteFailures(receipt) {
  const failures = [];
  const [prefix = ''] = receipt.version.build.split('-');
  if (receipt.protocol !== 'jake-phone-route/1' || !/^[a-f0-9]{40}$/u.test(receipt.sha) || !/^[a-f0-9]{7,40}$/u.test(prefix) || !receipt.sha.startsWith(prefix)) failures.push('Exact build SHA differs');
  if (receipt.paint.heroMs === null || !Number.isFinite(receipt.paint.heroMs) || receipt.paint.heroMs < 0 || receipt.paint.heroMs > 500) failures.push('Title hero first paint exceeds 500 ms or is unavailable');
  if (receipt.steps.join('|') !== 'title|SHARD SELECT|grid|Driftwood|road|Night Market|road return|Driftwood return') failures.push('Incomplete phone route');
  const entry = receipt.entry;
  if (entry === null || entry.cell?.slug !== 'open-plot-night-market' || entry.current !== entry.cell?.instance || entry.inside !== entry.cell?.instance || entry.ready !== true || entry.cell.drawn.far || !Number.isSafeInteger(entry.cell.drawn.l0) || !Number.isSafeInteger(entry.cell.drawn.l1) || entry.cell.drawn.l0 + entry.cell.drawn.l1 <= 0) failures.push('Night Market near tiles absent on first geometric entry');
  const wall = receipt.wall;
  if (wall === null || !Number.isFinite(wall.wallX) || wall.wallX - wall.from.x < 1 || wall.wallX - wall.from.x > 25 || wall.finalFrame - wall.startedFrame < 10 || !wall.hover || wall.samples.length < 10 || wall.samples.some(row => !row.hover || row.x >= wall.wallX - .1)) failures.push('Board did not remain blocked outside the real wall');
  if (wall !== null) {
    const tail = wall.samples.filter(row => row.ms >= wall.elapsedMs - 1000);
    if (wall.final.x - wall.from.x < 1 || tail.length < 2 || Math.max(...tail.map(row => row.x)) - Math.min(...tail.map(row => row.x)) > .15) failures.push('Board wall contact did not settle after actual forward movement');
  }
  if (receipt.fps.length !== 3 || receipt.fps.some(row => !Number.isFinite(row.elapsedMs) || !Number.isSafeInteger(row.frames) || row.elapsedMs < 9500 || row.frames <= 0 || Math.round(row.frames * 1000 / row.elapsedMs) < 30 || !Number.isFinite(row.pillFps) || row.pillFps <= 0 || !Number.isFinite(row.worstMs) || row.worstMs <= 0)) failures.push('G718 completed draws per wall-clock second below 30 fps or pill unavailable');
  if (receipt.observations.length < 5 || receipt.observations.some(row => !row.frameAvailable || row.grain !== 0 || row.contextLost || row.fatal.length > 0)) failures.push('Full-screen grain, lost context or fatal route state');
  if (receipt.frames.length < 6 || receipt.frames.some(row => row.darkShare >= .9 || row.width <= 0 || row.height <= row.width)) failures.push('Missing/black route capture');
  if (receipt.faults.length > 0) failures.push(...receipt.faults);
  return failures;
}

/** @param {import('./phone-route.mjs').PhonePage} page @param {string} expression @param {string} label @param {number} deadline */
async function until(page, expression, label, deadline) {
  while (Date.now() < deadline) {
    if (await page.evaluate(expression)) return;
    if (page.faults.length > 0) throw new Error(page.faults.join('\n'));
    await new Promise(resolve => { setTimeout(resolve, 100); });
  }
  throw new Error(`Phone route deadline: ${label}`);
}

/** @param {import('./phone-route.mjs').PhonePage} page @param {string} out @param {string} label */
async function capture(page, out, label) {
  const bytes = await page.screenshot(join(out, `${label.replaceAll(' ', '-')}.png`));
  const metadata = await sharp(bytes).metadata();
  const { data } = await sharp(bytes).resize({ width: 192 }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let dark = 0, pixels = 0;
  for (let at = 0; at < data.length; at += 16) { pixels++; if (Math.max(data[at] ?? 0, data[at + 1] ?? 0, data[at + 2] ?? 0) < 16) dark++; }
  return { label, width: metadata.width ?? 0, height: metadata.height ?? 0, darkShare: dark / pixels };
}

/** @param {import('./phone-route.mjs').PhonePage} page @param {string} label */
async function fpsWindow(page, label) {
  // G718's own completed draw clock; a freeze contributes its full wall time.
  return /** @type {import('./phone-route.mjs').PhoneFps} */ (await page.evaluate(`(async()=>{
    const game=window.__wildshard.requireWorld().game, start=performance.now(), first=game.frameCount;
    let previous=start,worst=0; const stop=game.watchFrames(()=>{const now=performance.now();worst=Math.max(worst,now-previous);previous=now;});
    try{await new Promise(resolve=>setTimeout(resolve,10000));return {label:${JSON.stringify(label)},elapsedMs:performance.now()-start,frames:game.frameCount-first,worstMs:Math.max(worst,performance.now()-previous),pillFps:Number(document.querySelector('.ws-perf > b')?.textContent),pill:document.querySelector('.ws-perf')?.textContent??null};}finally{stop();}
  })()`));
}

/** @param {import('./phone-route.mjs').PhonePage} page @param {string} base @param {string} sha @param {string} out */
export async function phoneRoute(page, base, sha, out) {
  const versionResponse = await fetch(new URL('/version.json', base));
  const version = /** @type {{build:string}} */ (await versionResponse.json());
  /** @type {import('./phone-route.mjs').PhoneReceipt} */
  const receipt = { protocol: 'jake-phone-route/1', rollout: process.env.PHONE_ROUTE_MODE ?? 'local-driver', sha, version, engine: page.engine, steps: [], paint: { heroMs: null, fcpMs: null, heroURL: null }, entry: null, wall: null, fps: [], observations: [], frames: [], faults: page.faults, routes: [], failures: [] };
  const observe = async () => {
    const state = /** @type {import('./phone-route.mjs').PhoneObservation|null} */ (await page.evaluate(`(${phoneRouteObservation.toString()})()`));
    if (state === null) throw new Error('Phone route lost the game');
    receipt.observations.push(state); return state;
  };
  const shot = async (/** @type {string} */ label) => {
    receipt.frames.push(await capture(page, out, label));
    writeFileSync(join(out, 'phone-route.json'), `${JSON.stringify(receipt, null, 2)}\n`);
    console.log(`phone-route stage ${label}`);
  };
  try {
    const url = new URL(base);
    for (const [key, value] of Object.entries({ tier: 'phone', touch: '1', mute: '1', nolock: '1', sw: '0' })) url.searchParams.set(key, value);
    await page.cold(url.href, `(${installPhoneTitlePaint.toString()})()`);
    await until(page, `document.querySelector('.ws-main-select')!==null && (()=>{const load=document.querySelector('.ws-load');return load===null||getComputedStyle(load).display==='none'||getComputedStyle(load).visibility==='hidden'||getComputedStyle(load).opacity==='0';})()`, 'title', Date.now() + 150000);
    receipt.paint = /** @type {typeof receipt.paint} */ (await page.evaluate('window.__phoneRoutePaint'));
    receipt.steps.push('title'); await shot('title');
    await page.click('.ws-main-select');
    await until(page, `document.querySelector('.ws-menu:not(.hide)')!==null`, 'SHARD SELECT', Date.now() + 150000);
    receipt.steps.push('SHARD SELECT'); await shot('SHARD SELECT'); await page.click('.ws-menu-back');
    await page.click('.ws-main-grid');
    await until(page, `(()=>{const p=window.__wildshard;if(!p?.world)return false;const g=p.shard.grid?.state?.();const reveal=document.querySelector('.ws-grid-reveal');if(reveal)reveal.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));return g?.live?.live?.gameplayReady===true&&g.inside===g.home&&p.requireWorld().game.frameGate();})()`, 'grid Driftwood entry', Date.now() + 150000);
    receipt.steps.push('grid', 'Driftwood'); await observe(); await shot('Driftwood'); receipt.fps.push(await fpsWindow(page, 'Driftwood'));
    const initial = await observe(), { market, plans } = phoneRoutePlans(initial);
    const identity = /** @type {import('../frame-floor-grid.mjs').FloorGridDocumentIdentity} */ (await page.evaluate(`(${gridFloorDocumentIdentity.toString()})()`));
    await page.evaluate(`(${watchPhoneEntry.toString()})(${JSON.stringify(market)})`);
    for (const [index, plan] of plans.entries()) {
      // No plan has a start/pose: every crossing and the return uses held input.
      const witness = await runFloorGridRoute(page, plan, identity);
      receipt.routes.push(witness);
      const failures = gridFloorWitnessFailures(witness);
      if (failures.length > 0) throw new Error(failures.join('; '));
      receipt.steps.push(['road', 'Night Market', 'road return', 'Driftwood return'][index] ?? 'invalid');
      await observe(); await shot(plan.name);
      if (index === 0) receipt.fps.push(await fpsWindow(page, 'road'));
      if (index === 1) {
        receipt.entry = /** @type {import('./phone-route.mjs').PhoneReceipt['entry']} */ (await page.evaluate('window.__phoneRouteEntry?.entry??null'));
        receipt.fps.push(await fpsWindow(page, 'Night Market'));
        await page.click('.ws-touch-hover');
        await until(page, 'window.__wildshard.requireWorld().player.hover===true', 'actual touch HOVER', Date.now()+5000);
        receipt.wall = /** @type {import('./phone-route.mjs').PhoneWall} */ (await page.evaluate(`(${phoneBoardWall.toString()})(4000)`));
        await shot('board-wall');
      }
    }
    receipt.failures = phoneRouteFailures(receipt);
  } catch (error) {
    receipt.failures.push(String(error));
    await page.screenshot(join(out, 'phone-route-failure.jpg')).catch(() => undefined);
  } finally { writeFileSync(join(out, 'phone-route.json'), `${JSON.stringify(receipt, null, 2)}\n`); }
  if (receipt.failures.length > 0) throw new Error(receipt.failures.join('\n'));
  return receipt;
}

async function main() {
  const option = (/** @type {string} */ key) => process.argv.find(arg => arg.startsWith(`--${key}=`))?.slice(key.length + 3);
  const out = resolvePath(option('out') ?? 'boot-smoke-results/phone-route'); mkdirSync(out, { recursive: true });
  const sha = option('sha') ?? process.env.TESTED_SHA;
  if (sha === undefined || !/^[a-f0-9]{40}$/u.test(sha)) throw new Error('Phone route requires exact --sha');
  const external = option('url'), preview = external === undefined ? await serve(resolvePath('.'), '', true) : null;
  const base = external ?? preview?.url;
  if (base === undefined) throw new Error('Missing phone route preview');
  const page = await openPhoneBrowser(option('engine') ?? 'webkit', base, out);
  try { await phoneRoute(page, base, sha, out); } finally { try { await page.close(); } finally { preview?.close(); } }
}
if (process.argv[1] && pathToFileURL(resolvePath(process.argv[1])).href === import.meta.url) await main();
