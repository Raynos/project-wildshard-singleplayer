import { describe, expect, it } from 'vitest';
import { readScene } from '@wildshard/sdk/scene';
import { Portal } from '@wildshard/sdk/entries';
import { portalLinkEntries, portalLinkRules } from '../../../src/game/shardfile/portalLink';
import source from '../../../src/shards/nine-dragon-stack/shard.config';
import { portalEntryScene, portalEntryRows } from '../../../src/shards/nine-dragon-stack/generators/portalEntries';
import { DECK_PORTALS, SQUARE_PORTAL, portalLinks } from '../../../src/shards/nine-dragon-stack/world/portalPlan';
import { portalRide, type PortalRider } from '../../../src/shards/nine-dragon-stack/world/portalRide';
import { walkInRide } from '../../../src/shards/nine-dragon-stack/runtime/portals/walkInRide';
import { PORTAL_FADE, PORTAL_TRIGGER } from '../../../src/shards/nine-dragon-stack/data/portals';
import { portalRide as shippingRide } from '../../../src/shards/nine-dragon-stack-legacy/world/portalRide';

function body() {
  const position = { x: 0, y: 125, z: 0 }, holds: boolean[] = [], settled: number[] = [], veil: number[] = [];
  const entries = portalLinkEntries(source.entryways);
  let refusal = false;
  const rider: PortalRider = {
    position,
    hold: on => { holds.push(on); },
    teleport: from => {
      if (refusal) throw new Error('native floor refusal');
      for (const { portal } of entries) {
        const link = portal.links.find(row => row.from === from);
        if (link === undefined) continue;
        const node = [portal.road, portal.destination, portal.exit].find(row => row.id === link.to);
        if (node === undefined) throw new Error('Missing declared destination');
        [position.x, position.y, position.z] = node.at;
        return { from, to: node.id, yaw: node.yaw };
      }
      throw new Error('Missing declared link');
    },
    settle: yaw => { settled.push(yaw); },
  };
  return { position, holds, settled, veil, rider, refuse: (on: boolean) => { refusal = on; } };
}

describe('SF83 Nine portal rows', () => {
  it('reads four real Portal objects and preserves every shipping link and floor binding', () => {
    const scene = portalEntryScene();
    expect(scene.children).toHaveLength(4);
    expect(scene.children.every(object => object instanceof Portal)).toBe(true);
    expect(portalEntryRows()).toEqual(readScene(scene).entries);
    expect(source.entryways).toEqual(portalEntryRows());
    expect(source.entryways.map(row => row.portal)).toEqual(portalLinks().map(row => row.portal));
    expect(portalLinkRules(portalLinkEntries(source.entryways), source)).toEqual([]);
    expect(source.entryways.every(row => row.kind === 'portalLink' && row.lift === undefined)).toBe(true);
  });

  it('keeps the shipping hold, fade, transfer, refusal and complete continuation exact for 10k steps and cross-restores', () => {
    const before = body(), after = body();
    const old = shippingRide(before.rider, k => { before.veil.push(k); });
    const next = portalRide(after.rider, k => { after.veil.push(k); });
    const dts = [1 / 60, 0.05, 0.001, 0.1, 0.4, 0];
    for (let tick = 0; tick < 10_000; tick++) {
      const phase = tick % 180, portal = DECK_PORTALS[Math.floor(tick / 180) % 4];
      if (portal === undefined) throw new Error('Missing oracle portal');
      const at = phase < 40 ? portal : phase >= 90 && phase < 130 ? SQUARE_PORTAL : { x: 0, y: 125, z: 0 };
      Object.assign(before.position, { x: at.x, y: at.y, z: at.z }); Object.assign(after.position, before.position);
      const refuses = Math.floor(tick / 180) % 3 === 1;
      before.refuse(refuses); after.refuse(refuses);
      const dt = dts[tick % dts.length]; if (dt === undefined) throw new Error('Missing oracle delta');
      old.step(dt); next.step(dt);
      expect(next.snapshot()).toEqual(old.snapshot());
      expect(after.position).toEqual(before.position);
      expect(after.holds).toEqual(before.holds); expect(after.settled).toEqual(before.settled); expect(after.veil).toEqual(before.veil);
      if (tick === 4999) { old.restore(next.snapshot()); next.restore(old.snapshot()); }
    }
    expect(next.rides().length).toBeGreaterThan(0); expect(next.refused().length).toBeGreaterThan(0);
  });

  it('selects the live declared node rather than the old parallel placement plan', () => {
    const rows = structuredClone(portalLinkEntries(source.entryways)), north = rows.find(row => row.edge === 'north');
    if (north === undefined) throw new Error('Missing north row');
    north.portal.road.at[2] += 1;
    expect(portalLinkRules(rows, source)).toEqual([]);
    const actor = body(), at = north.portal.road.at;
    const ride = walkInRide(actor.rider, () => { /* no rendered veil */ }, { entries: rows, trigger: PORTAL_TRIGGER, fade: PORTAL_FADE });
    Object.assign(actor.position, { x: at[0], y: at[1], z: at[2] - 1 }); ride.step(0);
    expect(ride.busy()).toBe(false);
    Object.assign(actor.position, { x: at[0], y: at[1], z: at[2] }); ride.step(0);
    expect(ride.snapshot().from).toBe(north.portal.road.id); expect(actor.holds).toEqual([true]);
  });
});
