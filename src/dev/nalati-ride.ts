// Dev entry: riding + taming (Nalati rows B7 / B8) — the real shard (wireNalati), its animals + Wildlife, the Nalati kit
// (bow · sabre · spear) in the real Weapons manager, the HUD, touch controls, and src/nalati/ride.ts.
// http://127.0.0.1:5188/dev/nalati-ride.html?chunk=nalati-grasslands&nolock=1&skipintro=1
//   &mount=1        start in the saddle of a camp horse at the hitching rail   &camp=1  on foot beside the rail
//   &gallop=1       hold GALLOP from the start (&speed=canter: hold W instead)
//   &herd=1         start 45 m from the wild herd's stallion (the approach) · &break=1 straight into the bucking rounds
//   &touch=1&tier=phone   the phone layout (390×844)     &nohmr=1  ignore other files' HMR full reloads (long shots)
// window.__world = { ...bootstrap(), animals, wildlife, weapons, kit, hud, ride }
import * as THREE from 'three';
import { bootstrap } from '../core/bootstrap';
import { AnimalManager } from '../entities/AnimalManager';
import { Rifle } from '../player/Rifle';
import { Weapons } from '../player/Weapons';
import { TouchControls } from '../player/TouchControls';
import { buildNalatiKit } from '../player/nalatiKit';
import { HUD } from '../ui/HUD';
import { WeaponStrip } from '../ui/WeaponStrip';
import { Grass } from '../world/Grass';
import { setAimTargets } from '../player/AimTargets';
import type { Targets, TargetHit } from '../player/Crossbow';
import { wireNalati } from '../nalati';
import { wireRide } from '../nalati/ride';
import { HITCHING_RAIL } from '../world/nalati/layout';

// &nohmr=1: other agents' saves full-reload every open page — a harness mid-shot ignores them (a listener that throws aborts Vite's reload)
if (new URLSearchParams(location.search).has('nohmr')) import.meta.hot?.on('vite:beforeFullReload', () => { throw new Error('nohmr: reload skipped'); });
if (!new URLSearchParams(location.search).has('chunk')) location.search += `${location.search ? '&' : '?'}chunk=nalati-grasslands`;
const world = await bootstrap();
const { game, sky, player, forest, params, chunk } = world;
const nolock = params.has('nolock');
const nalati = await wireNalati({ game, sky, player, forest, chunk });
const grass = new Grass(sky, forest).build(); game.scene.add(grass.group);
const animals = new AnimalManager(game.scene, sky, forest).build();
const wildlife = nalati.attachAnimals(animals);
setAimTargets(animals.animals);
const targets: Targets = {
  raycast(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number): TargetHit | null {
    const h = animals.raycast(origin, dir, maxDist);
    return h ? { animal: h.animal, point: h.point, distance: h.distance, headshot: h.headshot } : null;
  },
};
const kit = buildNalatiKit({ game, sky, player, forest }, targets, nolock);
const rifle = new Rifle({ game, sky, player, forest }, targets, { allowUnlocked: nolock });
const weapons = new Weapons(kit.base, rifle, kit.extras, kit.options);
new TouchControls(player, weapons, params.has('touch'));
kit.install(weapons);
const strip = new WeaponStrip(weapons); // the base HUD's weapon strip (E154)
game.onUpdate(() => { strip.update(); });
const hud = new HUD({ pointerLock: !nolock });
let health = 100;
animals.onCharge = (_a, dmg) => { health = Math.max(0, health - dmg); hud.damageFlash(); };
const ride = wireRide({ player, forest, animals, wildlife, camera: game.camera });
ride.bind({ kit, hurt: (d) => { health = Math.max(0, health - d); hud.damageFlash(); }, toast: (t) => { hud.toast(t); }, isDrawing: () => weapons.adsHeld || kit.bow.drawing });
ride.taming.onBreaking = (on) => { weapons.visible = !on; weapons.setEnabled(!on); };
nalati.bindPlay({ kit, health01: () => health / 100, toast: (t) => { hud.toast(t); }, flash: () => { hud.damageFlash(); } });
if (params.has('skipintro')) { hud.markEntered(); weapons.setEnabled(nolock); } else hud.showIntro(() => { weapons.setEnabled(true); if (!nolock) player.lock(); });

// the E key / USE: the ride's one prompt
document.addEventListener('keydown', (e) => { if (e.code === 'KeyE' && ride.interactable.radius > 0 && ride.interactable.position.distanceTo(game.camera.position) < ride.interactable.radius) ride.interactable.onInteract(); });

// start positions
const camp0 = wildlife.campHorses[0];
if (params.has('mount') && camp0 !== undefined) {
  player.position.set(camp0.position.x - 2, camp0.position.y, camp0.position.z);
  player.yaw = camp0.yaw + Math.PI;
  setTimeout(() => { ride.mount.mount(camp0); }, 300);
} else if (params.has('camp')) {
  player.position.set(HITCHING_RAIL.x - 6, 0, HITCHING_RAIL.z - 3); player.yaw = Math.PI / 2;
}
const herd = wildlife.herds[0];
const stallion = herd?.stallion ?? null;
if ((params.has('herd') || params.has('break')) && herd !== undefined && stallion !== null) {
  const dx = stallion.position.x - herd.cx, dz = stallion.position.z - herd.cz, l = Math.hypot(dx, dz) || 1;
  const d = params.has('break') ? 2.5 : world.num('dist', 45);
  player.position.set(stallion.position.x + (dx / l) * d, 0, stallion.position.z + (dz / l) * d);
  player.yaw = Math.atan2(-(stallion.position.x - player.position.x), -(stallion.position.z - player.position.z));
  if (params.has('break')) setTimeout(() => { ride.taming.forceBreak(); }, 1500);
}
if (params.has('gallop')) player.keys.add('ShiftLeft');
if (params.get('speed') === 'canter') player.keys.add('KeyW');

game.onUpdate((dt, t) => {
  animals.update(dt, t, player.position, player.sprinting);
  weapons.update(dt, t);
  grass.update(dt, player.position);
  nalati.update(dt, t);
  ride.update(dt);
  const it = ride.interactable, near = it.radius > 0 && it.position.distanceTo(game.camera.position) < it.radius;
  hud.setState({
    bolts: weapons.state.ammo, maxBolts: weapons.state.magazine, loaded: weapons.state.loaded, reloading: weapons.state.reloading, reloadProgress: weapons.state.reloadProgress,
    health, pos: { x: player.position.x, z: player.position.z }, yaw: player.yaw, kills: 0,
    speed: player.speedFactor, ads: weapons.state.ads, prompt: near ? `[E] ${it.label}` : undefined,
    ammoLabel: weapons.current.ammoLabel, weaponName: weapons.current.name, segments: weapons.current.segments,
  });
});
game.buildComposer();
game.start();
Object.assign(window, { __world: { ...world, animals, wildlife, weapons, kit, hud, ride, THREE } });
