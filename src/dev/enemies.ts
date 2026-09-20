// Dev entry: Driftwood Isle's enemies in their spaces — the island (world pieces, as src/dev/driftwood.ts) + the AnimalManager
// + Enemies (crabs at the cove tidepools, monkey troops in the palm groves, the sailor in the wreck's hold) + the Cove dressing.
//   http://localhost:5173/dev/enemies.html?at=cove|wreck|palms|shrine   (or &x=&z=&yaw=&pitch=)  &nolock=1 &calm=1 &debug=1
//   &wake=1  wake the sailor at once (the player is put on the wreck's deck)
//   &coconut=1  every monkey throws at the player every 2 s (a coconut in flight)
// Click = a sword-like blow: raycast from the camera, 12 damage + a light stagger. window.__world = { …, animals, enemies, cove }
import * as THREE from 'three';
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
import { Cove } from '../world/Cove';
import { HUT, LOOKOUT, WRECK, SHRINE, JETTIES } from '../chunks/driftwood-isle';
import { Boundary } from '../world/Boundary';
import { Horizon } from '../world/Horizon';
import { CHUNK_HALF, ROAD_LENGTH } from '../core/config';
import { heightAt } from '../world/Heightfield';
import { AnimalManager } from '../entities/AnimalManager';
import { Enemies } from '../entities/Enemies';

if (!new URLSearchParams(location.search).has('chunk')) { location.search += `${location.search ? '&' : '?'}chunk=driftwood-isle`; }

const world = await bootstrap();
const { game, sky, forest, player, chunk, params } = world;
const deckY = (chunk.ocean?.level ?? 0) + 1.2;

const ocean = chunk.ocean ? new Ocean(sky).build() : null;
if (ocean) game.scene.add(ocean.group);
const pier = new Pier(sky, { x: 0, z: -CHUNK_HALF, length: ROAD_LENGTH, width: 4, deckY }).build();
game.scene.add(pier.group); player.colliders.push(...pier.colliders); player.platforms.push((x, z) => pier.floorHeightAt(x, z));
const jetties = JETTIES.map((j) => new Pier(sky, { x: j.x, z: j.z, rot: j.rot, length: j.length, width: 3, deckY }).build());
for (const j of jetties) { game.scene.add(j.group); player.colliders.push(...j.colliders); player.platforms.push((x, z) => j.floorHeightAt(x, z)); }
const boat = new Boat(sky, { x: -4.2, z: -CHUNK_HALF + 6, heading: 0, waterY: chunk.ocean?.level ?? 0, moorTo: pier.mooringsFor(-4.2, -CHUNK_HALF + 6) }).build();
game.scene.add(boat.group); if (boat.ropes) game.scene.add(boat.ropes);
const rocks = new Boulders(sky).build(Boulders.scatterShore(chunk.seed));
game.scene.add(rocks.mesh); player.colliders.push(...rocks.colliders);
const hut = new Hut(sky, HUT).build();
game.scene.add(hut.group); player.colliders.push(...hut.colliders); player.platforms.push((x, z) => hut.floorHeightAt(x, z));
const AVOID = [{ x: HUT.x, z: HUT.z, r: 11 }, { x: LOOKOUT.x, z: LOOKOUT.z, r: 12 }, { x: SHRINE.x, z: SHRINE.z, r: 13 }, { x: WRECK.x, z: WRECK.z, r: 14 }];
const palmSpecs = Palms.scatterIsland(chunk.seed, undefined, AVOID);
const palms = new Palms(sky).build(palmSpecs);
game.scene.add(palms.mesh); player.colliders.push(...palms.colliders);
const lookout = new Lookout(sky, LOOKOUT).build();
game.scene.add(lookout.group); player.colliders.push(...lookout.colliders); player.platforms.push((x, z) => lookout.floorHeightAt(x, z));
const wreck = new Wreck(sky, WRECK).build();
game.scene.add(wreck.group); player.colliders.push(...wreck.colliders); player.platforms.push((x, z) => wreck.floorHeightAt(x, z));
const shrine = new Shrine(sky, SHRINE).build();
game.scene.add(shrine.group); player.colliders.push(...shrine.colliders); player.platforms.push((x, z) => shrine.floorHeightAt(x, z));
const bushes = new Bushes(sky).build(Bushes.scatterIsland(chunk.seed, undefined, AVOID));
game.scene.add(bushes.mesh);
const cove = new Cove(sky).build(Cove.forIsland());
game.scene.add(cove.group); player.colliders.push(...cove.colliders);
const boundary = new Boundary(sky).build(); game.scene.add(boundary.group);
const horizon = new Horizon(sky).build(); game.scene.add(horizon.group);

const animals = new AnimalManager(game.scene, sky, forest).build();
animals.debug = params.has('debug');
animals.calm = params.has('calm');
animals.onKill = (a) => console.log('[enemies] kill', a.kind, a.variant);
animals.onCharge = (a, dmg) => console.log('[enemies] hit the player:', a.kind, dmg);
const enemies = new Enemies(animals, { scene: game.scene, sky, palms: palmSpecs, wreck, crabSites: cove.crabSites }).build();
console.log('[enemies] placed', JSON.stringify(enemies.placed), 'animals', animals.animals.length);

// camera presets
const at = params.get('at');
const H = WRECK.heading, cs = Math.cos(H), sn = Math.sin(H);
const hull = (lx: number, lz: number) => ({ x: WRECK.x + lx * cs + lz * sn, z: WRECK.z - lx * sn + lz * cs });
const troop = animals.herds.find((h) => h.kind === 'monkey');
const PRESETS: Record<string, { x: number; z: number; yaw: number; pitch: number; deck?: boolean }> = {
  cove: { x: 139, z: 5, yaw: -0.4, pitch: -0.25 },
  wreck: { ...hull(0.9, 7.0), yaw: WRECK.heading, pitch: -0.2, deck: true },
  palms: troop ? { x: troop.cx + 7, z: troop.cz + 7, yaw: Math.PI * 0.75, pitch: 0.35 } : { x: 0, z: 0, yaw: 0, pitch: 0 },
  shrine: { x: SHRINE.x + 12, z: SHRINE.z - 9, yaw: 2.21, pitch: 0.08 },
  fall: { x: 131, z: 12, yaw: 0.9, pitch: 0.1 },
};
if (at && PRESETS[at]) {
  const p = PRESETS[at];
  player.spawn(p.x, p.z, p.yaw);
  player.pitch = p.pitch;
  if (p.deck) { const y = wreck.floorHeightAt(p.x, p.z); if (y !== undefined) player.position.y = y; }
}
if (params.has('wake')) { const s = animals.animals.find((a) => a.kind === 'sailor'); if (s) { s.mem['st'] = 1; s.mem['rising'] = 1; s.state = 'rise'; } }

let coconutT = 0;
game.onUpdate((dt, t) => {
  ocean?.update(dt); boat.update(dt); palms.update(dt); boundary.update(dt, t); horizon.update(dt, game.camera); cove.update(dt); shrine.update(dt);
  animals.update(dt, t, player.position, player.sprinting);
  enemies.update(dt, t, player.position);
  if (params.has('coconut')) { coconutT += dt; if (coconutT > 2) { coconutT = 0; for (const a of animals.animals) if (a.kind === 'monkey' && a.alive) { a.mem['st'] = 2; a.mem['bite'] = 0; a.mem['hit'] = 0; a.startAttack(1.0); } } }
});

// click = a blow
const dir = new THREE.Vector3(), push = new THREE.Vector3();
window.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  game.camera.getWorldDirection(dir);
  const hit = animals.raycast(game.camera.position, dir, 3);
  if (hit) { const died = hit.animal.applyDamage(12, hit.point, dir); if (!died) hit.animal.stagger(push.copy(dir), 0.2); console.log('[enemies] blow', hit.animal.kind, 'hp', hit.animal.hp, died ? 'DIED' : ''); }
});

(window as unknown as { __world: unknown }).__world = { ...world, animals, enemies, cove, wreck, palms, palmSpecs, shrine, heightAt, THREE };
game.buildComposer();
game.start();
