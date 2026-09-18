// Dev entry: Driftwood Isle — base world + Ocean + Pier (+ the later pieces) without main.ts' kit.
// http://localhost:5173/dev/driftwood.html?chunk=driftwood-isle&nolock=1&x=0&z=-240&yaw=3.1416&pitch=0
// window.__world = { ...bootstrap(), ocean, pier, boundary, horizon }
import { bootstrap } from '../core/bootstrap';
import { Ocean } from '../world/Ocean';
import { Pier } from '../world/Pier';
import { Boundary } from '../world/Boundary';
import { Horizon } from '../world/Horizon';
import { CHUNK_HALF, ROAD_LENGTH } from '../core/config';
import { heightAt } from '../world/Heightfield';

if (!new URLSearchParams(location.search).has('chunk')) { location.search += (location.search ? '&' : '?') + 'chunk=driftwood-isle'; }

const world = await bootstrap();
const { game, sky, player, chunk } = world;

const ocean = chunk.ocean ? new Ocean(sky).build() : null;
if (ocean) game.scene.add(ocean.group);

const pier = new Pier(sky, { x: 0, z: -CHUNK_HALF, length: ROAD_LENGTH, width: 4, deckY: (chunk.ocean?.level ?? 0) + 1.2 }).build();
game.scene.add(pier.group);
player.colliders.push(...pier.colliders);
player.platforms.push((x, z) => pier.floorHeightAt(x, z));
{ const y = pier.floorHeightAt(player.position.x, player.position.z); if (y !== undefined) player.position.y = y; }

const boundary = new Boundary(sky).build();
game.scene.add(boundary.group);
const horizon = new Horizon(sky).build();
game.scene.add(horizon.group);

game.onUpdate((dt, t) => { ocean?.update(dt); boundary.update(dt, t); horizon.update(dt, game.camera); });

(window as unknown as { __world: unknown }).__world = { ...world, ocean, pier, boundary, horizon, heightAt };
game.buildComposer();
game.start();
