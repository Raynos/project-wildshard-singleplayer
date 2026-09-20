// Dev entry: Driftwood Isle loot — the island (src/dev/driftwood.ts' pieces) + the real AnimalManager (island fauna) +
// the wooden / iron sword kit (Weapons.ts) + the iron sword pickup on the wreck (IronSword.ts) + HUD.
// http://localhost:5173/dev/loot.html?chunk=driftwood-isle&nolock=1&skipintro=1&x=0&z=-235&yaw=3.1416&pitch=0
//   &iron=1   start with the iron sword (the pickup is disposed)   &calm=1  animals ignore you   &touch=1&tier=phone
//   &deck=lx,lz   stand on the wreck's deck at that hull-local point (x starboard, z stern), facing the sword   &take=N  take it after N s
// window.__world = { ...bootstrap(), animals, weapons, drop, wreck, hud, ironSite, … }
import type * as THREE from 'three';
import { bootstrap } from '../core/bootstrap';
import { Ocean } from '../world/Ocean';
import { Pier } from '../world/Pier';
import { Boat } from '../world/Boat';
import { Boulders } from '../world/Boulders';
import { Hut } from '../world/Hut';
import { Palms } from '../world/Palms';
import { Lookout } from '../world/Lookout';
import { Wreck } from '../world/Wreck';
import { Shrine } from '../world/Shrine';
import { Bushes } from '../world/Bushes';
import { HUT, LOOKOUT, WRECK, SHRINE, JETTIES } from '../chunks/driftwood-isle';
import { Boundary } from '../world/Boundary';
import { Horizon } from '../world/Horizon';
import { CHUNK_HALF, ROAD_LENGTH } from '../core/config';
import { heightAt } from '../world/Heightfield';
import { AnimalManager } from '../entities/AnimalManager';
import { Sword } from '../player/Sword';
import { Rifle } from '../player/Rifle';
import { Weapons } from '../player/Weapons';
import { IronSwordPickup, ironSwordSite } from '../player/IronSword';
import { TouchControls } from '../player/TouchControls';
import { HUD } from '../ui/HUD';
import { Combat } from '../ui/Combat';
import { Audio } from '../audio/Audio';
import type { Interactable } from '../world/Cabin';
import type { Targets, TargetHit } from '../player/Crossbow';

if (!new URLSearchParams(location.search).has('chunk')) { location.search += `${location.search ? '&' : '?'}chunk=driftwood-isle`; }

const world = await bootstrap();
const { game, sky, player, chunk, forest, params } = world;
const nolock = params.has('nolock');

const ocean = chunk.ocean ? new Ocean(sky).build() : null;
if (ocean) game.scene.add(ocean.group);
const pier = new Pier(sky, { x: 0, z: -CHUNK_HALF, length: ROAD_LENGTH, width: 4, deckY: (chunk.ocean?.level ?? 0) + 1.2 }).build();
game.scene.add(pier.group); player.colliders.push(...pier.colliders); player.platforms.push((x, z) => pier.floorHeightAt(x, z));
{ const y = pier.floorHeightAt(player.position.x, player.position.z); if (y !== undefined) player.position.y = y; }
const jetties = JETTIES.map((j) => new Pier(sky, { x: j.x, z: j.z, rot: j.rot, length: j.length, width: 3, deckY: (chunk.ocean?.level ?? 0) + 1.2 }).build());
for (const j of jetties) { game.scene.add(j.group); player.colliders.push(...j.colliders); player.platforms.push((x, z) => j.floorHeightAt(x, z)); }
const boat = new Boat(sky, { x: -4.2, z: -CHUNK_HALF + 6, heading: 0, waterY: chunk.ocean?.level ?? 0, moorTo: pier.mooringsFor(-4.2, -CHUNK_HALF + 6) }).build();
game.scene.add(boat.group); if (boat.ropes) game.scene.add(boat.ropes);
player.colliders.push(...boat.colliders); player.platforms.push((x, z) => boat.floorHeightAt(x, z));
const rocks = new Boulders(sky).build(Boulders.scatterShore(chunk.seed));
game.scene.add(rocks.mesh); player.colliders.push(...rocks.colliders);
const hut = new Hut(sky, HUT).build();
game.scene.add(hut.group); player.colliders.push(...hut.colliders); player.platforms.push((x, z) => hut.floorHeightAt(x, z));
const AVOID = [{ x: HUT.x, z: HUT.z, r: 11 }, { x: LOOKOUT.x, z: LOOKOUT.z, r: 12 }, { x: SHRINE.x, z: SHRINE.z, r: 13 }, { x: WRECK.x, z: WRECK.z, r: 14 }];
const palms = new Palms(sky).build(Palms.scatterIsland(chunk.seed, 150, AVOID));
game.scene.add(palms.mesh); player.colliders.push(...palms.colliders);
const lookout = new Lookout(sky, LOOKOUT).build();
game.scene.add(lookout.group); player.colliders.push(...lookout.colliders); player.platforms.push((x, z) => lookout.floorHeightAt(x, z));
const wreck = new Wreck(sky, WRECK).build();
game.scene.add(wreck.group); player.colliders.push(...wreck.colliders); player.platforms.push((x, z) => wreck.floorHeightAt(x, z));
const shrine = new Shrine(sky, SHRINE).build();
game.scene.add(shrine.group); player.colliders.push(...shrine.colliders); player.platforms.push((x, z) => shrine.floorHeightAt(x, z));
const bushes = new Bushes(sky).build(Bushes.scatterIsland(chunk.seed, 260, AVOID));
game.scene.add(bushes.mesh);
const boundary = new Boundary(sky).build(); game.scene.add(boundary.group);
const horizon = new Horizon(sky).build(); game.scene.add(horizon.group);

// ── fauna ──
const animals = new AnimalManager(game.scene, sky, forest).build();
animals.calm = params.has('calm');
console.log(`[loot] ${animals.animals.length} animals in ${animals.herds.length} herds:`, animals.herds.map((h) => `${h.kind}×${h.members.length}@${h.cx | 0},${h.cz | 0}`).join('  '));
const targets: Targets = {
  raycast(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number): TargetHit | null {
    const h = animals.raycast(origin, dir, maxDist);
    return h ? { animal: h.animal as unknown as TargetHit['animal'], point: h.point, distance: h.distance, headshot: h.headshot } : null;
  },
};

// ── kit: wooden sword (1) + the iron sword (2, locked until the pickup) [+ the rifle slot the manager expects] ──
const wood = new Sword({ game, sky, player, forest }, targets, { allowUnlocked: nolock });
const iron = new Sword({ game, sky, player, forest }, targets, { allowUnlocked: nolock, blade: 'iron' });
const rifle = new Rifle({ game, sky, player, forest }, targets, { allowUnlocked: nolock });
const weapons = new Weapons(wood, rifle, [{ weapon: iron, id: 'sword-iron', name: 'Iron sword' }]);
new TouchControls(player, weapons, params.has('touch'));
const hud = new HUD({ pointerLock: !nolock });
const audio = new Audio();
let kills = 0, health = 100;
weapons.onFire = () => audio.swordSwing();
weapons.onSwap = () => audio.weaponSwap();
weapons.onHit = (_k, headshot, killed) => { hud.showHitMarker(headshot, killed); audio.hitMarker(); if (killed) { kills++; audio.kill(); } };
new Combat(game, animals, weapons, game.camera);
animals.onKill = (a) => hud.killFeed(`${a.label} · ${Math.round(a.position.distanceTo(player.position))} m`);
animals.onSound = (name, pos) => audio.animal(name, pos, player.position, player.yaw);
animals.onCharge = (_a, dmg) => { health = Math.max(0, health - dmg); hud.damageFlash(); audio.land(true); };

// ── the iron sword pickup on the wreck's broken deck ──
const interactables: Interactable[] = [];
const ironSite = ironSwordSite(wreck, heightAt);
const drop = new IronSwordPickup({ scene: game.scene, sky, position: ironSite });
interactables.push(drop.interactable);
drop.onPickup = () => { weapons.unlock('sword-iron'); weapons.select('sword-iron'); audio.hitMarker(); hud.toast('Iron sword acquired · 1/2 to switch, Q to swap'); };
if (params.has('iron')) { weapons.unlock('sword-iron'); weapons.select('sword-iron', true); drop.dispose(); }

// screenshot helpers: stand on the heeled deck facing the sword; take the sword after N s (the toast / burst shot)
if (params.has('deck')) {
  const [lx = Number.NaN, lz = Number.NaN] = ((params.get('deck') ?? '') || '-0.9,1').split(',').map(Number);
  const cs = Math.cos(WRECK.heading), sn = Math.sin(WRECK.heading);
  const x = WRECK.x + lx * cs + lz * sn, z = WRECK.z - lx * sn + lz * cs;
  const deck = wreck.floorHeightAt(x, z);
  if (deck !== undefined) { player.position.set(x, deck + 0.02, z); player.velocity.set(0, 0, 0); player.yaw = Math.atan2(-(ironSite.x - x), -(ironSite.z - z)); player.pitch = world.num('pitch', 0.1); }
}
if (params.has('take')) setTimeout(() => drop.take(), world.num('take', 3) * 1000);

const enter = () => { audio.resume(); weapons.setEnabled(true); weapons.visible = true; if (!nolock) player.lock(); };
hud.onResume = enter;
if (params.has('skipintro')) { hud.markEntered(); weapons.setEnabled(nolock); }
else { weapons.setEnabled(false); weapons.visible = false; hud.showIntro(enter); }
document.addEventListener('keydown', () => audio.resume(), { once: true });
document.addEventListener('mousedown', () => audio.resume(), { once: true });
let nearest: Interactable | undefined;
document.addEventListener('keydown', (e) => { if (e.code === 'KeyE' && hud.entered && nearest) nearest.onInteract(); });

game.onUpdate((dt, t) => {
  ocean?.update(dt); boat.update(dt); palms.update(dt); boundary.update(dt, t); horizon.update(dt, game.camera);
  animals.update(dt, t, player.position, player.sprinting);
  weapons.update(dt, t);
  drop.update(dt, t, game.renderer, game.camera, player.position);
  audio.listenerYaw = player.yaw;
  nearest = undefined; let best = 1e9;
  for (const it of interactables) { const d = it.position.distanceTo(game.camera.position); if (d < it.radius && d < best) { best = d; nearest = it; } }
  hud.setAimInfo(weapons.aimInfo);
  hud.setState({
    bolts: weapons.state.ammo, loaded: weapons.state.loaded, reloading: weapons.state.reloading, reloadProgress: weapons.state.reloadProgress,
    health, fps: game.stats.fps, pos: { x: player.position.x, z: player.position.z }, yaw: player.yaw, kills,
    speed: player.speedFactor, ads: weapons.state.ads, prompt: nearest ? `[E] ${nearest.label}` : undefined,
    ammoLabel: weapons.current.ammoLabel, weaponName: weapons.current.name, segments: weapons.current.segments,
  });
});

(window as unknown as { __world: unknown }).__world = { ...world, ocean, pier, jetties, boat, rocks, hut, palms, lookout, wreck, shrine, bushes, boundary, horizon, heightAt, animals, weapons, wood, iron, drop, ironSite, hud, audio };
game.buildComposer();
game.start();
