// A quest's declared spawns on the server: what `installDeclaredQuestSpawns` ran on a page and the flip deletes. Pine's millrace wakes, ends
// on its last thrall, and raises its flag in the player's book, once. What a page showed of it (a toast, a sting, a thrall's cues) has no
// owner yet: see the flip's coverage table.
// oxlint-disable-next-line import/no-nodejs-modules -- A world runs the shipped product bytes and physics module.
import { readFileSync } from 'node:fs';
import { Vector3 } from 'three';
import { expect, test } from 'vitest';
import { loadRapier } from '../src/engine/shared/physics/rapier';
import { questBooks } from '../src/engine/shared/quest/players';
import { leadPlayer } from '../src/engine/shared/sim/leadPlayer';
import { outputDescriptor } from '../src/game/shared/shardfile/outputDescriptor';
import { loadHeadlessProduct } from '../src/sdk/headlessProduct';
import { createTrustedHeadlessResident } from '../src/sdk/headlessRuntime';
import { builtProduct } from './fixtures/builtProduct';

const RACE = { x: -181, z: -144 };

test('the millrace runs on the server: its thralls wake, its last fall raises the flag in the book, once, and a done errand never races again', { timeout: 120_000 }, async () => {
  const directory = builtProduct('pine-hollow'), product = await loadHeadlessProduct(directory), descriptor = outputDescriptor(product.shardfile);
  if (descriptor === undefined) throw new Error('Missing output');
  const assets = new Map(descriptor.index.files.map(file => [file.commons === true ? `commons:${file.hash}` : file.hash, Uint8Array.from(readFileSync(`${directory}/${file.path}`))]));
  const live = await createTrustedHeadlessResident({ product, shard: product.shardfile, assets, rapier: await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm'))) }, undefined, { room: true });
  try {
    const { host } = live, lead = leadPlayer(host), { flags } = questBooks(host).of(lead.id), raised: string[] = [];
    flags.onChange((flag, on) => { if (flag === 'errand:done') raised.push(String(on)); });
    host.events.answer('damage.modify', request => request?.target === lead.health ? null : request, host.scope);
    await host.dayClock?.set(0.9);
    const stand = (): void => { lead.resetPose({ x: RACE.x, y: host.groundHeightAt(RACE.x, RACE.z) + 0.2, z: RACE.z }, 0); };
    const thralls = () => [...host.entities.values()].filter(body => body.variant === 'thrall' && body.alive && Math.hypot(body.position.x - RACE.x, body.position.z - RACE.z) < 40);
    flags.set('errand:asked');
    for (let tick = 0; tick < 600 && thralls().length < 3; tick++) { stand(); live.step([]); }
    expect(thralls().length, 'the race woke').toBeGreaterThanOrEqual(3);
    expect(flags.has('errand:done')).toBe(false);
    for (let tick = 0; tick < 1800 && !flags.has('errand:done'); tick++) {
      stand();
      for (const body of thralls()) host.combat.hit({ source: lead.health, sourceTags: ['actor.player'], target: body.combatActor(), amount: 9000, point: body.position.clone(), dir: new Vector3(0, 0, 1), throughWalls: true });
      live.step([]);
    }
    expect(flags.has('errand:done')).toBe(true);
    for (let tick = 0; tick < 300; tick++) { stand(); live.step([]); }
    expect(raised, 'it ends once').toEqual(['true']);
    expect(thralls(), 'a done errand never races again').toEqual([]);
  } finally { live.dispose(); }
});
