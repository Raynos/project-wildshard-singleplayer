import { expect, test } from 'vitest';
import { createPortalRide } from '../src/game/shardfile/walkInPortalRide';
import type { PortalLinkEntry } from '../src/format/portalLinkAssets';
import aim from '../src/shards/nine-dragon-stack/data/grapple.json' with { type: 'json' };
import course from '../src/shards/nine-dragon-stack/data/grappleCourse.json' with { type: 'json' };
import plan from '../src/shards/nine-dragon-stack/world/portalPlan.generated.json' with { type: 'json' };
import before from './fixtures/nine-traversal.json' with { type: 'json' };
import { portalEntryRows, portalPlanRows } from '../src/shards/nine-dragon-stack/generators/portalEntries';
import portals from '../src/shards/nine-dragon-stack/data/portals.json' with { type: 'json' };
import portalStages from '../src/shards/nine-dragon-stack/data/portalStages.json' with { type: 'json' };
import { bindPortalRide as walkInRide } from '../src/shards/nine-dragon-stack/runtime/portals/hostRide';
import type { PortalRider } from '../src/shards/nine-dragon-stack/runtime/portals/types';

// Recorded from executable authoring rows at a242b48db before removing their modules.
test('JSON retains every grapple hint, course coordinate and portal frame', () => {
  expect({ aim, course, plan: { decks: plan.decks, square: plan.square, route: plan.route } }).toEqual(before);
  expect(portalPlanRows()).toEqual(plan);
});

const entries = portalEntryRows().flatMap(row => row.portal === undefined ? [] : [{ edge: row.edge, portal: row.portal }]);
function riderAt(x: number, y: number, z: number) {
  const position = { x, y, z }, holds: boolean[] = [], transfers: string[] = [];
  const rider: PortalRider = {
    position, hold: on => { holds.push(on); }, settle: () => { /* pose is set by the transfer */ },
    teleport: from => {
      const entry = entries.find(row => row.portal.road.id === from || row.portal.exit.id === from);
      if (entry === undefined) throw new Error('Missing portal link');
      const to = entry.portal.road.id === from ? entry.portal.destination : entry.portal.road;
      const [px, py, pz] = to.at;
      Object.assign(position, { x: px, y: py, z: pz }); transfers.push(from);
      return { from, to: to.id, yaw: to.yaw };
    },
  };
  const ride = (stages: unknown = portalStages) => walkInRide(rider, () => { /* no veil in the simulation */ }, { entries, trigger: portals.trigger, fade: portals.fade, stages });
  return { position, holds, transfers, ride };
}

test.each(plan.decks)('$edge ring keeps its trigger bounds and mid-fade continuation', deck => {
  const at = riderAt(deck.x, deck.y, deck.z), ride = at.ride();
  // Across the portal plane: just outside, then on the exact accepted boundary.
  at.position.x = deck.x - deck.nz * (portals.trigger.half + 0.001);
  at.position.z = deck.z + deck.nx * (portals.trigger.half + 0.001);
  ride.step(1 / 60); expect(ride.busy()).toBe(false);
  at.position.x = deck.x - deck.nz * portals.trigger.half;
  at.position.z = deck.z + deck.nx * portals.trigger.half;
  ride.step(1 / 60); expect(at.holds).toEqual([true]);
  const saved = ride.snapshot(), resumed = at.ride();
  const heldBeforeRestore = [...at.holds]; resumed.restore(saved);
  expect(at.holds).toEqual(heldBeforeRestore); expect(at.transfers).toEqual([]);
  for (let frame = 0; frame < 60; frame++) resumed.step(1 / 60);
  expect(at.transfers).toEqual([deck.id]);
  expect(at.holds).toEqual([true, false]); expect(resumed.entered()).toBe(deck.edge);
  expect(resumed.busy()).toBe(false);
  expect(at.position).toEqual({ x: 0.95, y: 125, z: 7.5 });
  // The shared square exit returns to the road selected before the restore.
  Object.assign(at.position, { x: plan.square.x, y: plan.square.y, z: plan.square.z });
  for (let frame = 0; frame < 60; frame++) resumed.step(1 / 60);
  expect(at.transfers).toEqual([deck.id, `${plan.square.id}.${deck.edge}`]);
  expect(at.position).toEqual({ x: deck.x, y: deck.y, z: deck.z });
  expect(at.holds).toEqual([true, false, true, false]);
});

test('product-sorted portal inputs retain authored save bytes', () => {
  const deck = plan.decks[0];
  if (deck === undefined) throw new Error('Missing portal deck');
  const source = riderAt(deck.x, deck.y, deck.z), product = riderAt(deck.x, deck.y, deck.z);
  const authored = source.ride(), sorted = product.ride({ ...portalStages,
    inputs: Object.fromEntries(Object.entries(portalStages.inputs).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) });
  for (let tick = 0; tick < 60; tick++) {
    authored.step(1 / 60); sorted.step(1 / 60);
    expect(JSON.stringify(sorted.snapshot())).toBe(JSON.stringify(authored.snapshot()));
    if (tick === 8) {
      const saved = authored.snapshot(), held = [...product.holds];
      sorted.restore(saved);
      expect(JSON.stringify(sorted.snapshot())).toBe(JSON.stringify(saved));
      expect(product.holds).toEqual(held); expect(product.transfers).toEqual([]);
    }
  }
  expect(product.holds).toEqual(source.holds); expect(product.transfers).toEqual(source.transfers);
  expect(product.position).toEqual(source.position);

});


test('a second shard drives walk-in rides with its own nodes, cadence and director ids', () => {
  const entry: PortalLinkEntry = { edge: 'east', portal: {
    road: { id: 'orchard.gate', at: [240, 0, 0], floor: 'gate', yaw: 0.7 },
    destination: { id: 'orchard.arrival', at: [15, 20, 30], floor: 'terrace', yaw: 0.3 },
    exit: { id: 'orchard.return', at: [10, 20, 30], floor: 'terrace', yaw: 0 },
    links: [{ from: 'orchard.gate', to: 'orchard.arrival' }, { from: 'orchard.return', to: 'orchard.gate' }],
    route: [[15, 20, 30], [10, 20, 30]] } };
  const profile = { entries: [entry], trigger: { front: 0.4, back: 0.5, half: 0.7, feet: 0.12 }, fade: { out: 0.2, hold: 0.1, in: 0.3 },
    stages: { ...portalStages, id: 'orchard.waystone', inputs: { touch: 'zone:orchard.gate', dark: 'event:orchard.dark', clear: 'event:orchard.clear' } } };
  const ride = createPortalRide(profile), feet = { x: 240, y: 0, z: 0 };
  expect(ride.observe(0.1, feet).commands).toEqual([{ kind: 'hold', on: true }]);
  const saved = ride.snapshot(), resumed = createPortalRide(profile); resumed.restore(saved);
  expect(resumed.observe(0.1, feet).commands).toEqual([{ kind: 'transfer', from: 'orchard.gate' }, { kind: 'hold', on: false }]);
  resumed.complete({ from: 'orchard.gate', to: 'orchard.arrival', yaw: 0.3 });
  expect(resumed.entered()).toBe('east');
  for (let tick = 0; tick < 10; tick++) resumed.observe(0.1, { x: 15, y: 20, z: 30 });
  expect(resumed.busy()).toBe(false);
  for (let tick = 0; tick < 3; tick++) resumed.observe(0.1, { x: 10, y: 20, z: 30 });
  expect(resumed.snapshot().from).toBe('orchard.return');
  expect(() => createPortalRide({ ...profile, fade: { out: 0, hold: 0, in: 1 } })).toThrow('Invalid portal');
});
