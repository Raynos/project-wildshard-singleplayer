import { describe, expect, it } from 'vitest';
import * as v from 'valibot';
import stages from '../../../src/shards/nine-dragon-stack/data/portalStages.json' with { type: 'json' };
import { readScene } from '@wildshard/sdk/scene';
import { Portal } from '@wildshard/sdk/entries';
import { portalLinkEntries, portalLinkRules } from '@wildshard/format/portalLinkAssets';
import source from '../../../src/shards/nine-dragon-stack/shard.config';
import { portalEntryScene, portalEntryRows } from '../../../src/shards/nine-dragon-stack/generators/portalEntries';
import { DECK_PORTALS, SQUARE_PORTAL, portalLinks } from '../../../src/shards/nine-dragon-stack/world/portalPlan';
import { portalRide, type PortalRider } from '../../../src/shards/nine-dragon-stack/world/portalRide';
import { PortalRideStateSchema, walkInRide } from '../../../src/shards/nine-dragon-stack/runtime/portals/walkInRide';
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
      const { version, director, ...native } = next.snapshot();
      expect(version).toBe(2); expect(typeof director).toBe('string');
      expect(native).toEqual(old.snapshot());
      expect(after.position).toEqual(before.position);
      expect(after.holds).toEqual(before.holds); expect(after.settled).toEqual(before.settled); expect(after.veil).toEqual(before.veil);
      if (tick === 4999) { old.restore(next.snapshot()); next.restore(next.snapshot()); }
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


describe('SF81 Nine portal director', () => {
  it('owns hold/transfer/clear order while the native clock and actual checked transfer retain their slots', () => {
    const actor = body(), portal = DECK_PORTALS[0];
    if (portal === undefined) throw new Error('Missing declared road');
    const ride = portalRide(actor.rider, k => { actor.veil.push(k); });
    const cursor = (): string => {
      const saved = JSON.parse(ride.snapshot().director) as { contract: { stages: { id: string }[] }; state: { stage: number } };
      return saved.contract.stages[saved.state.stage]?.id ?? 'missing';
    };
    Object.assign(actor.position, portal);
    ride.step(0); expect(actor.holds).toEqual([true]); expect(cursor()).toBe('held');
    for (let tick = 0; tick < 3; tick++) ride.step(0.1);
    expect(cursor()).toBe('transferred'); expect(ride.rides()).toHaveLength(1);
    expect(actor.holds).toEqual([true, false]);
    for (let tick = 0; tick < 6; tick++) ride.step(0.1);
    expect(cursor()).toBe('idle'); expect(ride.busy()).toBe(false); expect(actor.veil.at(-1)).toBe(0);
    expect(ride.snapshot().armed).toBe(false);
    Object.assign(actor.position, { x: 0, y: 125, z: 0 }); ride.step(0);
    expect(ride.snapshot().armed).toBe(true);
  });

  it('uses the authored condition rather than advancing a parallel native transition', () => {
    const edited = structuredClone(stages), held = edited.stages.find(stage => stage.id === 'held');
    if (held?.next[0] === undefined) throw new Error('Missing held transition');
    held.next[0].when = 'false';
    const actor = body(), portal = DECK_PORTALS[0];
    if (portal === undefined) throw new Error('Missing declared road');
    const ride = walkInRide(actor.rider, () => { /* Native proof has no veil. */ }, {
      entries: portalLinkEntries(source.entryways), trigger: PORTAL_TRIGGER, fade: PORTAL_FADE, stages: edited,
    });
    Object.assign(actor.position, portal);
    for (let tick = 0; tick < 20; tick++) ride.step(0.1);
    expect(ride.rides()).toEqual([]); expect(actor.holds).toEqual([true]);
  });

  it('refuses pre-row and foreign continuation before changing the cursor/native state or publishing effects', () => {
    const actor = body(), ride = portalRide(actor.rider, k => { actor.veil.push(k); });
    const saved = ride.snapshot(), { version: oldVersion, director: oldDirector, ...preRows } = saved;
    expect(oldVersion).toBe(2); expect(oldDirector).toBe(saved.director);
    expect(() => v.parse(PortalRideStateSchema, preRows)).toThrow();
    const foreign = JSON.parse(saved.director) as { contract: { id: string } };
    foreign.contract.id = 'nine.foreign';
    expect(() => ride.restore({ ...saved, director: JSON.stringify(foreign), t: 10 })).toThrow(/Incompatible stage/u);
    expect(ride.snapshot()).toEqual(saved);
    ride.restore(saved); expect(ride.snapshot()).toEqual(saved);
    expect(actor.holds).toEqual([]); expect(actor.settled).toEqual([]); expect(actor.veil).toEqual([]);
  });
});
