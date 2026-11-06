// oxlint-disable-next-line import/no-nodejs-modules -- A resident runs the shipped product bytes and physics module.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { loadRapier } from '../src/engine/shared/physics/rapier';
import { leadPlayer } from '../src/engine/shared/sim/leadPlayer';
import { shardRows } from '../src/engine/shared/sim/shardRows';
import { outputDescriptor } from '../src/game/shared/shardfile/outputDescriptor';
import { BOSS_STRIKE, ELITE_TELL, ROAMING_VIEW } from '../src/game/shared/shardfile/wirePrompts';
import { loadHeadlessProduct } from '../src/sdk/headlessProduct';
import { createTrustedHeadlessResident, type TrustedHeadlessResident } from '../src/sdk/headlessRuntime';
import { ANTLER_KING_FIGHT } from '../src/shards/pine-hollow/generators/kingFight';
import { builtProduct } from './fixtures/builtProduct';

// A page on a server steps no fight, so what a fight tells its views has to be said. Real products on a real resident: what a page
// would paint or play, heard where a room hears it. Whether a page paints it is the row's browser proof, not this.
async function residentOn(slug: string): Promise<TrustedHeadlessResident> {
  const directory = builtProduct(slug), product = await loadHeadlessProduct(directory), descriptor = outputDescriptor(product.shardfile);
  if (descriptor === undefined) throw new Error('Missing output');
  const assets = new Map(descriptor.index.files.map(file => [file.commons === true ? `commons:${file.hash}` : file.hash, Uint8Array.from(readFileSync(`${directory}/${file.path}`))]));
  return createTrustedHeadlessResident({ product, shard: product.shardfile, assets, rapier: await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm'))) });
}
/** Step, taking what the host told its views as a room would. */
function hear(live: TrustedHeadlessResident, ticks: number, each?: () => void): Map<string, (readonly number[])[]> {
  const heard = new Map<string, (readonly number[])[]>();
  for (let tick = 0; tick < ticks; tick++) {
    each?.(); live.step([]);
    for (const { name, args } of shardRows(live.host).calls.splice(0)) { const row = heard.get(name) ?? []; row.push(args); heard.set(name, row); }
  }
  return heard;
}

test('the Roc says each strike, how far through it is and which way it faces', { timeout: 60_000 }, async () => {
  const live = await residentOn('far-reach');
  try {
    const { host } = live, lead = leadPlayer(host), body = host.entities.get('far.roc');
    if (body === undefined) throw new Error('Missing Roc');
    host.events.answer('damage.modify', request => request?.target === lead.health ? null : request, host.scope);
    lead.position.set(0, 44.3, -184); lead.motor.resetAt(lead.position);
    const heard = hear(live, 2400), strikes = [...heard].filter(([name]) => name.startsWith(BOSS_STRIKE));
    expect(strikes.length).toBeGreaterThan(0);
    for (const [, rows] of strikes) for (const row of rows) { expect(row).toHaveLength(4); expect(row.every(Number.isFinite)).toBe(true); }
    const through = strikes[0]?.[1].map(row => row[0] ?? 0) ?? [];
    expect(Math.max(...through), 'a strike runs on').toBeGreaterThan(Math.min(...through));
  } finally { live.dispose(); }
});

test('an elite says its tells and its cues', { timeout: 120_000 }, async () => {
  const live = await residentOn('pine-hollow');
  try {
    const { host } = live, lead = leadPlayer(host);
    host.events.answer('damage.modify', request => request?.target === lead.health ? null : request, host.scope);
    await host.dayClock?.set(0.9);
    const near = (): void => {
      const body = [...host.entities.values()].find(entry => ['ghost', 'imperial', 'ironhide'].includes(entry.variant) && entry.alive);
      if (body !== undefined) { lead.position.set(body.position.x + 3, body.position.y + 0.5, body.position.z); lead.motor.resetAt(lead.position); }
    };
    const heard = hear(live, 4000, near);
    expect(heard.get(ELITE_TELL.lane)?.length ?? heard.get(ELITE_TELL.ring)?.length ?? 0).toBeGreaterThan(0);
    const cues = heard.get(ELITE_TELL.cue) ?? [];
    expect(cues.length, 'a cue fired, and was said').toBeGreaterThan(0);
    for (const args of cues) { expect(args).toHaveLength(9); expect(args.every(Number.isFinite)).toBe(true); }
  } finally { live.dispose(); }
});

test('the Antler King says its room, its lanes and its tells', { timeout: 120_000 }, async () => {
  const live = await residentOn('pine-hollow');
  try {
    const { host } = live, lead = leadPlayer(host), { x, z } = ANTLER_KING_FIGHT.origin;
    host.events.answer('damage.modify', request => request?.target === lead.health ? null : request, host.scope);
    await host.dayClock?.set(0.9);
    const hold = (): void => { lead.position.set(x + 4, host.groundHeightAt(x + 4, z) + 0.1, z); lead.motor.resetAt(lead.position); };
    const heard = hear(live, 6000, hold), said = [...heard.keys()].filter(name => name.startsWith('roaming.'));
    expect(heard.get(ROAMING_VIEW.room)?.length ?? 0, 'the seal closes').toBeGreaterThan(0);
    expect(said).toEqual(expect.arrayContaining([ROAMING_VIEW.tell, ROAMING_VIEW.roar, ROAMING_VIEW.burst, ROAMING_VIEW.ring]));
    const rests = (heard.get(ROAMING_VIEW.ring) ?? []).filter(args => args[2] === 0).length;
    expect(rests, 'a ring at rest says so once').toBeLessThan(100);
    for (const args of heard.get(ROAMING_VIEW.lane) ?? []) { expect(args).toHaveLength(10); expect(args.every(Number.isFinite)).toBe(true); }
    const lit = (heard.get(ROAMING_VIEW.light) ?? []).filter(args => args[0] === 1);
    expect(lit.length, 'the fight says its light').toBeGreaterThan(0);
    for (const args of lit) { expect(args).toHaveLength(6); expect(args.every(Number.isFinite)).toBe(true); }
    expect(lit.some(args => (args[2] ?? 0) > 0), 'the light stands at the ribs').toBe(true);
  } finally { live.dispose(); }
});
