// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the same immutable physics binary as the shipped client.
import { readFile } from 'node:fs/promises';
import * as v from 'valibot';
import { beforeAll, expect, it } from 'vitest';
import { loadRapier } from '../src/engine/physics/rapier';
import { CharacterMotor } from '../src/engine/physics/CharacterMotor';
import { snapshotSimHost } from '../src/engine/sim/snapshot';
import { emptyShardfile } from '../src/sdk/author';
import { HeadlessSimulation } from '../src/sdk/headless';
import { parseShardfile } from '../src/game/shardfile/schema';
import { PropsSchema } from '../src/game/shardfile/props';
import { parsePortalLink, portalLinkEntries } from '../src/game/shardfile/portalLink';
import { validatePortalFloors } from '../src/game/shardfile/portalFloor';
import { createPortalTraversal, portalTransitioning } from '../src/game/shardfile/portalTraversal';
import { createShardfileSim } from '../src/game/shardfile/simulation';
import { proveShardfileEntries } from '../src/game/shardfile/socketLiftProof';
import { captureClientState, checkpointClientState } from '../src/game/shardfile/clientState';

let rapier: Awaited<ReturnType<typeof loadRapier>>;
beforeAll(async () => { rapier = await loadRapier(Uint8Array.from(await readFile('public/assets/physics/rapier.wasm')).buffer); });
function source() {
  const s = emptyShardfile({ slug: 'portal-proof', name: 'Portal proof', author: 'Fixture', revision: 1, seed: 224 });
  s.spawn = { x: 0, y: 20, z: 0, yaw: 0 };
  const decks = s.entryways.map(entry => {
    const vertical = entry.edge === 'north' || entry.edge === 'south', sign = entry.edge === 'north' || entry.edge === 'east' ? 1 : -1;
    return { id: `deck.${entry.edge}`, panel: null, initialActive: true, shapes: [{ kind: 'box', x: vertical ? 0 : sign * 242.5,
      y: -0.25, z: vertical ? sign * 242.5 : 0, hx: vertical ? 4 : 7.5, hy: 0.25, hz: vertical ? 7.5 : 4 }] };
  });
  s.props = v.parse(PropsSchema, { version: 1, family: 'pbr', tiles: [], panels: [], models: [], far: null, textures: [], colliders: [...decks,
    { id: 'square', panel: null, initialActive: true, shapes: [{ kind: 'box', x: 0, y: 19.75, z: 0, hx: 12, hy: 0.25, hz: 12 }] }] });
  s.entryways = s.entryways.map(entry => {
    const vertical = entry.edge === 'north' || entry.edge === 'south', sign = entry.edge === 'north' || entry.edge === 'east' ? 1 : -1;
    const at = vertical ? [0, 0, sign * 242] : [sign * 242, 0, 0], exit = vertical ? [0, 20, sign * 4] : [sign * 4, 20, 0];
    const portal = parsePortalLink({ road: { id: `portal.${entry.edge}`, at, floor: `deck.${entry.edge}` },
      destination: { id: 'portal.arrival', at: [0, 20, 0], floor: 'square' }, exit: { id: `portal.exit.${entry.edge}`, at: exit, floor: 'square' },
      links: [{ from: `portal.${entry.edge}`, to: 'portal.arrival' }, { from: `portal.exit.${entry.edge}`, to: `portal.${entry.edge}` }], route: [[0, 20, 0], exit] });
    return { ...entry, kind: 'portalLink', portal };
  });
  return parseShardfile(s);
}
it('proves all four static decks, 92 full-width road lanes and eight bound transfers through the square and back', () => {
  const s = source(), assets = new Map<string, Uint8Array>(), sim = createShardfileSim(s, assets, { rapier, ground: false });
  try {
    const proof = proveShardfileEntries(s, sim, assets, { rapier });
    expect(proof.lanes).toBe(92); expect(proof.portalTransfers).toBe(8); expect(proof.steps).toBeGreaterThan(13000);
    expect(sim.host.physics.world.colliders.len()).toBe(6); // five authored floors, one existing traveller; no plane/socket.
  } finally { sim.dispose(); }
});
it('refuses a tiny gap in the eight-by-fifteen deck before native allocation, and refuses missing kind/link bindings', () => {
  const s = source(), deck = s.props?.colliders.find(row => row.id === 'deck.north'), shape = deck?.shapes[0];
  if (shape?.kind !== 'box') throw new Error('Missing deck'); shape.hx = 3.999;
  expect(() => validatePortalFloors(portalLinkEntries(s.entryways), s, new Map())).toThrow('continuous named static floor');
  expect(() => createShardfileSim(s, new Map(), { rapier })).toThrow('continuous named static floor');
  const valid = source(), entry = valid.entryways[0]; if (entry === undefined) throw new Error('Missing entry');
  expect(() => parseShardfile({ ...valid, entryways: [{ ...entry, kind: 'ground' }, ...valid.entryways.slice(1)] })).toThrow('only portalLink');
  const { portal: _portal, ...unbound } = entry;
  expect(() => parseShardfile({ ...valid, entryways: [unbound, ...valid.entryways.slice(1)] })).toThrow('Missing portal link declaration');
});
it('refuses headroom obstruction, a blocked square route and submergence through the native proof', () => {
  const s = source(); if (s.props === null) throw new Error('Missing props');
  s.props.colliders.push({ id: 'ceiling', panel: null, initialActive: true, shapes: [{ kind: 'box', x: 0, y: 21, z: 0, hx: 1, hy: 0.2, hz: 1 }] });
  const sim = createShardfileSim(s, new Map(), { rapier });
  try { expect(() => proveShardfileEntries(s, sim, new Map(), { rapier })).toThrow('capsule clearance'); } finally { sim.dispose(); }
  const blocked = source(); if (blocked.props === null) throw new Error('Missing props');
  blocked.props.colliders.push({ id: 'wall', panel: null, initialActive: true, shapes: [{ kind: 'box', x: 0, y: 21, z: 2, hx: 2, hy: 1, hz: 0.2 }] });
  const obstructed = createShardfileSim(blocked, new Map(), { rapier });
  try { expect(() => proveShardfileEntries(blocked, obstructed, new Map(), { rapier })).toThrow('Blocked portal route'); } finally { obstructed.dispose(); }
  const wet = source(); wet.water = [{ id: 'wet-square', kind: 'pool', level: 21, shape: { kind: 'circle', x: 0, z: 0, radius: 12 } }];
  const submerged = createShardfileSim(wet, new Map(), { rapier });
  try { expect(() => proveShardfileEntries(wet, submerged, new Map(), { rapier })).toThrow('Portal destination lacks static floor or capsule clearance'); } finally { submerged.dispose(); }
});
it('a refused transfer leaves the traveller unchanged; checkpoint owners cannot write or snapshot mid-transfer', () => {
  const s = source(), sim = createShardfileSim(s, new Map(), { rapier }), motor = new CharacterMotor(sim.host.physics,
    { radius: 0.35, height: 1.8, step: 0.3, maxClimbDeg: 45, snap: 0.2, group: 'PLAYER', blockedBy: ['WORLD'] });
  const feet = { x: 0, y: 0, z: 242 }, before = { ...feet }; let writes = 0, observed = false, wet = true;
  const write = () => { writes++; return true; };
  const traversal = createPortalTraversal(portalLinkEntries(s.entryways), s, { physics: sim.host.physics, motor, feet, waterAt: () => {
    observed = true;
    expect(checkpointClientState({ ledger: { flush: write }, purse: null, encounters: write, continuation: write,
      canCheckpoint: () => !portalTransitioning(sim.host.physics) })).toBe(false);
    expect(() => captureClientState(s, sim, new Map())).toThrow('during a portal transfer');
    expect(() => snapshotSimHost(sim.host)).toThrow('during a portal transfer');
    return wet ? 30 : null;
  } });
  try {
    expect(() => traversal.teleport('unknown')).toThrow('Unknown or unbound'); expect(feet).toEqual(before);
    expect(() => traversal.teleport('portal.north')).toThrow('bound source portal'); expect(feet).toEqual(before);
    expect(observed).toBe(true); expect(writes).toBe(0); expect(portalTransitioning(sim.host.physics)).toBe(false);
    wet = false; expect(traversal.teleport('portal.north').to).toBe('portal.arrival'); expect(feet).toEqual({ x: 0, y: 20, z: 0 });
    expect(checkpointClientState({ ledger: { flush: write }, purse: null, encounters: write, continuation: write,
      canCheckpoint: () => !portalTransitioning(sim.host.physics) })).toBe(true); expect(writes).toBe(3);
  } finally { motor.dispose(); sim.dispose(); }
});

it('returns the complete portal round trip through the real isolated SDK worker and preserves its committed tick', async () => {
  const sim = await HeadlessSimulation.create(source(), new Map(), undefined, { deadline: 'advisory' });
  try {
    const commit = await sim.step();
    expect(await sim.finish()).toMatchObject({ ticks: 1, lanes: 92, portalTransfers: 8 });
    expect(sim.checkpoint).toEqual(commit);
    await expect(sim.step()).rejects.toThrow('validation finished');
  } finally { await sim.dispose(); }
}, 30_000); // Native worker initialization has its own 30s request deadline; runtime ticks retain their declared bounds.
