import { expect, test } from 'vitest';
import { Vector3 } from 'three';
import { TamingBinding } from '../src/game/riding/binding';
import type { TamingHorse, TamingHerd, TamingServices } from '../src/game/riding/bindingTypes';
import programs from '../src/shards/nalati-grasslands/behaviour/riding.generated.json' with { type: 'json' };

function fixture(saved: string | null = null) {
  const events: string[] = [];
  const horse = (id: string, kind: string): TamingHorse => ({ entityId: id, kind, scale: 1, alive: true, yaw: .7,
    position: new Vector3(0, 0, 0), mem: {}, headWorld: out => out.set(0, 1.5, 0),
    setMotion: () => { events.push('motion'); } });
  const stallion = horse('wild', saved === null ? 'ordinary' : 'upgraded');
  const herd: TamingHerd<TamingHorse> = { stallion, stallionState: 'beaten', cx: 0, cz: 0, trust: 100, alert: 0, alertOwned: false, mode: 'graze',
    addTrust(value) { events.push(`trust:${String(value)}`); this.trust = Math.max(0, Math.min(100, this.trust + value)); },
    leadAway: () => { events.push('lead'); }, releaseStallion: () => { events.push('release'); } };
  let mounted: TamingHorse | null = null, acceptsMount = false, yaw = 2, pitch = .4, spawned = 0;
  const hud = { offer: false, lean: 0 };
  const opts: TamingServices<TamingHorse, TamingHerd<TamingHorse>> = {
    profile: { upgradeKind: 'upgraded', bonds: ['bond', 'better-bond'], names: ['Companion', 'Better companion'], offset: [0, 0],
      fields: { upgraded: 'argymaq', horseUpgraded: 'horseArgymaq', candidateUpgraded: 'argymaq' },
      labels: { mount: 'Mount', breaking: 'Tame', trust: 'Trust', start: 'Start', thrown: 'Thrown', bonded: ['Bonded', 'Better bonded'] } },
    programs, bond: { read: () => saved, write: value => { events.push(`write:${value}`); } },
    player: { position: new Vector3(0, 0, 2), crouching: true, keys: new Set(),
      get yaw() { return yaw; }, set yaw(value) { events.push('yaw'); yaw = value; },
      get pitch() { return pitch; }, set pitch(value) { events.push('pitch'); pitch = value; },
      camera: { position: new Vector3(0, 1.5, 2), getWorldDirection: out => out.set(0, 0, -1) } },
    mount: { get mounted() { return mounted !== null; }, get horse() { return mounted; }, breakRoll: 0, breakShake: 0,
      mount: (actor, breaking) => { events.push(`mount:${actor.entityId}:${String(breaking === true)}`); if (!acceptsMount) return false; mounted = actor; return true; },
      dismount: thrown => { events.push(`dismount:${String(thrown === true)}`); mounted = null; },
      addMountable: actor => { events.push(`add:${actor.entityId}`); }, removeMountable: actor => { events.push(`remove:${actor.entityId}`); } },
    hud, herds: () => [herd], rest: { x: 0, z: 0, face: { x: 0, z: 1 } }, wind: () => ({ x: 0, z: 1, strength: 1 }),
    random: () => { events.push('random'); return .25; },
    spawnBonded: () => { const actor = horse(`bonded-${String(++spawned)}`, 'ordinary'); events.push(`spawn:${actor.entityId}`); return actor; },
    hideStallion: actor => { events.push(`hide:${actor.entityId}`); }, retireBonded: actor => { events.push(`retire:${actor.entityId}`); },
    hurt: value => { events.push(`hurt:${String(value)}`); }, toast: value => { events.push(`notice:${value}`); },
  };
  const binding = new TamingBinding(opts);
  binding.onBreaking = on => { events.push(`breaking:${String(on)}`); };
  binding.onBonded = actor => { events.push(`bonded:${actor.entityId}`); };
  binding.update(.1); events.length = 0;
  return { binding, events, hud, opts, herd, allowMount: () => { acceptsMount = true; }, loseMount: () => { mounted = null; } };
}

test('native mount refusal precedes player pose, entropy and taming continuation changes', () => {
  const f = fixture(), wire = f.binding.snapshot();
  f.binding.startBreaking();
  expect(f.events).toEqual(['mount:wild:true']);
  expect(f.opts.player.yaw).toBe(2); expect(f.opts.player.pitch).toBe(.4);
  expect(f.binding.snapshot()).toBe(wire);
  f.allowMount(); f.events.length = 0; f.binding.startBreaking();
  expect(f.events).toEqual(['mount:wild:true', 'yaw', 'pitch', 'random', 'random', 'random', 'breaking:true', 'notice:Start']);
  expect(f.opts.player.yaw).toBe(.7 - Math.PI); expect(f.opts.player.pitch).toBe(-.1);
  expect(f.binding.phase).toBe('breaking');
});

test('due sampling draws three values even when the mounted actor was just lost', () => {
  const f = fixture(); f.allowMount(); f.binding.startBreaking(); f.events.length = 0;
  f.binding.update(.04);
  expect(f.events).toEqual([]);
  f.loseMount(); f.binding.update(.06);
  expect(f.events).toEqual(['random', 'random', 'random', 'breaking:false', 'dismount:true', 'hurt:10', 'trust:-40', 'lead', 'notice:Thrown']);
  expect(f.binding.phase).toBe('wild');
});

test('a bond replaces the original companion in native allocation and publication order', () => {
  const f = fixture('bond'); f.allowMount(); f.binding.startBreaking();
  let previous = 0;
  for (let tick = 0; tick < 220 && f.binding.phase === 'breaking'; tick++) {
    const balance = f.binding.view.balance;
    f.hud.lean = Math.max(-1, Math.min(1, balance * 8 + (balance - previous) * 20)); previous = balance;
    f.events.length = 0; f.binding.update(.1);
  }
  expect(f.binding.phase).toBe('bonded'); expect(f.binding.companion?.entityId).toBe('bonded-2');
  const first = f.events.indexOf('breaking:false');
  expect(first).toBeGreaterThanOrEqual(0);
  expect(f.events.slice(first)).toEqual(['breaking:false', 'dismount:false', 'release', 'hide:wild', 'remove:bonded-1', 'retire:bonded-1',
    'spawn:bonded-2', 'add:bonded-2', 'mount:bonded-2:false', 'write:better-bond', 'notice:Better bonded', 'bonded:bonded-2']);
  const wire = f.binding.snapshot(); f.binding.restore(wire, [f.herd.stallion, f.binding.companion].filter((actor): actor is TamingHorse => actor !== null));
  expect(f.binding.snapshot()).toBe(wire);
});
