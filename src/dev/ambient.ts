// Dev entry: Driftwood Isle ambient — the driftwood dev world + Gulls (src/world/Gulls.ts) + the ringed planet.
// http://localhost:5173/dev/ambient.html?chunk=driftwood-isle&nolock=1&x=0&z=-235&yaw=3.1416&pitch=0
// window.__world = { ...bootstrap(), ocean, pier, boat, rocks, gulls, … }
import * as THREE from 'three';
import { bootstrap } from '../core/bootstrap';
import { Ocean } from '../world/Ocean';
import { Pier } from '../world/Pier';
import { Boat } from '../world/Boat';
import { Boulders } from '../world/Boulders';
import { Gulls } from '../world/Gulls';
import { Hut } from '../world/Hut';
import { Palms } from '../world/Palms';
import { Lookout } from '../world/Lookout';
import { Wreck } from '../world/Wreck';
import { Shrine } from '../world/Shrine';
import { HUT, LOOKOUT, WRECK, SHRINE } from '../chunks/driftwood-isle';
import { Boundary } from '../world/Boundary';
import { Horizon } from '../world/Horizon';
import { CHUNK_HALF, ROAD_LENGTH } from '../core/config';
import { heightAt } from '../world/Heightfield';

if (!new URLSearchParams(location.search).has('chunk')) { location.search += `${location.search ? '&' : '?'}chunk=driftwood-isle`; }

const world = await bootstrap();
const { game, sky, player, chunk } = world;

const ocean = chunk.ocean ? new Ocean(sky).build() : null;
if (ocean) game.scene.add(ocean.group);

const pier = new Pier(sky, { x: 0, z: -CHUNK_HALF, length: ROAD_LENGTH, width: 4, deckY: (chunk.ocean?.level ?? 0) + 1.2 }).build();
game.scene.add(pier.group);
player.colliders.push(...pier.colliders);
player.platforms.push((x, z) => pier.floorHeightAt(x, z));
{ const y = pier.floorHeightAt(player.position.x, player.position.z); if (y !== undefined) player.position.y = y; }

const boat = new Boat(sky, { x: -4.2, z: -CHUNK_HALF + 6, heading: 0, waterY: chunk.ocean?.level ?? 0, moorTo: pier.mooringsFor(-4.2, -CHUNK_HALF + 6) }).build();
game.scene.add(boat.group); if (boat.ropes) game.scene.add(boat.ropes);
player.colliders.push(...boat.colliders);
player.platforms.push((x, z) => boat.floorHeightAt(x, z));

const rockSpecs = Boulders.scatterShore(chunk.seed);
const rocks = new Boulders(sky).build(rockSpecs);
game.scene.add(rocks.mesh);
player.colliders.push(...rocks.colliders);

const hut = new Hut(sky, HUT).build();
game.scene.add(hut.group);
player.colliders.push(...hut.colliders);
player.platforms.push((x, z) => hut.floorHeightAt(x, z));

const palms = new Palms(sky).build(Palms.scatterIsland(chunk.seed, 150, [{ x: HUT.x, z: HUT.z, r: 11 }, { x: LOOKOUT.x, z: LOOKOUT.z, r: 12 }, { x: SHRINE.x, z: SHRINE.z, r: 13 }, { x: WRECK.x, z: WRECK.z, r: 14 }]));
game.scene.add(palms.mesh);
player.colliders.push(...palms.colliders);

const lookout = new Lookout(sky, LOOKOUT).build();
game.scene.add(lookout.group);
player.colliders.push(...lookout.colliders);
player.platforms.push((x, z) => lookout.floorHeightAt(x, z));

const wreck = new Wreck(sky, WRECK).build();
game.scene.add(wreck.group);
player.colliders.push(...wreck.colliders);
player.platforms.push((x, z) => wreck.floorHeightAt(x, z));

const shrine = new Shrine(sky, SHRINE).build();
game.scene.add(shrine.group);
player.colliders.push(...shrine.colliders);
player.platforms.push((x, z) => shrine.floorHeightAt(x, z));

// ── gulls: pier posts + bollards, the boat's bow and stern, the big beach rocks, a few spots on the wet sand ──
const deckY = pier.deckY;
const gulls = new Gulls(sky).build({
  perches: [
    ...pier.posts.map((p) => new THREE.Vector3(p.x, deckY + 1.02, p.z)),
    ...pier.bollards.map((p) => new THREE.Vector3(p.x, deckY + 1.41, p.z)),
    new THREE.Vector3(-4.2, (chunk.ocean?.level ?? 0) + 0.78, -CHUNK_HALF + 6 - 3.0), new THREE.Vector3(-4.2, (chunk.ocean?.level ?? 0) + 0.7, -CHUNK_HALF + 6 + 3.0),
    ...rockSpecs.filter((b) => b.r > 1.8).map((b) => new THREE.Vector3(b.x, heightAt(b.x, b.z) + b.r * (b.squash ?? 0.7) * 1.3, b.z)),
    ...Gulls.beachPerches(chunk.seed, 10, { x: 0, z: -195, r: 90 }),
  ],
  centre: new THREE.Vector3(0, 0, -205), radius: 90,
});
game.scene.add(gulls.group);
gulls.onCall = (pos) => console.log('[gull] squawk', pos.x.toFixed(0), pos.y.toFixed(0), pos.z.toFixed(0));

const boundary = new Boundary(sky).build();
game.scene.add(boundary.group);
const horizon = new Horizon(sky).build();
game.scene.add(horizon.group);

game.onUpdate((dt, t) => { ocean?.update(dt); boat.update(dt); palms.update(dt); gulls.update(dt, player.position); boundary.update(dt, t); horizon.update(dt, game.camera); });

(window as unknown as { __world: unknown }).__world = { ...world, ocean, pier, boat, rocks, gulls, hut, palms, lookout, wreck, shrine, boundary, horizon, heightAt };
game.buildComposer();
game.start();
