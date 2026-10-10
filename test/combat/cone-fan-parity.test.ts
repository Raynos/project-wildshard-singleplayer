// @vitest-environment happy-dom
import * as THREE from 'three';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- The trace builds the fan from its committed baked shapes.
import { readFileSync } from 'node:fs';
import { app } from '../../src/engine/app/runtime';
import type { App } from '../../src/engine/app/app';
import type { Actor, DamageDealt, DamageRequest } from '../../src/engine/combat/pipeline';
import { WarFan } from '../../src/shards/far-reach/weapons/WarFan';
import { loadSkyFan } from '../../src/shards/far-reach/weapons/fanShapes';
import { legacyDouble } from '../fake/FakeGame';
import { digest, geometrySum, isMesh, materialRow, mockCanvas, objectRow, round, v3 } from '../fake/weaponParity';

/**
 * SHARD-PLATFORM M3: Sky Reach's war fan as a row over the platform's cone fan (a cone-gust + arc-slash family). The
 * trace was pinned from the pre-M3 `class WarFan extends Weapon` (HEAD 249b30d79) and must stay equal: twenty scripted
 * seconds of light swings (some cooling down), the HEAVY key, a held charge released as the heavy, GUSTs (some cooling
 * down) along a turning aim, a target dying, a stowed fan, a portrait-free holster, recording the viewmodel's every part
 * (the hold, the move poses, the breath, the charge draw, the tassel), the hits through the damage pipeline (every request
 * field), the impulses, the swing / gust / hit / fire hooks and the built model.
 */
beforeAll(async () => {
  // the fan's baked shapes, served from the committed bake as the browser fetches them
  vi.stubGlobal('fetch', (url: string) => Promise.resolve(new Response(readFileSync(`public${url}`))));
  await loadSkyFan();
  vi.unstubAllGlobals();
});
beforeEach(() => { app.rng.seed(11); mockCanvas(); });
afterEach(() => { vi.restoreAllMocks(); });

interface Dummy { position: THREE.Vector3; actor: Actor; impulse: (velocity: THREE.Vector3) => void }

function trace(): { row: unknown; events: unknown[] } {
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
  const fan = new WarFan(fakeApp, () => all);
  let board = false;
  fan.stowed = () => board;
  fan.onSwing = (heavy) => { events.push(['swing', heavy]); };
  fan.onGust = (from, dir) => { events.push(['gust', ...v3(from), ...v3(dir)]); };
  fan.onHit = (id, headshot, killed) => { events.push(['hit', id, headshot, killed]); };
  fan.onFire = () => { events.push(['fire']); };
  const built = { children: fan.model.children.length, row: [fan.row.id, fan.meta.name], meshes: [] as unknown[] };
  fan.model.traverse((o) => { if (isMesh(o)) built.meshes.push({ geo: geometrySum(o.geometry), verts: o.geometry.getAttribute('position').count, order: o.renderOrder, mat: materialRow(o.material) }); });
  const frames: unknown[] = [];
  const dt = 1 / 60;
  for (let i = 0; i < 1200; i++) {
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
    frames.push({ i, motion: fan.motion, k: round(fan.motionK), charge: round(fan.charge), visible: fan.model.visible,
      model: objectRow(fan.model) });
  }
  // the direct contacts: a slash and a blow from a fixed place, as the host's adapter and the tests call them
  const direct = [fan.slash(new THREE.Vector3(0, 1.4, 0), new THREE.Vector3(0, 0, -1), true), fan.blow(new THREE.Vector3(0, 1.4, 0), new THREE.Vector3(0, 0, -1))];
  const windows: string[] = [];
  for (let w = 0; w < frames.length; w += 30) windows.push(digest(JSON.stringify(frames.slice(w, w + 30))));
  return { row: { built, events: digest(JSON.stringify(events)), eventCount: events.length, direct, last: frames.at(-1), windows }, events };
}

describe('the war fan on the cone fan family keeps its pre-M3 trace', () => {
  it('builds the same viewmodel and plays the same scripted twenty seconds', () => {
    const { row, events } = trace();
    expect(row).toMatchSnapshot();
    // the trace walked what it claims: light and heavy swings, gusts, impulses, a kill and the wind's own hits
    const kinds = new Set<unknown>(events.map((e): unknown => Array.isArray(e) ? e[0] : null));
    for (const want of ['swing', 'gust', 'impulse', 'hit', 'fire', 'req']) expect(kinds, want).toContain(want);
    expect(events.some((e) => Array.isArray(e) && e[0] === 'swing' && e[1] === true)).toBe(true);
    expect(events.some((e) => Array.isArray(e) && e[0] === 'hit' && e[3] === true)).toBe(true);
    expect(events.some((e) => Array.isArray(e) && e[0] === 'req' && e.includes('far.fan.gust'))).toBe(true);
  });
});
