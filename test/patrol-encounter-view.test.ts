import { afterEach, expect, test, vi } from 'vitest';
import { Bone, BoxGeometry, BufferGeometry, Mesh, MeshBasicMaterial, MeshLambertMaterial, PerspectiveCamera, Scene, Skeleton, SkinnedMesh, Vector3, type Vector2 } from 'three';
import * as v from 'valibot';
import { Scope } from '../src/engine/app/scope';
import { app } from '../src/engine/app/runtime';
import type { Game } from '../src/engine/core/Game';
import type { Player } from '../src/engine/player/Player';
import type { Forest } from '../src/engine/world/forest/Forest';
import type { SkyRig } from '../src/engine/world/skyRig';
import { overrideTerrain } from '../src/engine/world/Heightfield';
import { CueDirector } from '../src/game/audio/cueDirector';
import { EncounterPatrolSchema } from '../src/game/boss/encounterPatrol';
import { PatrolEncounterView } from '../src/game/boss/presentation';
import { ReturnProgram } from '../src/game/population/returnProgram';
import night from '../src/shards/nalati-grasslands/data/night.generated.json' with { type: 'json' };

// A made-up orchard watch (the patrol view's fixture second user): lantern wraiths and their warden riding its own rows,
// looks, figures, cues, targets and a plain dart, on the patrol law Nalati's ghost riders share.
const look = (key: string) => ({ key, common: '#include <common>\nuniform float uGFade;\nuniform float uGTime;', fragment: '#include <dithering_fragment>\ngl_FragColor.rgb *= uGFade;' });
const view = { looks: { scout: look('orchard-scout'), warden: look('orchard-warden'), hush: look('orchard-hush') }, quietLook: 'hush', quietScale: 2,
  figure: { bone: 'saddle' }, seat: [0, 1, 0], states: { fade: 'fade', dying: 'dying', dead: 'dead' },
  cues: { form: 'cue.orchard.form', tear: 'cue.orchard.tear', loose: 'cue.orchard.loose', hurt: 'cue.orchard.hurt', impact: 'cue.orchard.impact' },
  lift: { form: 0.5, loose: 0.2 }, trail: { cue: 'cue.orchard.trail', rate: 0, back: 1 }, aim: 'aim', damage: 7,
  targets: [{ at: [0, 1.5, 0], radius: 0.3, head: true }],
  arrow: { geometry: { data: new BufferGeometry().copy(new BoxGeometry(0.02, 0.02, 0.5)).toJSON().data }, colour: [1, 0.8, 0.3], renderOrder: 9, length: 0.5, gravity: 4, drag: 0, windCoupling: 0, bury: 0, recover: 0,
    maxFlying: 4, maxStuck: 0, stick: false, hitsAnimals: false, puffs: false, hurtsPlayer: { radius: 0.4, height: 1.8 } } };
const patrol = { ...v.parse(EncounterPatrolSchema, night.patrol), actors: { kind: 'orchard-watch', variant: 'scout', leader: 'warden', count: 2, herd: -2,
  player: { x: 'px', z: 'pz' }, target: { x: 'tx', z: 'tz' }, steering: { tx: 'tx', tz: 'tz', v: 'v', turn: 'turn' } } };
const ids = ['form', 'tear', 'loose', 'hurt', 'impact', 'trail'].map(id => `cue.orchard.${id}`);

function body(id: string, x: number, z: number, yaw: number, variant: string) {
  const saddle = new Bone(); saddle.name = 'saddle';
  const mesh = new SkinnedMesh(new BufferGeometry(), new MeshBasicMaterial()); mesh.add(saddle); mesh.bind(new Skeleton([saddle]));
  return { entityId: id, kind: 'orchard-watch', position: new Vector3(x, 0, z), yaw, variant, herd: 0, alive: true, hidden: false, scale: 1, mesh,
    mem: {} as Record<string, number>, applyDamage: () => false, damageFor: () => 0 };
}
type Body = ReturnType<typeof body>;

let restore = (): void => undefined;
afterEach(() => { restore(); vi.restoreAllMocks(); });

function orchard() {
  restore = overrideTerrain({ heightAt: () => 2 });
  const scope = new Scope('orchard-watch'), scene = new Scene(), game = {} as Game;
  Object.defineProperties(game, { levelScope: { value: scope }, app: { value: app }, scene: { value: scene }, camera: { value: new PerspectiveCamera(60) },
    renderer: { value: { getDrawingBufferSize: (out: Vector2) => out.set(800, 600) } } });
  const player = { position: new Vector3(0, 2, 30) } as Player, cues = new CueDirector(game, { version: 1, fields: [], rows: ids.map(id => ({ id, vfx: [] })) });
  const heard: { id: string; at: number[] }[] = [];
  vi.spyOn(cues, 'cue').mockImplementation((id, at) => { heard.push({ id, at: at.toArray() }); });
  const figure = new BoxGeometry(0.4, 1, 0.4), bodies: Body[] = [];
  const watch = new PatrolEncounterView<Body>({ patrol, motion: night.motion, view }, ReturnProgram.page(night.program),
    { game, sky: {} as SkyRig, player, forest: {} as Forest, cues, figures: { scout: figure, warden: figure, hush: figure } });
  watch.attachActors({ factory: { model: () => undefined }, spawn: (_kind, x, z, yaw, variant) => { const b = body(String(bodies.length), x, z, yaw, variant); bodies.push(b); return b; }, retire: a => { a.hidden = true; } });
  return { watch, heard, bodies, scene, player, scope };
}

test('an orchard watch forms its own line in its own looks and figures, and a quiet one grows', () => {
  const { watch, heard } = orchard();
  const line = watch.spawnLine({ captain: true, at: 0 });
  expect(line.map(a => a.variant)).toEqual(['warden', 'scout']);
  for (const a of line) {
    const material = a.mesh.material;
    expect(material).toBeInstanceOf(MeshLambertMaterial);
    if (!(material instanceof MeshLambertMaterial)) throw new Error('Missing look');
    expect(material.name).toBe(`orchard-${a.variant}`);
    const figure = a.mesh.skeleton.getBoneByName('saddle')?.children[0];
    expect(figure).toBeInstanceOf(Mesh); expect(figure?.name).toBe(`orchard-${a.variant}-figure`);
    a.mesh.castShadow = true; expect(a.mesh.castShadow).toBe(false);
  }
  expect(heard.filter(row => row.id === 'cue.orchard.form').map(row => row.at[1])).toEqual([2.5, 2.5]);
  const quiet = watch.spawnRider({ x: 5, z: 6, yaw: 0, quiet: true });
  expect(quiet?.scale).toBe(2); expect(quiet?.mesh.material).toHaveProperty('name', 'orchard-hush');
});

test('its targets meet a ray first; its arrows hand their hits back as data and play its cues', () => {
  const { watch, heard, player } = orchard();
  const a = watch.spawnRider({ x: 0, z: 0, yaw: 0 }); if (a === null) throw new Error('Missing watch');
  a.mesh.updateMatrixWorld(true);
  const hit = watch.target(new Vector3(0, 1.5, -10), new Vector3(0, 0, 1), 50, null);
  expect(hit?.animal).toBe(a); expect(hit?.headshot).toBe(true); expect(hit?.distance).toBeCloseTo(9.7, 5);
  expect(watch.target(new Vector3(0, 1.5, -10), new Vector3(0, 0, 1), 50, { animal: a, point: new Vector3(), distance: 3, headshot: false })?.distance).toBe(3);
  heard.length = 0;
  vi.spyOn(watch.arrows, 'update').mockImplementation(() => { watch.arrows.onPlayerHit?.(player.position, new Vector3(0, 0, 1)); });
  const hits = watch.update(0.05, 1, { hold: 1, night: 1 });
  expect(hits).toEqual([{ damage: 7, from: null }]); expect(heard.map(row => row.id)).toContain('cue.orchard.hurt');
  expect(watch.update(0.05, 1.05, { hold: 1, night: 1 }).length).toBe(1);
  vi.restoreAllMocks(); expect(watch.update(0.05, 1.1, { hold: 1, night: 1 })).toEqual([]);
});

test('the member\'s fade drives its looks, and a dying one tears into its own mist until it retires', () => {
  const { watch, heard } = orchard();
  const a = watch.spawnRider({ x: 0, z: 0, yaw: 0 }); if (a === null) throw new Error('Missing watch');
  const rider = watch.riders[0]; if (rider === undefined) throw new Error('Missing rider');
  rider.law.state['fade'] = 0.4; watch.update(0.05, 0, { hold: 1, night: 1 });
  expect(rider.fades.map(fade => fade.value)).toEqual([0.4, 0.4]);
  heard.length = 0; watch.dissolve(a); expect(rider.law.state['dying']).toBeGreaterThan(0);
  watch.update(0.05, 0.05, { hold: 1, night: 1 });
  expect(heard.some(row => row.id === 'cue.orchard.tear')).toBe(true);
  for (let i = 0; i < 80 && watch.riders.length > 0; i++) watch.update(0.1, i * 0.1, { hold: 1, night: 1 });
  expect(watch.riders).toEqual([]); expect(a.hidden).toBe(true);
});

test('view rows refuse a look without its figure', () => {
  const { scope } = orchard(), game = {} as Game;
  Object.defineProperties(game, { levelScope: { value: scope }, app: { value: app }, scene: { value: new Scene() } });
  expect(() => new PatrolEncounterView<Body>({ patrol, motion: night.motion, view }, ReturnProgram.page(night.program),
    { game, sky: {} as SkyRig, player: { position: new Vector3() } as Player, forest: {} as Forest, cues: {} as CueDirector, figures: {} })).toThrow('figure');
});
