// Dev entry: the Nalati melee kit (plan row B3) — sabre + spear + javelins in the real Weapons manager, the 3-slot weapon strip,
// the touch discs (THROW / BRACE / HEAVY), HUD + Combat, the real AnimalManager.
// http://127.0.0.1:5188/dev/nalati-melee.html?chunk=nalati-grasslands&nolock=1&skipintro=1&x=&z=&yaw=&pitch=
//   &weapon=sabre|spear      start holding it                 &touch=1&tier=phone   the phone layout (390×844)
//   &showcase=1              a boar 2.4 m ahead, pinned idle  &charge=1             a boar 22 m ahead that charges you (brace test)
//                                                            &chargeAt=s           when (game clock; or `window.__charge = true`)
//   &brace=1                 hold the spear's brace           &windup=1             hold a javelin wound up (the arc)
//   &slow=5                  sabre swings in slow motion      &inspect=1            showcase pose
// window.__world = { ...bootstrap(), animals, weapons, kit, hud } — `__world.weapons.tryFire()`, `__world.kit.spear.adsHeld = true`,
// `__world.weapons.altHeld = true`, `__world.kit.setMount({ speed: 12, yaw })` for the mounted pass slash / couched lance.
import type * as THREE from 'three';
import { bootstrap } from '../core/bootstrap';
import { AnimalManager } from '../entities/AnimalManager';
import { Rifle } from '../player/Rifle';
import { Weapons, type WeaponId } from '../player/Weapons';
import { TouchControls } from '../player/TouchControls';
import { buildNalatiKit } from '../player/nalatiKit';
import { HUD } from '../ui/HUD';
import { WeaponStrip } from '../ui/WeaponStrip';
import { Combat } from '../ui/Combat';
import { Audio } from '../audio/Audio';
import { setAimTargets } from '../player/AimTargets';
import type { Targets, TargetHit } from '../player/Crossbow';

const world = await bootstrap();
const { game, sky, player, forest, params } = world;
const nolock = params.has('nolock');

const animals = new AnimalManager(game.scene, sky, forest).build();
animals.calm = params.has('calm') || params.has('showcase') || params.has('charge');
setAimTargets(animals.animals);
const targets: Targets = {
  raycast(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number): TargetHit | null {
    const h = animals.raycast(origin, dir, maxDist);
    return h ? { animal: h.animal as unknown as TargetHit['animal'], point: h.point, distance: h.distance, headshot: h.headshot } : null;
  },
};
const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw), rx = Math.cos(player.yaw), rz = -Math.sin(player.yaw);
const px = player.position.x, pz = player.position.z;
const pinned: ReturnType<AnimalManager['spawn']>[] = [];
if (params.has('showcase')) {
  const d = world.num('dist', 2.4);
  const a = animals.spawn('boar', px + fx * d + rx * 0.3, pz + fz * d + rz * 0.3, player.yaw + Math.PI / 2, 'boar'); a.herd = -2; pinned.push(a);
}
const charger = params.has('charge') ? animals.spawn('boar', px + fx * 22, pz + fz * 22, player.yaw, 'boar') : null;
if (charger) charger.herd = -2;

const kit = buildNalatiKit({ game, sky, player, forest }, targets, nolock);
const rifle = new Rifle({ game, sky, player, forest }, targets, { allowUnlocked: nolock });
const weapons = new Weapons(kit.base, rifle, kit.extras, kit.options);
new TouchControls(player, weapons, params.has('touch'));
kit.install(weapons);
const strip = new WeaponStrip(weapons); // the base HUD's weapon strip (E154)
game.onUpdate(() => { strip.update(); });
const start = params.get('weapon');
if (start === 'sabre' || start === 'spear') weapons.select(start satisfies WeaponId, true);
kit.sabre.swingScale = 0.9 * world.num('slow', 1);
kit.sabre.inspect = kit.spear.inspect = params.has('inspect') ? 1 : 0;
const hud = new HUD({ pointerLock: !nolock });
const audio = new Audio();
let kills = 0, health = 100;
weapons.onFire = () => audio.swordSwing();
weapons.onSwap = () => audio.weaponSwap();
weapons.onImpact = (surface) => audio.swordHit(surface, 0, 1);
weapons.onHit = (_k, headshot, killed) => { hud.showHitMarker(headshot, killed); audio.hitMarker(); if (killed) { kills++; audio.kill(); } };
kit.spear.onPickup = (n) => hud.toast(`Javelin recovered · ${n} / ${kit.spear.maxJavelins}`);
new Combat(game, animals, weapons, game.camera);
animals.onKill = (a) => hud.killFeed(`${a.label} · ${Math.round(a.position.distanceTo(player.position))} m`);
animals.onSound = (name, pos) => audio.animal(name, pos, player.position, player.yaw);
animals.onCharge = (_a, dmg) => { health = Math.max(0, health - dmg); hud.damageFlash(); audio.land(true); };

const enter = () => { audio.resume(); weapons.setEnabled(true); weapons.visible = true; if (!nolock) player.lock(); };
hud.onResume = enter;
if (params.has('skipintro')) { hud.markEntered(); weapons.setEnabled(nolock); }
else { weapons.setEnabled(false); weapons.visible = false; hud.showIntro(enter); }
document.addEventListener('keydown', () => audio.resume(), { once: true });
document.addEventListener('mousedown', () => audio.resume(), { once: true });
if (params.has('brace')) setTimeout(() => { weapons.altHeld = true; }, 600);
if (params.has('windup')) setTimeout(() => { weapons.adsHeld = true; }, 600);

game.onUpdate((dt, t) => {
  for (const a of pinned) if (a.alive) { a.state = 'idle'; a.setMotion(a.desiredYaw, 0); a.lookTarget.copy(player.position); a.lookWeight = 0.6; }
  const go = (window as { __charge?: boolean }).__charge === true || t > world.num('chargeAt', 2);
  if (charger?.alive === true && go) charger.setMotion(Math.atan2(player.position.x - charger.position.x, player.position.z - charger.position.z), 7.5, 6);
  animals.update(dt, t, player.position, player.sprinting);
  weapons.update(dt, t);
  audio.listenerYaw = player.yaw;
  hud.setAimInfo(weapons.aimInfo);
  hud.setState({
    bolts: weapons.state.ammo, maxBolts: weapons.state.magazine, loaded: weapons.state.loaded, reloading: weapons.state.reloading, reloadProgress: weapons.state.reloadProgress,
    health, pos: { x: player.position.x, z: player.position.z }, yaw: player.yaw, kills,
    speed: player.speedFactor, ads: weapons.state.ads,
    ammoLabel: weapons.current.ammoLabel, weaponName: weapons.current.name, segments: weapons.current.segments,
  });
});
game.buildComposer();
game.start();
(window as unknown as { __world: unknown }).__world = { ...world, animals, weapons, kit, hud, charger };
