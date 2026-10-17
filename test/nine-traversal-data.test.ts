import { expect, test } from 'vitest';
import aim from '../src/shards/nine-dragon-stack/data/grapple.json' with { type: 'json' };
import course from '../src/shards/nine-dragon-stack/data/grappleCourse.json' with { type: 'json' };
import plan from '../src/shards/nine-dragon-stack/world/portalPlan.generated.json' with { type: 'json' };
import before from './fixtures/nine-traversal.json' with { type: 'json' };
import { portalEntryRows, portalPlanRows } from '../src/shards/nine-dragon-stack/generators/portalEntries';
import portals from '../src/shards/nine-dragon-stack/data/portals.json' with { type: 'json' };
import { walkInRide, type PortalRider } from '../src/shards/nine-dragon-stack/runtime/portals/walkInRide';

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
  const ride = () => walkInRide(rider, () => { /* no veil in the simulation */ }, { entries, trigger: portals.trigger, fade: portals.fade });
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
