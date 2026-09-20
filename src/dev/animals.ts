import * as THREE from 'three';
import { bootstrap } from '../core/bootstrap';
import { AnimalManager } from '../entities/AnimalManager';

/**
 * Dev entry for the huntable animals.
 *   /dev/animals.html?nolock=1&x=&z=&yaw=&pitch=
 *   &showcase=1   spawn a stag, a boar and a walking hind 4 m in front of the spawn point
 *   &debug=1      draw the hit volumes
 *   &calm=1       animals ignore the player (walk right up to a herd)
 *   &style=lowpoly  force the faceted Driftwood Isle animals (production reads ChunkDef.style)
 *   &sounder=5    a sounder of N idle boars 6 m ahead of the spawn (with &trot=1 / &walk=1 one of them circles)
 *   &species=crab|monkey|sailor  (&n=4 &dist=5 &variant=big) spawn N of that species ahead, running their OWN AI (SpeciesDef.think);
 *                 &pose=attack starts their attack every 2 s (the telegraph / strike close-ups); &pose=walk circles them
 * Click = shoot a ray from the camera (applies the DAMAGE model, prints the hit).
 * window.__world = { ...world, animals }
 */
const world = await bootstrap();
const { game, sky, forest, player, params } = world;
const style = params.get('style') === 'lowpoly' ? 'lowpoly' : undefined;
const animals = new AnimalManager(game.scene, sky, forest, { style }).build();
animals.debug = params.has('debug');
animals.calm = params.has('calm');
animals.onKill = (a) => console.log('[animals] kill', a.kind);
animals.onCharge = (a, dmg) => console.log('[animals] charge hit', a.kind, dmg);
animals.onSound = (name) => { if (params.has('logsound')) console.log('[animals] sound', name); };

const showcase: { a: ReturnType<AnimalManager['spawn']>; cx: number; cz: number }[] = [];
if (params.has('showcase')) {
  const sx = world.num('sx', 0), sz = world.num('sz', -235);
  // player faces -Z at yaw 0; the showcase sits 4 m ahead of the default spawn (override with ?sx=&sz=)
  const stag = animals.spawn('deer', sx - 1.6, sz - 4.5, Math.PI / 2 + 0.3, 'stag');
  const boar = animals.spawn('boar', sx + 1.8, sz - 3.6, Math.PI / 2 - 0.4, 'boar');
  stag.state = 'idle'; boar.state = 'idle';
  const hind = animals.spawn('deer', sx, sz - 9, 0, 'hind');
  showcase.push({ a: hind, cx: sx, cz: sz - 9 });
  // ?gait=walk&phase=0.3 freezes the stag and the boar at that gait phase (the hind keeps circling)
  const gait = params.get('gait');
  if (gait !== null) for (const s of [stag, boar]) s.debugGait = { gait, phase: world.num('phase', 0) };
  // freeze AI on the showcase animals: they are driven here
  for (const s of [stag, boar, hind]) s.herd = -2;
}
if (params.has('sounder')) {
  // centred `dist` m ahead of wherever the player spawned, facing
  const n = world.num('sounder', 5), dist = world.num('dist', 6);
  const fwd = player.forward, cx = player.position.x + fwd.x * dist, cz = player.position.z + fwd.z * dist;
  const facing = Math.atan2(fwd.x, fwd.z);   // the player's heading in the animals' yaw convention
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2 + 0.7, r = i === 0 ? 0 : 1.6 + (i % 2) * 1.1;
    const b = animals.spawn('boar', cx + Math.cos(ang) * r, cz + Math.sin(ang) * r, facing + Math.PI * 0.5 + i * 1.3, params.get('variant') ?? 'boar');
    b.state = 'idle'; b.herd = -2;
    if (i === 0 && (params.has('trot') || params.has('walk'))) showcase.push({ a: b, cx, cz });
  }
}

const enemies: ReturnType<AnimalManager['spawn']>[] = [];
const kind = params.get('species') ?? '';
if (kind) {
  const n = world.num('n', 4), dist = world.num('dist', 5);
  const fwd = player.forward, cx = player.position.x + fwd.x * dist, cz = player.position.z + fwd.z * dist;
  const facing = Math.atan2(-fwd.x, -fwd.z);   // face the player
  const herd = animals.addHerd(kind, cx, cz);
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2 + 0.4, r = i === 0 ? 0 : 1.8 + (i % 2) * 0.9;
    const v = params.get('variant') ?? (kind === 'crab' ? (i === 0 ? 'big' : 'small') : undefined);
    const e = animals.spawn(kind, cx + Math.cos(ang) * r, cz + Math.sin(ang) * r, facing, v);
    e.herd = herd; animals.herds[herd]?.members.push(e);
    enemies.push(e);
  }
}
let poseT = 0;

game.onUpdate((dt, t) => {
  animals.update(dt, t, player.position, player.sprinting);
  if (enemies.length > 0 && params.get('pose') === 'attack') { poseT += dt; if (poseT > 2) { poseT = 0; for (const e of enemies) { e.mem['st'] = 2; e.mem['hit'] = 0; e.startAttack(kind === 'crab' ? 0.78 : kind === 'monkey' ? 1.0 : 0.9); } } }
  if (enemies.length > 0 && params.get('pose') === 'walk') for (const e of enemies) { e.mem['st'] = 9; e.state = 'wander'; e.setMotion(e.yaw + 0.01, 1.2, 1); }
  for (const s of showcase) {
    // walk a 3 m circle
    const w = 0.45, r = 3;
    const ang = t * w;
    const tx = s.cx + Math.cos(ang) * r, tz = s.cz + Math.sin(ang) * r;
    const yaw = Math.atan2(tx - s.a.position.x, tz - s.a.position.z);
    s.a.state = 'wander';
    s.a.setMotion(yaw, params.has('trot') ? 3.5 : 1.3, 3);
    s.a.sampleTerrain();
  }
  // keep showcase animals out of the herd AI
  if (params.has('showcase') || params.has('sounder')) for (const a of animals.animals) if (a.herd === -2 && !showcase.some((s) => s.a === a)) { a.state = 'idle'; a.setMotion(a.desiredYaw, 0); a.lookTarget.copy(player.position); a.lookWeight = 0.6; }
});

// click to shoot
const dir = new THREE.Vector3();
window.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  game.camera.getWorldDirection(dir);
  const hit = animals.raycast(game.camera.position, dir, 200);
  if (hit) { const died = animals.hit(hit, dir); console.log('[animals] hit', hit.animal.kind, hit.headshot ? 'HEAD' : 'body', hit.distance.toFixed(1), 'hp', hit.animal.hp, died ? 'DIED' : ''); }
});

game.buildComposer();
game.start();
(window as unknown as { __world: unknown }).__world = { ...world, animals, THREE };
