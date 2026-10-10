import { expect, it } from 'vitest';
import { Vector3 } from 'three';
import { Rng } from '../../../src/engine/core/rng';
import { NalatiTamingLaw, type TamingHorse, type TamingHerd, type NalatiTamingPorts } from '../../../src/shards/nalati-grasslands/runtime/tamingLaw';
import { ShippingTamingOracle } from '../../fixtures/taming-oracle/nalati';

function fixture(seed: number) {
  const log: string[] = [], rng = new Rng(seed);
  const horse = (id: string, kind = 'horse'): TamingHorse => ({ entityId: id, kind, scale: 1, alive: true, yaw: 0,
    position: new Vector3(), mem: {}, headWorld: out => out.set(0, 1.5, 0), setMotion: (yaw, speed) => { log.push(`motion:${yaw}:${speed}`); } });
  const st = horse('wild'); let stallion: TamingHorse | null = st;
  const h: TamingHerd<TamingHorse> = { get stallion() { return stallion; }, stallionState: 'guard', cx: 0, cz: 0, trust: 0, alert: 0,
    alertOwned: false, mode: 'graze', addTrust: value => { h.trust = Math.max(0, Math.min(100, h.trust + value)); },
    leadAway: (x, z) => { h.mode = 'flee'; log.push(`away:${x}:${z}`); }, releaseStallion: () => { stallion = null; log.push('release'); } };
  const p = { position: new Vector3(0, 0, -2), crouching: true, yaw: 0, pitch: 0, keys: new Set<string>(),
    camera: { position: new Vector3(0, 1.68, -2), getWorldDirection: (out: Vector3) => out.set(0, 0, -1) } };
  const mount = { mounted: false, horse: null as TamingHorse | null, breakShake: 0, breakRoll: 0,
    mount: (a: TamingHorse) => { mount.horse = a; mount.mounted = true; log.push(`mount:${a.entityId}`); return true; },
    dismount: (thrown?: boolean) => { mount.horse = null; mount.mounted = false; log.push(`dismount:${String(thrown)}`); },
    addMountable: (a: TamingHorse) => { log.push(`register:${a.entityId}`); }, removeMountable: (a: TamingHorse) => { log.push(`unregister:${a.entityId}`); } };
  const hud = { offer: true, lean: 0 }, horses = [st], herds = [h];
  const ports: NalatiTamingPorts<TamingHorse, TamingHerd<TamingHorse>> = { player: p, mount, hud, herds: () => herds,
    rest: { x: 10, z: 20, face: { x: 1, z: 0 } }, wind: () => ({ x: 0, z: -1, strength: 0.2 }), random: () => rng.next(),
    bond: { read: () => null, write: value => { log.push(`bond:${value}`); } }, spawnBonded: (_x, _z, _yaw, argymaq) => {
      const a = horse(`bond:${String(horses.length)}`); if (argymaq) a.scale = 1.3; horses.push(a); log.push(`spawn:${String(argymaq)}`); return a;
    }, hideStallion: a => { a.position.y = -1e4; log.push(`hide:${a.entityId}`); }, retireBonded: a => { a.alive = false; log.push(`retire:${a.entityId}`); },
    hurt: amount => { log.push(`hurt:${amount}`); } };
  return { ports, log, rng, horses, herds, h, st, p, mount, hud };
}
const observation = (law: NalatiTamingLaw<TamingHorse, TamingHerd<TamingHorse>> | ShippingTamingOracle<TamingHorse, TamingHerd<TamingHorse>>) => ({ phase: law.phase,
  tulpar: law.tulpar?.entityId ?? null, argymaq: law.isArgymaq, view: { ...law.view, ear: law.view.ear?.toArray() ?? null },
  prompt: { at: law.interactable.position.toArray(), radius: law.interactable.radius, label: law.interactable.label } });

it('preserves the shipping approach, challenge, throws and all five rounds at 60/30/20 Hz', () => {
  let bonds = 0, throws = 0;
  for (const hz of [60, 30, 20]) for (const seed of [17, 92, 111]) {
    const a = fixture(seed), b = fixture(seed), law = new NalatiTamingLaw(a.ports), old = new ShippingTamingOracle(b.ports);
    let last = 0;
    for (let tick = 0; tick < 4000; tick++) {
      const dt = 1 / hz;
      if (tick === 2) { law.noteEvent('pack-break', 0, 0); old.noteEvent('pack-break', 0, 0); }
      if (tick === 3) { law.noteEvent('pack-break', 0, 0); old.noteEvent('pack-break', 0, 0); }
      if (tick === 4) { law.noteShot(0, 0); old.noteShot(0, 0); }
      if (tick === 200) { a.h.stallionState = b.h.stallionState = 'beaten'; a.h.alert = b.h.alert = 0; }
      if (tick > 200 && law.phase !== 'breaking' && law.interactable.radius > 0) { law.startBreaking(); old.startBreaking(); last = 0; }
      // The public balance gauge and its observed velocity supply the pilot's lean; no forceBreak or internal writes.
      const balance = law.view.balance;
      const lean = seed === 111 ? -1 : Math.max(-1, Math.min(1, balance * 8 + (balance - last) / dt * 1.4));
      last = balance; a.hud.lean = b.hud.lean = lean;
      law.update(dt); old.update(dt);
      expect(observation(law)).toEqual(observation(old)); expect(a.rng.snapshot()).toEqual(b.rng.snapshot());
      expect(a.h.trust).toBe(b.h.trust); expect(a.h.alert).toBe(b.h.alert); expect(a.mount.breakRoll).toBe(b.mount.breakRoll);
      expect(a.st.mem).toEqual(b.st.mem); expect(a.log).toEqual(b.log);
      if (law.phase === 'bonded') { bonds++; break; }
      if (a.log.includes('hurt:10')) { throws++; if (seed === 111) break; }
    }
  }
  expect(bonds).toBeGreaterThan(0); expect(throws).toBeGreaterThan(0);
});

it('quietly resumes one mid-round snapshot and refuses foreign horse identities before mutation', () => {
  const a = fixture(17), b = fixture(17), law = new NalatiTamingLaw(a.ports), restored = new NalatiTamingLaw(b.ports);
  a.h.stallionState = b.h.stallionState = 'beaten'; law.update(1 / 60); law.startBreaking();
  for (let tick = 0; tick < 37; tick++) law.update(1 / 60);
  b.mount.horse = b.st; b.mount.mounted = true; b.h.trust = a.h.trust; b.h.alert = a.h.alert;
  b.p.yaw = a.p.yaw; b.p.pitch = a.p.pitch; Object.assign(b.st.mem, a.st.mem); b.rng.restore(a.rng.snapshot());
  const before = b.log.length; restored.restore(law.snapshot(), b.horses); expect(b.log).toHaveLength(before);
  expect(restored.snapshot()).toBe(law.snapshot());
  for (let tick = 0; tick < 100; tick++) { law.update(1 / 60); restored.update(1 / 60); expect(restored.snapshot()).toBe(law.snapshot()); }
  const wire = restored.snapshot(); expect(() => restored.restore(wire.replace('"wild"', '"foreign"'), b.horses)).toThrow();
  expect(restored.snapshot()).toBe(wire);
});


it('preserves the one-horse replacement: Argymaq retires the old Tulpar once and cannot be replaced again', () => {
  const a = fixture(17), b = fixture(17), law = new NalatiTamingLaw(a.ports), old = new ShippingTamingOracle(b.ports);
  const arg = (f: ReturnType<typeof fixture>): TamingHorse => {
    const stallion: TamingHorse = { ...f.st, entityId: 'argymaq', kind: 'argymaq', mem: {}, position: new Vector3(), scale: 1.3 };
    let live: TamingHorse | null = stallion;
    const h: TamingHerd<TamingHorse> = { ...f.h, get stallion() { return live; }, stallionState: 'beaten', trust: 100, alert: 0,
      addTrust: value => { h.trust = Math.max(0, Math.min(100, h.trust + value)); },
      releaseStallion: () => { live = null; f.log.push('release:argymaq'); } };
    f.herds.push(h); f.horses.push(stallion); return stallion;
  };
  let previous = 0;
  const drive = (): void => {
    for (let tick = 0; tick < 4000; tick++) {
      if (law.interactable.radius > 0 && law.phase !== 'breaking') { law.startBreaking(); old.startBreaking(); previous = 0; }
      const balance = law.view.balance, lean = Math.max(-1, Math.min(1, balance * 12 + (balance - previous) * 60 * 3)); previous = balance;
      a.hud.lean = b.hud.lean = lean; law.update(1 / 60); old.update(1 / 60);
      expect(observation(law)).toEqual(observation(old)); expect(a.log).toEqual(b.log); expect(a.rng.snapshot()).toEqual(b.rng.snapshot());
      if (law.phase === 'bonded' && law.interactable.radius === 0) return;
    }
    throw new Error('The live five-round replacement must finish');
  };
  a.h.stallionState = b.h.stallionState = 'beaten'; drive();
  const first = law.tulpar; if (first === null) throw new Error('Missing first actual bond');
  a.mount.dismount(); b.mount.dismount(); const elite = arg(a); arg(b);
  law.update(1 / 60); old.update(1 / 60); law.startBreaking(); old.startBreaking(); previous = 0; drive();
  expect(law.isArgymaq).toBe(true); expect(law.tulpar?.scale).toBe(1.3); expect(first.alive).toBe(false);
  expect(a.log.filter(event => event === `retire:${first.entityId}`)).toHaveLength(1);
  expect(a.log.filter(event => event === 'bond:argymaq')).toHaveLength(1);
  expect(law.canTame(elite)).toBe(false);
});
