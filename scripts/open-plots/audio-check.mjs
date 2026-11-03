#!/usr/bin/env node
// Run under scripts/browser-lane.sh. Checks playback; never reports performance.
import { readFileSync, existsSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { chromium, devices } from 'playwright';
import { developerSettings, saveFixture, harnessPins } from '../debug-settings.mjs';
import { observeAudioGraph, audioSnapshot } from './audio-observer.mjs';

const { values } = parseArgs({ options: Object.fromEntries(['base', 'pin', 'plot'].map(key => [key, { type: 'string' }])) });
if (!values.base || !/^[a-f0-9]{40}$/u.test(values.pin ?? '') || !/^[a-z]+(?:-[a-z]+)*$/u.test(values.plot ?? '')) throw new Error('Requires --base, full --pin and --plot');
const anchors = JSON.parse(readFileSync('src/shards/open-plots/data/audioAnchors.json', 'utf8'))[values.plot];
if (!Array.isArray(anchors) || anchors.length < 4 || anchors.length > 8) throw new Error('Requires four to eight real plot anchors');
const version = await (await fetch(new URL('/version.json', values.base))).json();
if (!version.build?.startsWith(values.pin.slice(0, 7))) throw new Error('Served source differs');
if (existsSync('.git/quiet')) throw new Error('Official Simulator quiet is active');
const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'], viewport: { width: 402, height: 874 } });
  await developerSettings(context, { tier: 'phone', volume: 0 });
  await saveFixture(context, { scope: 'global', key: 'gfx', data: { dpr: '2', aa: 'auto' } });
  await harnessPins(context, { seed: 357, browser: 'Chromium / iPhone 16 Pro', lane: 'ob7-audio', sha: values.pin });
  await context.addInitScript(observeAudioGraph);
  const page = await context.newPage();
  const url = new URL('/', values.base);
  for (const [key, value] of Object.entries({ chunk: `open-plot-${values.plot}`, tier: 'phone', skipintro: '1', nolock: '1', sw: '0', mute: '1' })) url.searchParams.set(key, value);
  await page.goto(url.href, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__wildshard?.world?.hud?.entered && !document.querySelector('.ws-load'), undefined, { timeout: 240000 });
  await page.click('body');
  await page.evaluate(() => { window.__wildshard.requireWorld().hud.setPaused(true); });
  await page.locator('.ws-gmenu-close').click();
  await page.waitForFunction(() => {
    const music = window.__wildshard.requireWorld().music;
    return music.stems.source === 'stems' && music.stems.slot === 'score';
  }, undefined, { timeout: 120000 });
  const initial = await page.evaluate(audioSnapshot);
  if (initial.scoreId !== values.plot || !initial.ready || !initial.muted || initial.renderScale !== 2 || initial.tier !== 'phone'
    || initial.mode !== 'live' || initial.viewport.join(',') !== '402,874' || initial.bank.length !== anchors.length + 1 || !initial.loops.some(row => row.id === 'score')) throw new Error(`Native phone playback profile refused: ${JSON.stringify(initial)}`);
  const spots = [];
  for (const anchor of anchors) {
    const id = `hum.${values.plot}.${anchor.id}`, reads = [];
    for (const yaw of [0, Math.PI]) {
      await page.evaluate(({ x, z, heading }) => { window.__wildshard.requireWorld().player.spawn(x + 4, z, heading); }, { ...anchor, heading: yaw });
      await page.waitForTimeout(1200);
      const state = await page.evaluate(audioSnapshot), loop = state.loops.find(row => row.id === id);
      if (!loop || loop.context !== 'running' || !(loop.gains[0] > .25) || !Number.isFinite(loop.pans[0])) throw new Error(`${id} did not play at its native anchor: ${JSON.stringify(state)}`);
      reads.push({ gain: loop.gains[0], pan: loop.pans[0] });
      if (state.errors.length > 0) throw new Error(state.errors.join('\n'));
    }
    if (!(reads[0].pan < -.4 && reads[1].pan > .4)) throw new Error(`${id} did not pan with heading`);
    spots.push({ id, reads });
  }
  const final = await page.evaluate(audioSnapshot);
  if (!final.loops.some(row => row.id === `bed.${values.plot}.ambience` && row.gains[0] > .4)) throw new Error('Ambience bed did not remain active');
  if (!final.loops.some(row => row.id === 'score' && row.context === 'running' && row.gains[0] > .1)
    || final.stems.source !== 'stems' || final.stems.slot !== 'score') throw new Error('Owned score did not remain active');
  console.info(JSON.stringify({ pin: values.pin, plot: values.plot, verdict: 'PASS', device: 'iPhone 16 Pro', renderScale: 2,
    score: { id: final.scoreId, slot: final.stems.slot, source: final.stems.source }, bank: final.bank, spots, errors: final.errors }));
} finally { await browser.close(); }
