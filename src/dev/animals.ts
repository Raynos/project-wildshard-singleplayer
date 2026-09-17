import * as THREE from 'three';
import { bootstrap } from '../core/bootstrap';
import { AnimalManager } from '../entities/AnimalManager';

/**
 * Dev entry for the huntable animals.
 *   /dev/animals.html?nolock=1&x=&z=&yaw=&pitch=
 *   &showcase=1   spawn a stag, a boar and a walking hind 4 m in front of the spawn point
 *   &debug=1      draw the hit volumes
 * Click = shoot a ray from the camera (applies 30 damage, prints the hit).
 * window.__world = { ...world, animals }
 */
const world = await bootstrap();
const { game, sky, forest, player, params } = world;
const animals = new AnimalManager(game.scene, sky, forest).build();
animals.debug = params.has('debug');
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
  if (params.has('gait')) for (const s of [stag, boar]) s.debugGait = { gait: params.get('gait')!, phase: world.num('phase', 0) };
  // freeze AI on the showcase animals: they are driven here
  for (const s of [stag, boar, hind]) s.herd = -2;
}

game.onUpdate((dt, t) => {
  animals.update(dt, t, player.position, player.sprinting);
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
  if (params.has('showcase')) for (const a of animals.animals) if (a.herd === -2 && !showcase.some((s) => s.a === a)) { a.state = 'idle'; a.setMotion(a.desiredYaw, 0); a.lookTarget.copy(player.position); a.lookWeight = 0.6; }
});

// click to shoot
const dir = new THREE.Vector3();
window.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  game.camera.getWorldDirection(dir);
  const hit = animals.raycast(game.camera.position, dir, 200);
  if (hit) { const died = animals.hit(hit, 30, dir); console.log('[animals] hit', hit.animal.kind, hit.headshot ? 'HEAD' : 'body', hit.distance.toFixed(1), 'hp', hit.animal.hp, died ? 'DIED' : ''); }
});

game.buildComposer();
game.start();
(window as unknown as { __world: unknown }).__world = { ...world, animals, THREE };
