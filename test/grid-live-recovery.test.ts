// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the shipped native physics, not an inline browser WASM import.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { PerspectiveCamera } from 'three';
import { App } from '../src/engine/app/app';
import { Scope } from '../src/engine/app/scope';
import { SaveStore } from '../src/engine/saves/store';
import { loadRapier } from '../src/engine/physics/rapier';
import { ReadinessWalls } from '../src/engine/physics/readinessWalls';
import { tagCollider } from '../src/engine/physics/surface';
import { PLATFORM_COLLIDER_OWNER } from '../src/engine/physics/stripColliders';
import { groups } from '../src/engine/physics/groups';
import { createSimHost } from '../src/engine/sim';
import { generateStrip } from '../src/engine/sim/strips';
import { EquipmentService } from '../src/engine/combat/EquipmentService';
import { CombatPipeline } from '../src/engine/combat/pipeline';
import { installPlayerDeath } from '../src/engine/ui/playerDeath';
import { installBounds } from '../src/engine/world/bounds';
import { EmptyEquipment } from '../src/game/shardfile/emptyEquipment';
import { GridAssembly } from '../src/game/grid/assembly';
import { LiveGridSession } from '../src/game/grid/liveSession';
import { PageResidency } from '../src/game/grid/pageResidency';
import { SIM_LEVEL } from './fixtures/sim-level/level';
import { MemoryStorage } from './setup';

async function open(homeFloor?: number) {
  const rapier = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')).buffer);
  const host = createSimHost({ ...SIM_LEVEL, ground: { size: 600, height: 0 }, entities: [], quests: [] }, { rapier });
  const restore = ['window', 'document'].map(name => {
    const before = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, value: new EventTarget() });
    return () => { if (before === undefined) Reflect.deleteProperty(globalThis, name); else Object.defineProperty(globalThis, name, before); };
  });
  const scope = new Scope('live.recovery'), app = new App(), post: (() => void)[] = [];
  const assembly = new GridAssembly({ developer: false, devserver: false }), home = assembly.cell('driftwood-isle');
  const owner = new PageResidency(), residency = owner.admitHome(home.instance, 1_000_000);
  scope.onDispose(() => { owner.dispose(); });
  const profile = assembly.emptyNeighbour.edge;
  const strips = (['east', 'west', 'north', 'south'] as const).map(edge => {
    const axis = edge === 'east' || edge === 'west' ? 'x' : 'z', sign = edge === 'east' || edge === 'north' ? 1 : -1;
    return generateStrip({ id: `gap.${axis}.${edge}`, axis, origin: { x: axis === 'x' ? sign * 277.5 : 0, z: axis === 'z' ? sign * 277.5 : 0 },
      profiles: [profile, profile], adjacent: [home], observations: [{ entryWidth: 8 }, { entryWidth: 8 }] });
  });
  const traveller = { position: host.player.position, yaw: 0, motor: host.releasePlayerMotor(), camera: new PerspectiveCamera(), hoverSpeedLimit: null, onGround: true,
    hover: false, spawn: (x: number, z: number, yaw: number, y: number) => { traveller.position.set(x, y, z); traveller.yaw = yaw; },
    bindFrame: (_physics: typeof host.physics, motor: typeof host.player.motor) => { traveller.motor = motor; } };
  const session = new LiveGridSession({ assembly, home, physics: host.physics, scope, strips, allocator: owner.allocator, residency,
    walls: new ReadinessWalls(host.physics, [], scope), neighbourEdges: () => [], rimEdges: () => [] }, {
    traveller, health: host.player.health, equipment: new EquipmentService(new EmptyEquipment(), { scope }), events: host.events,
    saves: new SaveStore({ local: new MemoryStorage(), session: null }), checkpoint: () => true, catalogue: [],
    ...(homeFloor === undefined ? {} : { homeFallFloor: homeFloor }), setPhysics: () => undefined,
    onFixedPre: () => undefined, onFixedPost: fn => { post.push(fn); }, onInput: () => undefined, onUpdate: () => undefined,
  });
  const combat = new CombatPipeline(host.events, scope, () => host.physics);
  let deaths = 0;
  installPlayerDeath(host.events, scope, host.player.health, { position: () => traveller.position, died: () => {
    deaths++;
    const spawn = session.spawn();
    if (spawn === null) traveller.spawn(0, 0, 0, 0); else traveller.spawn(spawn.x, spawn.z, spawn.yaw, spawn.y ?? 0);
  } });
  installBounds(app, scope, { x0: -100, x1: 100, z0: -100, z1: 100, floor: -10 }, {
    player: traveller, grid: () => true, fallFloor: () => session.fallFloor(), floorAt: () => 0, suspended: () => false,
    toSpawn: () => { combat.fall(host.player.health, traveller.position, { kind: 'out-of-world', label: '' }); },
  });
  const bounds = app.systemsByPhase().update[0]; if (bounds === undefined) throw new Error('Missing live fall path');
  host.physics.step();
  const observe = (x: number, y: number, z: number, grounded = true, ticks = 1) => {
    traveller.position.set(x, y, z); traveller.onGround = grounded;
    for (let tick = 0; tick < ticks; tick++) for (const run of post) run();
  };
  return { host, session, traveller, observe, deaths: () => deaths,
    fall: (x: number, y: number, z: number) => { observe(x, y, z, false); bounds.run(1 / 60, 0); host.player.health.update(1 / 60); host.events.flush('update'); },
    close: () => { scope.dispose(); traveller.motor.dispose(); host.dispose(); for (const reset of restore) reset(); },
  };
}

it('recovers every declared 8 m entry through the live death path, and resets on an airborne exit', async () => {
  const live = await open();
  try {
    for (const edge of ['north', 'south', 'east', 'west'] as const) {
      live.observe(281.1, 0, 40);
      const sign = edge === 'north' || edge === 'east' ? 1 : -1, axis = edge === 'north' || edge === 'south' ? 'z' : 'x';
      const before = { x: 3.9, z: 3.9 }; before[axis] = sign * 250.5;
      const after = { ...before }; after[axis] = sign * 249.5;
      live.observe(before.x, 0, before.z); live.observe(after.x, 0, after.z);
      expect(live.session.ownsHomeRecovery()).toBe(true);
      live.fall(after.x, -251, after.z); expect(live.traveller.position.x).toBe(0); expect(live.traveller.position.z).toBe(0);
      live.observe(220, 0, 40, true, 300); expect(live.session.ownsHomeRecovery()).toBe(true);
      live.observe(251, 3, 40, false); live.fall(251, -61, 40);
      expect(live.traveller.position.x).toBeCloseTo(281.1); expect(live.traveller.position.z).toBe(40);
    }
    expect(live.deaths()).toBe(8);
  } finally { live.close(); }
});

it('keeps shallow hops, outside-opening crossings, interrupted time and strip contacts on road recovery', async () => {
  const live = await open();
  try {
    const roadFall = () => { live.fall(220, -251, 40); expect(live.traveller.position.x).toBeCloseTo(281.1); expect(live.traveller.position.z).toBe(40); };
    live.observe(281.1, 0, 40); live.observe(249, 0, 40, true, 600); roadFall(); // 1 m in, even after ten seconds
    live.observe(250.5, 0, 4.01); live.observe(249.5, 0, 4.01); roadFall(); // beyond the admitted opening
    live.observe(250.5, 0, 0, false); live.observe(249.5, 0, 0, false); roadFall(); // airborne feet at road level
    live.observe(250.5, 3, 0); live.observe(249.5, 3, 0); roadFall(); // fence top cannot count as entry asphalt
    live.observe(250.5, 0, 0); live.observe(220, 0, 0); roadFall(); // a teleport is not an entryway crossing
    live.observe(230.01, 0, 40, true, 600); roadFall(); // less than 20 m inside
    live.observe(230, 0, 40, true, 299); live.observe(230, 0, 40, false); live.observe(230, 0, 40, true, 299); roadFall();
    const shared = live.host.physics.world.createCollider(live.host.physics.R.ColliderDesc.cuboid(2, 0.1, 2).setTranslation(220, 1, 40).setCollisionGroups(groups('WORLD')));
    tagCollider(shared, 'stone', PLATFORM_COLLIDER_OWNER); live.host.physics.step();
    live.observe(220, 1.1, 40, true, 600); roadFall(); // genuine shared collider contact cannot own a shard checkpoint
    live.host.physics.world.removeCollider(shared, true); live.host.physics.step();
    live.observe(230, 0, 40, true, 300); live.fall(230, -251, 40); expect(live.traveller.position.x).toBe(0);
    expect(live.deaths()).toBe(9);
  } finally { live.close(); }
});

it('uses the cube bottom inside and -60 outside regardless of motor frame, with a higher declared floor', async () => {
  for (const homeFloor of [undefined, -10]) {
    const live = await open(homeFloor);
    try {
      live.observe(281.1, 0, 40);
      const inside = homeFloor ?? -250;
      live.fall(245, inside + 0.01, 40); expect(live.deaths()).toBe(0);
      live.fall(245, inside - 0.01, 40); expect(live.deaths()).toBe(1); expect(live.traveller.position.x).toBeCloseTo(281.1);
      live.fall(251, -59.99, 40); expect(live.deaths()).toBe(1);
      live.fall(251, -60.01, 40); expect(live.deaths()).toBe(2); expect(live.session.frame()).toBe('driftwood-isle');
    } finally { live.close(); }
  }
});
