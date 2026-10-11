import { beforeAll, describe, expect, it } from 'vitest';
import { Group, Vector3 } from 'three';
import { parseModes, ZiplineModeSchema, UpdraftModeSchema } from '../src/format/modes';
import * as v from 'valibot';
import { Zipline, Updraft } from '../src/sdk/modes';
import { ZiplineDriver, UpdraftDriver, inUpdraft } from '../src/game/plugin/playerMode';
import { DriftwoodZipline } from './fixtures/modes/nativeZipline';
import { inUpdraft as nativeInUpdraft } from '../src/shards/far-reach/runtime/updraft';
import { UPDRAFT } from '../src/shards/far-reach/data/layout';
import { createSimHost, type SimHost } from '../src/engine/sim';
import { snapshotSimHost, restoreSimHost } from '../src/engine/sim/snapshot';
import { loadRapier } from '../src/engine/physics/rapier';
import { SIM_LEVEL } from './fixtures/sim-level/level';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';

const cable = v.parse(ZiplineModeSchema, { kind: 'zipline', id: 'fixture.cable', top: { x: 0, y: 24, z: 0 }, bottom: { x: 12, y: 0, z: 10 } });
const wind = v.parse(UpdraftModeSchema, { kind: 'updraft', id: 'fixture.wind', from: { x: UPDRAFT.x0, y: 0, z: UPDRAFT.z0 }, to: { x: UPDRAFT.x1, y: UPDRAFT.y1, z: UPDRAFT.z1 }, width: UPDRAFT.width, lift: 12 });
let rapier: Awaited<ReturnType<typeof loadRapier>>;
beforeAll(async () => { rapier = await loadRapier(await (await fetch(wasmInline)).arrayBuffer()); });

describe('SF84 bounded platform mode rows', () => {
  it('refuses malformed, duplicate, nonfinite, unsupported and out-of-budget rows', () => {
    expect(parseModes({ traverse: [cable, wind] }).traverse).toEqual([cable, wind]);
    for (const traverse of [[cable, cable], [{ ...cable, gravity: Infinity }], [{ ...wind, lift: 65 }], [{ ...wind, width: 0 }], [{ ...cable, bottom: cable.top }], [{ ...wind, to: wind.from }], [{ ...cable, kind: 'script', module: 'unowned' }], [{ ...cable, onEnter: () => undefined }]]) expect(() => parseModes({ traverse })).toThrow();
    expect(() => parseModes({ traverse: Array.from({ length: 65 }, (_, i) => ({ ...wind, id: `wind.${i}` })) })).toThrow();
  });

  it('reads ordinary three.js hierarchies and clones independent authoring data', () => {
    const root = new Group(); root.position.set(10, 5, 20); root.rotation.y = 0.2;
    const zip = new Zipline(new Vector3(0, 24, 0), new Vector3(12, 0, 10)); zip.name = cable.id; root.add(zip);
    const column = new Updraft(new Vector3(0, 0, 0), new Vector3(0, 12, 20), { width: 4, lift: 12 }); column.name = 'column'; root.add(column);
    const z = zip.toModeData(), w = column.toModeData();
    expect(z.top).toEqual({ x: 10, y: 29, z: 20 }); expect(w.from).toEqual({ x: 10, y: 5, z: 20 });
    const copy = zip.clone(); copy.top.x = 100; copy.options.drag = 0.02; expect(zip.top.x).toBe(0); expect(zip.options.drag).toBeUndefined();
    const other = column.clone(); other.options.lift = 4; other.from.x = 20; expect(column.options.lift).toBe(12); expect(column.from.x).toBe(0);
  });

  it('matches the native cable law on every tick, release velocity and silent restore', () => {
    const events: boolean[] = [], expected: boolean[] = [];
    const actual = new ZiplineDriver(cable, on => { events.push(on); }), native = new DriftwoodZipline({ top: new Vector3(cable.top.x, cable.top.y, cable.top.z), bottom: new Vector3(cable.bottom.x, cable.bottom.y, cable.bottom.z), sag: cable.sag }, on => { expected.push(on); });
    const a = { position: new Vector3(), velocity: new Vector3() }, b = { position: new Vector3(), velocity: new Vector3() };
    actual.start(); native.start();
    for (let tick = 1; tick <= 1200; tick++) {
      const dt = tick % 3 === 0 ? 1 / 30 : 1 / 60; actual.update(dt, a); native.update(dt, b);
      expect(actual.snapshot()).toEqual(native.snapshot()); expect(a.position).toEqual(b.position); expect(a.velocity).toEqual(b.velocity); expect(events).toEqual(expected);
      if (tick === 30) { const state = actual.snapshot(); actual.restore(state); expect(events).toEqual(expected); }
    }
    expect(events).toEqual([true, false]); const saved = actual.snapshot(); expect(() => actual.restore({ ...saved, v: 20 })).toThrow(); expect(actual.snapshot()).toEqual(saved);
  });

  it('holds every shipping wind decision and exact lift, including its open boundaries', () => {
    let seed = 435, inside = 0; const rand = () => { seed = Math.imul(seed, 1664525) + 1013904223 | 0; return (seed >>> 0) / 4294967296; };
    const force = new UpdraftDriver(wind), impulse = new Vector3();
    const positions = [{ x: wind.from.x, y: 0, z: wind.from.z }, { x: wind.to.x, y: 0, z: wind.to.z }, { x: (wind.from.x + wind.to.x) / 2, y: wind.to.y + 0.5, z: (wind.from.z + wind.to.z) / 2 }];
    for (let i = 0; i < 10000; i++) positions.push({ x: wind.from.x + (wind.to.x - wind.from.x) * rand(), y: wind.to.y - 10 + rand() * 12, z: wind.from.z + (wind.to.z - wind.from.z) * rand() });
    for (const p of positions) {
      const native = nativeInUpdraft(p.x, p.y, p.z); expect(inUpdraft(wind, p.x, p.y, p.z)).toBe(native); if (native) inside++;
      impulse.set(0, 0, 0); force.step(1 / 60, p, true, impulse); expect(impulse.y).toBe(native ? 12 / 60 : 0);
      impulse.set(0, 0, 0); force.step(1 / 60, p, false, impulse); expect(impulse.y).toBe(0);
    }
    expect(inside).toBeGreaterThan(100);
  });

  it('continues the real player host byte-identically through a mid-cable restore', () => {
    const level = { ...SIM_LEVEL, entities: [], player: { ...SIM_LEVEL.player, at: { x: 0, y: 24, z: 0 } } };
    let first: ZiplineDriver | undefined;
    const install = (host: SimHost): ZiplineDriver => {
      const body = { position: host.player.position, velocity: new Vector3() }, zip = new ZiplineDriver(cable, () => undefined);
      host.usePlayerDriver({ input: () => { if (!zip.isRiding) return false; host.playerImpulse.set(0, 0, 0); host.playerFall.grounded = false; return true; }, step: () => undefined });
      host.onStep('fixture.cable', dt => zip.update(dt, body), { snapshot: () => zip.snapshot(), restore: state => zip.restore(state) }, 'afterBodies');
      return zip;
    };
    const host = createSimHost(level, { rapier }), zip = install(host); zip.start(); let restored: SimHost | undefined;
    try {
      for (let tick = 1; tick <= 600; tick++) {
        host.step();
        if (tick === 30) { const state = snapshotSimHost(host); restored = restoreSimHost(level, { rapier }, state, h => { first = install(h); }); expect(snapshotSimHost(restored)).toEqual(state); }
        else if (tick > 30 && restored !== undefined) { restored.step(); expect(snapshotSimHost(restored)).toEqual(snapshotSimHost(host)); expect(first?.snapshot()).toEqual(zip.snapshot()); }
      }
    } finally { restored?.dispose(); host.dispose(); }
  });
});
