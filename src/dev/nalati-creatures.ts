// Dev entry: the Nalati creatures (row B4 of project/archive/2026-09-23-nalati.md) — wolves + Pack, wild horses + Herd, the sheep Flock + dog.
// http://127.0.0.1:5188/dev/nalati-creatures.html?chunk=nalati-grasslands&nolock=1&skipintro=1&x=0&z=150&yaw=3.14&pitch=0
//   &scene=lineup   every creature in a row 9–15 m ahead, side-on, AI off (&gait=walk|trot|gallop&phase=0.3 freezes a gait;
//                   &knob=rear|buck|howl|snarl|low sets that pose knob on everyone)
//   &scene=pack     a 5-wolf pack 40 m ahead (&hunt=1: it already knows you — shadow → encircle → lunges)
//   &scene=herd     the horse herd 35 m ahead with foals and the black stallion (&stampede=4: stampede after 4 s)
//   &scene=flock    40 sheep + the sheepdog 18 m ahead (&wolf=1: one wolf trots through them)
//   &scene=crowd    5 wolves + 15 horses + 40 sheep + the dog in front of you (the perf case; &scene=none for the baseline)
//   &scene=all      (default) the shard's NALATI_WILDLIFE layout (den, horse plains, pasture)
//   &grass=1        the grass carpet (+ grassHeightAt / trample / wind hooked into wildEnv when the grass modules exist)
//   &calm=1         animals ignore you
// window.__world = { ...bootstrap(), animals, wildlife, wildEnv, stats() }
import * as THREE from 'three';
import { bootstrap } from '../core/bootstrap';
import { AnimalManager } from '../entities/AnimalManager';
import { Wildlife, type WildlifeLayout } from '../entities/Wildlife';
import { wildEnv } from '../entities/wildEnv';
import { Grass } from '../world/Grass';
import { heightAt } from '../world/Heightfield';
import { wireNalati } from '../nalati';
import type { Animal } from '../entities/Animal';

if (!new URLSearchParams(location.search).has('chunk')) location.search += `${location.search ? '&' : '?'}chunk=nalati-grasslands`;

const world = await bootstrap();
const { game, sky, forest, player, params, num, chunk } = world;
const nalati = chunk.style === 'painterly' ? await wireNalati({ game, sky, player, forest, chunk }) : null;

// the grass agent's modules (B1), picked up if they are in the tree (glob: a missing file is just an empty record)
interface TrampleMod { trample: { push: (x: number, z: number, r: number, s?: number, vx?: number, vz?: number) => void }; grassHeightAt: (x: number, z: number) => number }
interface WindMod { wind: { dirX: number; dirZ: number; speed: number } }
const trampleMods = import.meta.glob<TrampleMod>('../world/GrassTrample.ts', { eager: true });
const windMods = import.meta.glob<WindMod>('../world/Wind.ts', { eager: true });
const tm = Object.values(trampleMods)[0], wm = Object.values(windMods)[0];
let grass: Grass | null = null;
if (params.has('grass')) { grass = new Grass(sky, forest).build(); game.scene.add(grass.group); }
if (tm !== undefined) { wildEnv.grassHeightAt = tm.grassHeightAt; wildEnv.trample = (x, z, r, s, vx, vz) => { tm.trample.push(x, z, r, s, vx, vz); }; }

const animals = new AnimalManager(game.scene, sky, forest, { style: 'painterly' }).build();
animals.calm = params.has('calm');
animals.onCharge = (a, dmg) => console.log('[creatures] hurt by', a.kind, a.variant, dmg);
animals.onKill = (a) => console.log('[creatures] kill', a.kind, a.variant);
wildEnv.onEvent = (name, x, z) => console.log('[creatures] event', name, x.toFixed(0), z.toFixed(0));
wildEnv.onKnockdown = () => console.log('[creatures] knocked down');

const fwd = new THREE.Vector3(player.forward.x, 0, player.forward.z).normalize();
const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
const ahead = (d: number, side = 0): [number, number] => [player.position.x + fwd.x * d + right.x * side, player.position.z + fwd.z * d + right.z * side];
const facingPlayer = Math.atan2(-fwd.x, -fwd.z);

const scene = params.get('scene') ?? 'all';
let layout: WildlifeLayout = { packs: [], herds: [], flocks: [] };
if (scene === 'all') layout = (await import('../entities/Wildlife')).NALATI_WILDLIFE;
if (scene === 'pack') { const [x, z] = ahead(num('dist', 40)); layout.packs.push({ x, z, variants: ['alpha', 'grey', 'tawny', 'grey', 'scout'] }); }
if (scene === 'herd') { const [x, z] = ahead(num('dist', 35)); layout.herds.push({ x, z, mares: num('mares', 11), foals: 3, stallion: true }); }
if (scene === 'crowd') {   // the perf case: 5 wolves + 15 horses + 40 sheep all in view (&calm=1 keeps them in place)
  const [px, pz] = ahead(16, -2), [hx, hz] = ahead(42, 1), [fx, fz] = ahead(28, 3);
  layout.packs.push({ x: px, z: pz, variants: ['alpha', 'grey', 'tawny', 'grey', 'scout'] });
  layout.herds.push({ x: hx, z: hz, mares: 11, foals: 3, stallion: true });
  layout.flocks.push({ x: fx, z: fz, count: 40, dog: true, range: 12 });
}
if (scene === 'flock') { const [x, z] = ahead(num('dist', 18)); layout.flocks.push({ x, z, count: num('sheep', 40), dog: true, range: 20 }); }
const wildlife = new Wildlife(animals, { scene: game.scene, sky, seed: chunk.seed, layout }).build();
wildlife.onSound = (name) => { if (params.has('logsound')) console.log('[creatures] sound', name); };

// the line-up: side-on, AI off (spawned outside any herd, so their think only holds still)
const lineup: Animal[] = [];
if (scene === 'lineup') {
  const side = facingPlayer + Math.PI / 2;
  const row: [string, string, number, number][] = [
    ['wolf', 'grey', 9, -6.5], ['wolf', 'tawny', 9, -4.8], ['wolf', 'alpha', 9, -2.9], ['wolf', 'scout', 9, -1.2], ['wolf', 'dark', 9, 0.5], ['sheepdog', 'collie', 9, 2.0],
    ['horse', 'bay', 14, -8], ['horse', 'chestnut', 14, -5.3], ['horse', 'stallion', 14, -2.4], ['horse', 'foal-bay', 12.5, -0.2], ['horse', 'dun', 14, 2.2], ['horse', 'grey', 14, 4.9], ['horse', 'black', 14, 7.6],
  ];
  for (const [kind, v, d, s] of row) {
    const [x, z] = ahead(d, s);
    const a = animals.spawn(kind, x, z, side, v);
    lineup.push(a);
    const gait = params.get('gait');
    if (gait !== null) a.debugGait = { gait, phase: num('phase', 0.3) };
    const knob = params.get('knob');
    if (knob !== null) a.mem[knob] = 1;
  }
  const [fx, fz] = ahead(7, 4.5);
  wildlife.spawnFlock(fx, fz, 7, false, 3);
}
const hunt = params.has('hunt');
const stampedeAt = num('stampede', -1);
if (scene === 'flock' && params.has('wolf')) { const [x, z] = ahead(60, -20); wildlife.spawnPack(x, z, ['grey']); }

let t0 = -1;
game.onUpdate((dt, t) => {
  if (t0 < 0) t0 = t;
  if (hunt) for (const p of wildlife.packs) p.awareness = Math.max(p.awareness, 0.6);   // it knows you're here
  animals.update(dt, t, player.position, player.sprinting);
  wildlife.update(dt, t, player);
  if (wm !== undefined) { wildEnv.wind.x = wm.wind.dirX; wildEnv.wind.z = wm.wind.dirZ; wildEnv.wind.strength = Math.min(1, wm.wind.speed / 10); }
  grass?.update(dt, player.position);
  nalati?.update(dt, t);
  if (stampedeAt >= 0 && t - t0 > stampedeAt) { for (const h of wildlife.herds) h.stampede(player.position.x, player.position.z); t0 = Infinity; }
  for (const a of lineup) { if (params.has('look')) { a.lookTarget.copy(player.position); a.lookWeight = 1; } }
});

// click: shoot a ray (animals first, then sheep)
const dir = new THREE.Vector3();
window.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  game.camera.getWorldDirection(dir);
  const hit = animals.raycast(game.camera.position, dir, 200);
  if (hit) { const died = animals.hit(hit, dir); console.log('[creatures] hit', hit.animal.kind, hit.animal.variant, hit.headshot ? 'HEAD' : 'body', 'hp', hit.animal.hp, died ? 'DIED' : ''); return; }
  const sh = wildlife.raycastSheep(game.camera.position, dir, 200);
  if (sh) { wildlife.killSheep(sh); console.log('[creatures] sheep down', sh.index); return; }
  const p = game.camera.position.clone().addScaledVector(dir, 40);
  wildlife.disturb(p.x, p.z);
});

function stats(): Record<string, unknown> {
  return {
    calls: game.lastFrame.calls, tris: game.lastFrame.triangles, fps: game.stats.fps,
    animals: animals.animals.length,
    packs: wildlife.packs.map((p) => ({ phase: p.phase, aware: p.awareness.toFixed(2), alive: p.alive })),
    herds: wildlife.herds.map((h) => ({ mode: h.mode, stallion: h.stallionState, stampede: h.stampeding, alert: h.alert.toFixed(0), trust: h.trust })),
    flocks: wildlife.flocks.map((f) => ({ alive: f.alive, panic: f.panicking })),
    grassHere: wildEnv.grassHeightAt(player.position.x, player.position.z).toFixed(2), ground: heightAt(player.position.x, player.position.z).toFixed(1),
  };
}
Object.assign(window, { __world: { ...world, animals, wildlife, wildEnv, stats, THREE } });
game.buildComposer();
game.start();
