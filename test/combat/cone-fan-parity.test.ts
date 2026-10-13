// @vitest-environment happy-dom
import * as THREE from 'three';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- The trace builds the fan from its committed baked shapes.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Original full-precision quaternion pins depend on the test CPU architecture.
import process from 'node:process';
import { app } from '../../src/engine/app/runtime';
import type { App } from '../../src/engine/app/app';
import type { Actor, DamageDealt, DamageRequest } from '../../src/engine/combat/pipeline';
import { SKY_ITEMS } from '../../src/shards/far-reach/data/items';
import { FAN_GUST_MODULE } from '../../src/shards/far-reach/data/fanGustModule';
import { bindMeleeContacts, createMeleeScriptDriver, startMeleeSecondary } from '../../src/game/plugin/simulation';
import { createComposedMoverHost } from '../../src/game/plugin/mover';
import { WarFan } from '../../src/shards/far-reach/runtime/weapons/heldFan';
import { loadSkyFan } from '../../src/shards/far-reach/weapons/fanShapes';
import { preloadSkyMeshes, skyHd } from '../../src/shards/far-reach/world/meshes';
import { legacyDouble } from '../fake/FakeGame';
import { digest, geometrySum, isMesh, materialRow, mockCanvas, objectRow, portraitHeldFrame, portraitSequenceHash, round, v3 } from '../fake/weaponParity';

/**
 * SHARD-PLATFORM M3: Sky Reach's war fan as a row over the platform's cone fan (a cone-gust + arc-slash family). The
 * trace was pinned from the pre-M3 `class WarFan extends Weapon` (HEAD 249b30d79) and must stay equal: twenty scripted
 * seconds of light swings (some cooling down), the HEAVY key, a held charge released as the heavy, GUSTs (some cooling
 * down) along a turning aim, a target dying, a stowed fan, a portrait-free holster, recording the viewmodel's every part
 * (the hold, the move poses, the breath, the charge draw, the tassel), the hits through the damage pipeline (every request
 * field), the impulses, the swing / gust / hit / fire hooks and the built model.
 */
beforeAll(async () => {
  // the fan's baked shapes and the hero hand's model, served from the committed files as the browser fetches them, through
  // the game's own loaders; the models' embedded maps decode to a stand-in bitmap (happy-dom has no image decoder)
  vi.stubGlobal('fetch', (input: unknown) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url.startsWith('blob:') || url.startsWith('data:')) return Promise.resolve(new Response(new Uint8Array(1)));
    return Promise.resolve(new Response(readFileSync(`public${new URL(url, 'http://localhost').pathname}`)));
  });
  vi.stubGlobal('createImageBitmap', () => Promise.resolve({ width: 1, height: 1, close: () => undefined }));
  await Promise.all([loadSkyFan(), preloadSkyMeshes()]);
  vi.unstubAllGlobals();
  // the game draws the held fan in the textured hero hand: a trace without it would pin the hand-less fallback
  if (skyHd('hand-hd') === null) throw new Error('the hero hand did not load');
});
beforeEach(() => { app.rng.seed(11); mockCanvas(); });
afterEach(() => { vi.restoreAllMocks(); });

/** The original 9e2005714 poses, before HeldPlayback, on each supported CPU.
 * Native trig changes 40 quaternion components and one pendant Euler angle
 * by at most 2.22e-16 across
 * arm64/x64. All 1200 original/new frame hashes match within each architecture.
 * Keep the raw byte check exact rather than rounding away pose differences. */
const originalPortraitHashes = new Map([
  ['arm64', '84898c52936884c1fff1c27e557441993ade7fa1b7269551b53ab9b2fb9d009c'],
  ['x64', 'c29d851e5b691e7ab8dd88eeb19947aeca4acf77f008e1b6d7c2970aa41c48d7'],
]);

function originalPortraitFor(arch: string): string {
  const hash = originalPortraitHashes.get(arch);
  if (hash === undefined) throw new Error(`Original portrait pin missing for ${arch}`);
  return hash;
}
const originalPortrait = originalPortraitFor(process.arch);

interface Dummy { position: THREE.Vector3; actor: Actor; impulse: (velocity: THREE.Vector3) => void }

async function trace(): Promise<{ row: unknown; events: unknown[] }> {
  const events: unknown[] = [];
  const hp = new Map<string, number>(), lives = new Map<string, { alive: boolean }>();
  const dummy = (id: string, x: number, y: number, z: number, health: number): Dummy => {
    hp.set(id, health);
    const life = { alive: true };
    const actor: Actor = { id, tags: ['actor.creature'], state: [], attributes: { health, maxHealth: health }, get alive() { return life.alive; },
      applyDamage: () => false };
    lives.set(id, life);
    return { position: new THREE.Vector3(x, y, z), actor, impulse: (v) => { events.push(['impulse', id, ...v3(v)]); } };
  };
  const ahead = dummy('ahead', 0.3, 1.4, -2.6, 400), side = dummy('side', 1.2, 1.3, -1.8, 40), far = dummy('far', -1, 1.5, -7.5, 400),
    behind = dummy('behind', 0, 1.4, 3, 400);
  const all = [ahead, side, far, behind];
  const combat = { hit: (req: DamageRequest): DamageDealt | null => {
    const id = req.target.id, left = (hp.get(id) ?? 0) - req.amount; hp.set(id, left);
    const killed = left <= 0 && req.target.alive;
    const life = lives.get(id); if (killed && life !== undefined) life.alive = false;
    events.push(['req', req.source, req.sourceTags, id, round(req.amount), ...v3(req.point), ...v3(req.dir), ...(req.from ? v3(req.from) : []),
      req.weaponId, req.moveId, req.surface, killed]);
    return { req, dealt: req.amount, killed };
  } };
  const aim = { origin: { x: 0, y: 1.68, z: 0 }, direction: { x: 0, y: 0, z: -1 } };
  let hosted = true;
  const host = { player: { sampleAimCommand: () => ({ origin: { ...aim.origin }, direction: { ...aim.direction } }) } };
  const fakeApp = legacyDouble<App>({ combat: legacyDouble<App['combat']>(combat), input: app.input });
  Reflect.defineProperty(fakeApp, 'equipmentHost', { get: () => hosted ? host : null });
  const row = SKY_ITEMS.rows[0];
  const items = await createMeleeScriptDriver(SKY_ITEMS, 'actor.player', new Map([[FAN_GUST_MODULE.hash,
    new Uint8Array(readFileSync(`src/shards/far-reach/assets/${FAN_GUST_MODULE.hash}`))]]), 6417);
  const lane = await createComposedMoverHost([], new Map(), () => [], { modules: items.modules, roles: [items.role()], seed: 6417 });
  const hook = items.hooks(lane.host).get(row.id); if (hook === undefined) throw new Error('Missing admitted fan hook');
  const fan = new WarFan(fakeApp, () => all, ports => bindMeleeContacts(row.id, row.contacts, { owner: 'env', ...ports }));
  fan.bindSecondary(family => startMeleeSecondary(family, hook, { tick: lane.host.currentTick, dt: 1 / 60, action: 3, move: 2 }), row.charge);
  let board = false;
  fan.stowed = () => board;
  fan.onSwing = (heavy) => { events.push(['swing', heavy]); };
  fan.onGust = (from, dir) => { events.push(['gust', ...v3(from), ...v3(dir)]); };
  fan.onHit = (id, headshot, killed) => { events.push(['hit', id, headshot, killed]); };
  fan.onFire = () => { events.push(['fire']); };
  // the built model's structure and materials are pinned; its geometry (vertex sums and counts) is the bake's and the hero
  // hand's, not this trace's (usage audit 2026-10-13): every mesh only has to carry real, finite vertices
  const built = { children: fan.model.children.length, row: [fan.row.id, fan.meta.name], meshes: [] as unknown[] };
  fan.model.traverse((o) => {
    if (!isMesh(o)) return;
    expect(o.geometry.getAttribute('position').count).toBeGreaterThan(0);
    expect(Number.isFinite(geometrySum(o.geometry))).toBe(true);
    built.meshes.push({ order: o.renderOrder, mat: materialRow(o.material) });
  });
  const frames: unknown[] = [], portrait: string[] = [];
  const dt = 1 / 60;
  for (let i = 0; i < 1200; i++) {
    lane.step(i + 1);
    const t = i * dt, yaw = Math.sin(t * 0.7) * 0.5, pitch = Math.sin(t * 0.4) * 0.15;
    aim.direction = { x: -Math.sin(yaw) * Math.cos(pitch), y: Math.sin(pitch), z: -Math.cos(yaw) * Math.cos(pitch) };
    fan.adsHeld = (i >= 200 && i < 260) || (i >= 600 && i < 620) || (i >= 1000 && i < 1080);
    fan.holster = i >= 1140 ? Math.min(1, (i - 1140) / 30) : 0;
    board = i >= 700 && i < 760;
    hosted = !(i >= 880 && i < 900);
    if (i === 820) fan.enabled = false;
    if (i === 860) fan.enabled = true;
    if (i === 500) { const life = lives.get('side'); if (life !== undefined) life.alive = true; hp.set('side', 40); }
    if ((i >= 10 && i < 180 && i % 13 === 0) || i === 300 || i === 720 || i === 830 || i === 890 || i === 950) fan.tryFire();
    if (i === 320 || i === 340 || i === 905 || i === 1100) fan.swing(true);
    if ((i >= 380 && i < 560 && i % 40 === 0) || i === 730 || i === 840 || i === 885 || i === 960 || i === 1150) fan.gust();
    fan.update(dt);
    portrait.push(portraitHeldFrame([fan.model]));
    frames.push({ i, motion: fan.motion, k: round(fan.motionK), charge: round(fan.charge), visible: fan.model.visible,
      model: objectRow(fan.model) });
  }
  // the direct contacts: a slash and a blow from a fixed place, as the host's adapter and the tests call them
  const direct = [fan.slash(new THREE.Vector3(0, 1.4, 0), new THREE.Vector3(0, 0, -1), true), fan.blow(new THREE.Vector3(0, 1.4, 0), new THREE.Vector3(0, 0, -1))];
  const windows: string[] = [];
  for (let w = 0; w < frames.length; w += 30) windows.push(digest(JSON.stringify(frames.slice(w, w + 30))));
  expect(lane.host.failureCount).toBe(0);
  expect(portraitSequenceHash(portrait)).toBe(originalPortrait);
  return { row: { built, events: digest(JSON.stringify(events)), eventCount: events.length, direct, last: frames.at(-1), windows }, events };
}

describe('the war fan on the cone fan family keeps its pre-M3 trace', () => {
  it('refuses a CPU without an original full-precision portrait pin', () => {
    expect(() => originalPortraitFor('riscv64')).toThrow('Original portrait pin missing for riscv64');
  });
  it('builds the same viewmodel and plays the same scripted twenty seconds', async () => {
    const { row, events } = await trace();
    expect(row).toMatchSnapshot();
    // the trace walked what it claims: light and heavy swings, gusts, impulses, a kill and the wind's own hits
    const kinds = new Set<unknown>(events.map((e): unknown => Array.isArray(e) ? e[0] : null));
    for (const want of ['swing', 'gust', 'impulse', 'hit', 'fire', 'req']) expect(kinds, want).toContain(want);
    expect(events.some((e) => Array.isArray(e) && e[0] === 'swing' && e[1] === true)).toBe(true);
    expect(events.some((e) => Array.isArray(e) && e[0] === 'hit' && e[3] === true)).toBe(true);
    expect(events.some((e) => Array.isArray(e) && e[0] === 'req' && e.includes('far.fan.gust'))).toBe(true);
  });
});
