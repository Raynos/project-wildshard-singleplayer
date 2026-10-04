// oxlint-disable-next-line import/no-nodejs-modules -- The factory fixture shares the shipped physics binary.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { compileScript } from '../scripts/compile-script.mjs';
import { scriptSource } from './script/fixture';
import { emptyShardfile } from '../src/sdk/author';
import { contentHash } from '../src/sdk/project';
import { createShardfileSim, numericScriptEntityId } from '../src/game/shardfile/simulation';
import { loadRapier } from '../src/engine/physics/rapier';

it('samples one tick-admitted command map in the existing authoritative factory lane, with zero commands when omitted', async () => {
  const bytes = await compileScript(scriptSource('store<f64>(24576,5); store<f64>(24584,101); store<f64>(24592,load<f64>(16400));', '', '1'));
  const hash = contentHash(bytes), source = emptyShardfile({ slug: 'command-test', name: 'Test', author: 'Test', revision: 1, seed: 435 });
  source.state.shared = [{ id: 101, name: 'command.value', type: 'f64', privacy: 'public', default: 0, min: -100, max: 100 }];
  source.sim.scripts = [hash]; source.sim.scriptTickDivisor = 1;
  source.sim.bindings = [{ module: hash, entity: numericScriptEntityId('actor.player'), actorId: 'actor.player', kind: 'server' }];
  const rapier = await loadRapier(new Uint8Array(readFileSync('public/assets/physics/rapier.wasm'))), assets = new Map([[hash, bytes]]);
  let samples = 0, command = 7;
  const sim = createShardfileSim(source, assets, { rapier, commands: () => { samples++; return new Map([['actor.player', command]]); } });
  const omitted = createShardfileSim(source, assets, { rapier });
  try {
    sim.host.step(); expect(sim.lane?.world.view('actor.player').shared['command.value']).toBe(7); expect(samples).toBe(1);
    command = -3; sim.host.step(); expect(sim.lane?.world.view('actor.player').shared['command.value']).toBe(-3); expect(samples).toBe(2);
    omitted.host.step(); expect(omitted.lane?.world.view('actor.player').shared['command.value']).toBe(0);
  } finally { sim.dispose(); omitted.dispose(); }
});
