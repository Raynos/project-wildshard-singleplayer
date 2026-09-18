// Dev entry: Driftwood Isle — base world + Ocean + Pier (+ the later pieces) without main.ts' kit.
// http://localhost:5173/dev/driftwood.html?chunk=driftwood-isle&nolock=1&x=0&z=-240&yaw=3.1416&pitch=0
// window.__world = { ...bootstrap(), ocean, pier, boundary, horizon }
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
import { Trailside } from '../world/Trailside';
import { HUT, LOOKOUT, WRECK, SHRINE, JETTIES } from '../chunks/driftwood-isle';
import { Boundary } from '../world/Boundary';
import { Horizon } from '../world/Horizon';
import { CHUNK_HALF, ROAD_LENGTH } from '../core/config';
import { heightAt } from '../world/Heightfield';

if (!new URLSearchParams(location.search).has('chunk')) { location.search += (location.search ? '&' : '?') + 'chunk=driftwood-isle'; }

const world = await bootstrap();
const T: Record<string, number> = {}; let _t0 = performance.now();
const lap = (k: string) => { const t = performance.now(); T[k] = Math.round(t - _t0); _t0 = t; };
const { game, sky, player, chunk } = world;

const ocean = chunk.ocean ? new Ocean(sky).build() : null;
if (ocean) game.scene.add(ocean.group);
lap('ocean');

const pier = new Pier(sky, { x: 0, z: -CHUNK_HALF, length: ROAD_LENGTH, width: 4, deckY: (chunk.ocean?.level ?? 0) + 1.2 }).build();
game.scene.add(pier.group);
player.colliders.push(...pier.colliders);
player.platforms.push((x, z) => pier.floorHeightAt(x, z));
{ const y = pier.floorHeightAt(player.position.x, player.position.z); if (y !== undefined) player.position.y = y; }

const jetties = JETTIES.map((j) => new Pier(sky, { x: j.x, z: j.z, rot: j.rot, length: j.length, width: 3, deckY: (chunk.ocean?.level ?? 0) + 1.2 }).build());
for (const j of jetties) { game.scene.add(j.group); player.colliders.push(...j.colliders); player.platforms.push((x, z) => j.floorHeightAt(x, z)); }
lap('piers');

const boat = new Boat(sky, { x: -4.2, z: -CHUNK_HALF + 6, heading: 0, waterY: chunk.ocean?.level ?? 0, moorTo: pier.mooringsFor(-4.2, -CHUNK_HALF + 6) }).build();
game.scene.add(boat.group); if (boat.ropes) game.scene.add(boat.ropes);
player.colliders.push(...boat.colliders);
player.platforms.push((x, z) => boat.floorHeightAt(x, z));
lap('boat');

const rocks = new Boulders(sky).build(Boulders.scatterShore(chunk.seed));
game.scene.add(rocks.mesh);
player.colliders.push(...rocks.colliders);
lap('boulders');

const hut = new Hut(sky, HUT).build();
game.scene.add(hut.group);
player.colliders.push(...hut.colliders);
player.platforms.push((x, z) => hut.floorHeightAt(x, z));
lap('hut');

const palms = new Palms(sky).build(Palms.scatterIsland(chunk.seed, undefined, [{ x: HUT.x, z: HUT.z, r: 11 }, { x: LOOKOUT.x, z: LOOKOUT.z, r: 12 }, { x: SHRINE.x, z: SHRINE.z, r: 13 }, { x: WRECK.x, z: WRECK.z, r: 14 }]));
game.scene.add(palms.mesh);
player.colliders.push(...palms.colliders);
lap('palms');

const lookout = new Lookout(sky, LOOKOUT).build();
game.scene.add(lookout.group);
player.colliders.push(...lookout.colliders);
player.platforms.push((x, z) => lookout.floorHeightAt(x, z));
lap('lookout');

const wreck = new Wreck(sky, WRECK).build();
game.scene.add(wreck.group);
player.colliders.push(...wreck.colliders);
player.platforms.push((x, z) => wreck.floorHeightAt(x, z));
lap('wreck');

const shrine = new Shrine(sky, SHRINE).build();
game.scene.add(shrine.group);
player.colliders.push(...shrine.colliders);
player.platforms.push((x, z) => shrine.floorHeightAt(x, z));
lap('shrine');

const AVOID = [{ x: HUT.x, z: HUT.z, r: 11 }, { x: LOOKOUT.x, z: LOOKOUT.z, r: 12 }, { x: SHRINE.x, z: SHRINE.z, r: 13 }, { x: WRECK.x, z: WRECK.z, r: 14 }];
const bushes = new Bushes(sky).build(Bushes.scatterIsland(chunk.seed, undefined, AVOID));
game.scene.add(bushes.mesh);
lap('bushes');
console.log('[driftwood] build ms', JSON.stringify(T));

const trailside = new Trailside(sky).build(Trailside.forIsland());
game.scene.add(trailside.mesh);
player.colliders.push(...trailside.colliders);
lap('trailside');

const boundary = new Boundary(sky).build();
game.scene.add(boundary.group);
const horizon = new Horizon(sky).build();
game.scene.add(horizon.group);

game.onUpdate((dt, t) => { ocean?.update(dt); boat.update(dt); palms.update(dt); boundary.update(dt, t); horizon.update(dt, game.camera); });

(window as unknown as { __world: unknown }).__world = { ...world, ocean, pier, jetties, boat, rocks, hut, palms, lookout, wreck, shrine, bushes, trailside, boundary, horizon, heightAt, buildMs: T };
game.buildComposer();
game.start();
