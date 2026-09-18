import * as THREE from 'three';
import { bootstrap } from '../core/bootstrap';
import { AnimalManager } from '../entities/AnimalManager';
import { Sword } from '../player/Sword';
import type { Targets, TargetHit } from '../player/Crossbow';
import { HUD } from '../ui/HUD';
import { Combat } from '../ui/Combat';
import { Audio } from '../audio/Audio';
import { TouchControls } from '../player/TouchControls';
import type { Crossbow as Weapons } from '../player/Crossbow'; // TouchControls takes the crossbow shape at HEAD
import { CHUNK_HALF } from '../core/config';

/**
 * Dev entry for the wooden sword — bootstrap + the real AnimalManager + Sword + Combat + HUD.
 *   /dev/sword.html?nolock=1&skipintro=1&x=&z=&yaw=&pitch=
 *   &showcase=1   a boar 1.6 m ahead (idle, AI off) and a hind 2.2 m ahead-left — swing at them
 *   &touch=1      on-screen controls (with &tier=phone for the phone layout)
 *   &ads=1        hold the guard pose · &inspect=1 showcase pose (centred, turning) · &iron=1 the iron blade
 * window.__world = { ...world, animals, sword, combat, hud, audio } — `__world.sword.tryFire()` swings.
 */
const world = await bootstrap();
const { game, sky, forest, player, params } = world;
const animals = new AnimalManager(game.scene, sky, forest).build();
animals.calm = params.has('calm') || params.has('showcase');
const targets: Targets = {
  raycast(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number): TargetHit | null {
    const h = animals.raycast(origin, dir, maxDist);
    return h ? { animal: h.animal as unknown as TargetHit['animal'], point: h.point, distance: h.distance, headshot: h.headshot } : null;
  },
};
const showcase: ReturnType<AnimalManager['spawn']>[] = [];
if (params.has('showcase')) {
  const yaw = player.yaw, px = player.position.x, pz = player.position.z;
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
  const d = world.num('dist', 1.7);
  showcase.push(animals.spawn('boar', px + fx * d + rx * 0.3, pz + fz * d + rz * 0.3, yaw + Math.PI / 2, 'boar'));
  showcase.push(animals.spawn('deer', px + fx * 2.6 - rx * 1.6, pz + fz * 2.6 - rz * 1.6, yaw + Math.PI / 2 + 0.4, 'hind'));
  for (const a of showcase) a.herd = -2;
}

const nolock = params.has('nolock');
const sword = new Sword({ game, sky, player, forest }, targets, { allowUnlocked: nolock, blade: params.has('iron') ? 'iron' : 'wood' });
sword.adsHeld = params.has('ads');
// on-screen controls (?touch=1 forces): TouchControls only uses tryFire / adsHeld / enabled (+ swap on the SWAP pill, a no-op here)
new TouchControls(player, Object.assign(sword, { swap() { /* one weapon */ }, available: [sword], onUnlock: undefined }) as unknown as Weapons, params.has('touch'));
sword.inspect = params.has('inspect') ? 1 : 0;
sword.swingScale = world.num('slow', 1);
const hud = new HUD({ pointerLock: !nolock });
const audio = new Audio();
let kills = 0, health = 100;

sword.onFire = () => audio.swordSwing();
sword.onImpact = (surface, point) => {
  const dx = point.x - player.position.x, dz = point.z - player.position.z, d = Math.hypot(dx, dz);
  const rx = Math.cos(player.yaw), rz = -Math.sin(player.yaw);
  audio.swordHit(surface, d > 1 ? ((dx * rx + dz * rz) / d) * 0.7 : 0);
};
sword.onHit = (kind, headshot, killed) => {
  hud.showHitMarker(headshot, killed);
  audio.hitMarker();
  if (killed) { kills++; audio.kill(); hud.killFeed(`${kind} · ${Math.round(player.position.distanceTo(game.camera.position))} m`); }
};
const combat = new Combat(game, animals, sword, game.camera);
animals.onKill = (a) => hud.killFeed(`${a.kind} · ${Math.round(a.position.distanceTo(player.position))} m`);
animals.onSound = (name, pos) => audio.animal(name, pos, player.position, player.yaw);
animals.onCharge = (_a, dmg) => { health = Math.max(0, health - dmg); hud.damageFlash(); audio.land(true); };
player.onStep = (sprinting) => audio.footstep(sprinting);

const enter = () => { audio.resume(); sword.enabled = true; sword.model.visible = true; if (!nolock) player.lock(); };
hud.onResume = enter;
if (params.has('skipintro')) { hud.markEntered(); sword.enabled = nolock; }
else { sword.enabled = false; sword.model.visible = false; hud.showIntro(enter); }
document.addEventListener('keydown', () => audio.resume(), { once: true });
document.addEventListener('mousedown', () => audio.resume(), { once: true });

game.onUpdate((dt, t) => {
  for (const a of showcase) if (a.alive) { a.state = 'idle'; a.setMotion(a.desiredYaw, 0); a.lookTarget.copy(player.position); a.lookWeight = 0.6; } // pinned: the AI never moves them
  animals.update(dt, t, player.position, player.sprinting);
  sword.update(dt, t);
  audio.listenerYaw = player.yaw;
  const edge = CHUNK_HALF - Math.max(Math.abs(player.position.x), Math.abs(player.position.z));
  hud.setBoundaryWarning(edge < 14 && hud.entered);
  hud.setAimInfo(sword.aimInfo);
  hud.setState({
    bolts: sword.state.bolts, loaded: sword.state.loaded, reloading: sword.state.reloading, reloadProgress: sword.state.reloadProgress,
    health, fps: game.stats.fps, pos: { x: player.position.x, z: player.position.z }, yaw: player.yaw, kills,
    speed: player.speedFactor, ads: sword.state.ads,
  });
});
game.buildComposer();
game.start();
(window as unknown as { __world: unknown }).__world = { ...world, animals, sword, combat, hud, audio };
