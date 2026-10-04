import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Hash the committed client module bytes.
import { createHash } from 'node:crypto';
import { Object3D, Points } from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { ClientScriptLane } from '../../src/engine/script/client';
import { createSimHost } from '../../src/engine/sim';
import { snapshotSimHost } from '../../src/engine/sim/snapshot';
import { loadRapier } from '../../src/engine/physics/rapier';
import { Scope } from '../../src/engine/app/scope';
import { ClientScriptViews, type ClientScriptViewTarget } from '../../src/game/shardfile/clientScriptViews';
import { CLIENT_IDLE_HASH, TEMPLATE_CLIENT_SCRIPTS } from '../../src/shards/_template/data/clientScripts';
import { compileScript } from '../../scripts/compile-script.mjs';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';
import { SIM_LEVEL } from '../fixtures/sim-level/level';

const SOURCE = new URL('../../src/shards/_template/behaviour/idle.as', import.meta.url);
const ASSET = new URL(`../../src/shards/_template/assets/${CLIENT_IDLE_HASH}`, import.meta.url);
let bytes: Uint8Array, rapier: Awaited<ReturnType<typeof loadRapier>>;
beforeAll(async () => {
  bytes = await compileScript(readFileSync(SOURCE, 'utf8'), { maximumPages: 2 });
  rapier = await loadRapier(await (await fetch(wasmInline)).arrayBuffer());
});
/** The template's three idle bindings, each bound to the fixture's one creature view (the adapter sees copies only). */
function templateLane(): ClientScriptLane {
  return new ClientScriptLane({ modules: [{ name: CLIENT_IDLE_HASH, bytes, seedLo: 435, seedHi: 0 }], divisor: TEMPLATE_CLIENT_SCRIPTS.divisor,
    bindings: TEMPLATE_CLIENT_SCRIPTS.bindings.map((b) => ({ module: b.module, entity: b.entity, name: b.name, readCount: 0, parameters: b.parameters, pose: b.pose, maxOffset: b.maxOffset,
      minScale: b.minScale, maxScale: b.maxScale, emitters: b.emitters.map((e) => ({ id: e.id, perTick: e.perTick, live: e.live, lifetimeTicks: e.lifetimeTicks })) })) });
}

describe('SF25 client-script views (G66: frozen, but alive-looking)', () => {
  it('ships the committed idle bytes its source compiles to', () => {
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(CLIENT_IDLE_HASH);
    expect(new Uint8Array(readFileSync(ASSET))).toEqual(bytes);
  });

  it('moves frozen views and draws bounded particles without changing the SimHost snapshot', () => {
    const sim = createSimHost(SIM_LEVEL, { rapier }), scope = new Scope('sf25-views'), root = new Object3D(), before = snapshotSimHost(sim);
    const boar = sim.entities.get('boar:1'); if (boar === undefined) throw new Error('fixture boar');
    const lane = templateLane(), objects = new Map<number, Object3D>();
    const targets = TEMPLATE_CLIENT_SCRIPTS.bindings.map((b): ClientScriptViewTarget => {
      const object = new Object3D(); object.position.copy(boar.position); object.rotation.y = boar.yaw; root.add(object); objects.set(b.entity, object);
      return { entity: b.entity, object, anchor: (out) => out.copy(object.position).setY(1), emitters: b.emitters.map((e) => ({ id: e.id, live: e.live, colour: e.colour, size: e.size, velocity: e.velocity, gravity: e.gravity })) };
    });
    const views = new ClientScriptViews(lane, targets, { root, scope });
    const base = [...objects.values()].map((o) => ({ p: o.position.clone(), q: o.quaternion.clone(), s: o.scale.clone() }));
    let moved = 0, peak = 0;
    for (let tick = 0; tick < 1200; tick++) {
      const p = boar.position, observations = new Map(TEMPLATE_CLIENT_SCRIPTS.bindings.map((b) => [b.entity, { position: [p.x, p.y, p.z] as const, frozen: true, values: [] }]));
      for (const call of lane.step(tick, observations)) expect(call.ok).toBe(true);
      views.restore();
      [...objects.values()].forEach((o, i) => { expect(o.position.equals(base[i]?.p ?? o.position)).toBe(true); expect(o.scale.equals(base[i]?.s ?? o.scale)).toBe(true); });
      views.apply(1 / 60);
      for (const [i, o] of [...objects.values()].entries()) if (o.position.distanceTo(base[i]?.p ?? o.position) > 0.01 || Math.abs(o.scale.y - 1) > 0.01 || o.quaternion.angleTo(base[i]?.q ?? o.quaternion) > 0.01) moved++;
      peak = Math.max(peak, views.state().particles);
    }
    expect(moved).toBeGreaterThan(1000);
    expect(peak).toBeGreaterThan(0); expect(peak).toBeLessThanOrEqual(views.state().capacity); expect(views.state().capacity).toBe(6);
    expect(root.children.filter((c) => c instanceof Points)).toHaveLength(1); // every particle is one pooled draw
    expect(snapshotSimHost(sim)).toEqual(before);
    scope.dispose();
    [...objects.values()].forEach((o, i) => { expect(o.position.equals(base[i]?.p ?? o.position)).toBe(true); expect(o.quaternion.equals(base[i]?.q ?? o.quaternion)).toBe(true); });
    expect(root.children.some((c) => c instanceof Points)).toBe(false);
    lane.dispose(); sim.dispose();
  });

  it('composes on top of a live pose: a live entity gets the identity pose and keeps its own transform', () => {
    const scope = new Scope('sf25-live'), root = new Object3D(), lane = templateLane(), object = new Object3D();
    const views = new ClientScriptViews(lane, TEMPLATE_CLIENT_SCRIPTS.bindings.map((b) => ({ entity: b.entity, object: b.entity === 2 ? object : null, anchor: (out) => out.set(0, 0, 0), emitters: [] })), { root, scope });
    for (let tick = 0; tick < 240; tick++) {
      object.position.set(tick * 0.01, 0, 0); object.rotation.set(0, tick * 0.001, 0); // the view's own sim sync each frame
      lane.step(tick, new Map(TEMPLATE_CLIENT_SCRIPTS.bindings.map((b) => [b.entity, { position: [0, 0, 0] as const, frozen: false, values: [] }])));
      views.apply(1 / 60);
      expect(object.position.x).toBeCloseTo(tick * 0.01, 6); expect(object.rotation.y).toBeCloseTo(tick * 0.001, 6);
      views.restore();
    }
    scope.dispose(); lane.dispose();
  });
});
