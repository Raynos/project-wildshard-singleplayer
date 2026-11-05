import {admissionNative} from './fixtures/nalati-return-modules';


// oxlint-disable-next-line import/no-nodejs-modules -- Native host fixture uses the shipped physics binary.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { zlibSync } from 'fflate';
import { createSimHost } from '../src/engine/sim';
import { loadRapier } from '../src/engine/physics/rapier';
import { NativePopulationField } from '../src/game/population/environment';
import { NativeWildEnvironment } from '../src/game/population/nativeManager';
import { nativeWeatherBundle } from '../src/game/weather/reactions';
import { installWeatherContinuation } from '../src/game/weather/continuation';
import nalati from '../src/shards/nalati-grasslands/data/weather.json' with { type: 'json' };
import { weatherWitness } from './fixtures/weatherInlineWitness';
import { SIM_LEVEL } from './fixtures/sim-level/level';

const raster = (values: readonly number[], file: string) => ({ row: { type: 'f32', count: values.length, data: { file } }, block: { file, bytes: zlibSync(new Uint8Array(Float32Array.from(values).buffer)) } });
const wet = raster([0, 0, 0, 0], 'test/storm-wet.bin'), pond = raster([0, 0, 0, 0], 'test/storm-pond.bin');
const grid = { res: 2, size: 64, seed: 9, landscapeHash: 0, heights: new Float32Array(4), splat: Uint8Array.from([255, 0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0]), undergrowth: null };
const fieldRows = { seed: 9, world: { res: 2, size: 64, water: -10, wet: wet.row, pond: pond.row },
  trails: [], river: { from: -32, step: 64, values: [[8, 1], [8, 1]] }, meadow: { short: [], tall: [], bare: [], valley: .5, plateau: .6 } };
const worldRows = { step: 'storm.weather', scareRadius: 20, windReference: 8, light: { base: .2, storm: .4, ramps: [[-10, 10, .6]] },
  hit: { ask: 'weather.damage', tags: ['env.storm'], cause: { kind: 'storm', label: 'Lightning', text: 'Lightning' }, toast: 'Lightning' } };

/** A two-player room under Nalati's real storm rows and guest, one shelter over (20, 20). */
async function stormRoom() {
  const rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
  const host = createSimHost({ ...SIM_LEVEL, entities: [], quests: [] }, { rapier });
  const field = new NativePopulationField(grid, fieldRows, [[3, 4, 1]], [12], pond.block, wet.block);
  const env = new NativeWildEnvironment(field.grass.field, field.grass.trample, { wind: { x: 1, z: 0, strength: .5 }, flatten: .5 }, admissionNative(host));
  const { storm } = installWeatherContinuation(host, { program: nativeWeatherBundle({ weather: nalati, reactions: weatherWitness }, [[20, 20, 4]]),
    clock: { sunElevation: 0 }, env, scare: () => undefined, bake: { trees: [[3, 4, 1]], tops: [12] }, rows: worldRows });
  const lead = host.players.values().next().value; if (lead === undefined) throw new Error('Missing lead');
  const bot = host.addPlayer('bot.1', { x: 20, y: lead.position.y, z: -20 });
  /** Land the armed bolt at `at` on the next decision tick, and step until it has. */
  const bolt = (at: { readonly x: number; readonly y: number; readonly z: number }): void => {
    Object.assign(storm.weather.registers, { sx: at.x, sy: at.y, sz: at.z, skind: 3, armed: 1, pendingT: .001, land: 0, ready: 0 });
    for (let tick = 0; tick < 7; tick++) host.step();
  };
  return { host, storm, lead, bot, bolt };
}

test('one bolt hurts each player it lands on, not the lead by name', async () => {
  const { host, storm, lead, bot, bolt } = await stormRoom();
  try {
    const strikes: number[] = []; storm.on('strike', event => { strikes.push(event['x'] ?? 0); });
    const [leadFull, botFull] = [lead.health.attributes.health, bot.health.attributes.health];
    bolt(bot.position);
    expect(strikes).toEqual([bot.position.x]);
    expect(bot.health.attributes.health).toBe(botFull - 60);
    expect(lead.health.attributes.health).toBe(leadFull);
    bolt(lead.position);
    expect(lead.health.attributes.health).toBe(leadFull - 60);
    expect(bot.health.attributes.health).toBe(botFull - 60);
    expect(strikes).toHaveLength(2);
  } finally { host.dispose(); }
});

test('each player has their own shelter and a bolt close by but overhead misses', async () => {
  const { host, lead, bot, bolt } = await stormRoom();
  try {
    bot.position.set(20, lead.position.y, 20); const full = bot.health.attributes.health;
    bolt({ x: 20, y: lead.position.y, z: 20 });
    expect(bot.health.attributes.health).toBe(full);
    bot.position.set(-20, lead.position.y, 20);
    bolt({ x: -20, y: lead.position.y + 7, z: 20 });
    expect(bot.health.attributes.health).toBe(full);
  } finally { host.dispose(); }
});

test('the storm turns to each player in join order and saves whose turn it is', async () => {
  const { host, storm, lead, bot, bolt } = await stormRoom();
  try {
    const adapter = host.adapters.get('storm.weather'); if (adapter === undefined) throw new Error('Missing storm adapter');
    expect(adapter.snapshot()).not.toHaveProperty('focus');
    const cells: number[] = [];
    const px = (): void => { cells.push(storm.inputs['px'] ?? Number.NaN); };
    bolt({ x: 50, y: 0, z: 50 }); px();
    expect(cells).toEqual([bot.position.x]);
    const saved = adapter.snapshot();
    expect(saved).toHaveProperty('focus', bot.id);
    bolt({ x: 50, y: 0, z: 50 }); px();
    expect(cells).toEqual([bot.position.x, lead.position.x]);
    adapter.restore(saved); host.step(); px();
    expect(cells[2]).toBe(bot.position.x);
    expect(adapter.snapshot()).toHaveProperty('focus', bot.id);
    host.removePlayer(bot.id); host.step(); px();
    expect(cells[3]).toBe(lead.position.x);
  } finally { host.dispose(); }
});
