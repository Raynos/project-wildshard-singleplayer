// Dev entry: diving on Driftwood Isle — src/dev/driftwood.ts + the Seabed dressing, the swimming Hands and the dive audio hooks.
// http://localhost:5173/dev/dive.html?chunk=driftwood-isle&nolock=1&x=0&z=-235&yaw=3.1416&pitch=0
// window.__world = { ...bootstrap(), ocean, pier, seabed, hands, audio, … } — `__world.player.diveHeld = true` from the console dives.
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
import { Seabed } from '../world/Seabed';
import { Hands } from '../player/Hands';
import { Audio } from '../audio/Audio';
import { HUT, LOOKOUT, WRECK, SHRINE, JETTIES } from '../chunks/driftwood-isle';
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

const jetties = JETTIES.map((j) => new Pier(sky, { x: j.x, z: j.z, rot: j.rot, length: j.length, width: 3, deckY: (chunk.ocean?.level ?? 0) + 1.2 }).build());
for (const j of jetties) { game.scene.add(j.group); player.colliders.push(...j.colliders); player.platforms.push((x, z) => j.floorHeightAt(x, z)); }

const boat = new Boat(sky, { x: -4.2, z: -CHUNK_HALF + 6, heading: 0, waterY: chunk.ocean?.level ?? 0, moorTo: pier.mooringsFor(-4.2, -CHUNK_HALF + 6) }).build();
game.scene.add(boat.group); if (boat.ropes) game.scene.add(boat.ropes);
player.colliders.push(...boat.colliders);
player.platforms.push((x, z) => boat.floorHeightAt(x, z));

const rocks = new Boulders(sky).build(Boulders.scatterShore(chunk.seed));
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

const AVOID = [{ x: HUT.x, z: HUT.z, r: 11 }, { x: LOOKOUT.x, z: LOOKOUT.z, r: 12 }, { x: SHRINE.x, z: SHRINE.z, r: 13 }, { x: WRECK.x, z: WRECK.z, r: 14 }];
const bushes = new Bushes(sky).build(Bushes.scatterIsland(chunk.seed, 260, AVOID));
game.scene.add(bushes.mesh);

// ── the dive feature: seabed dressing (one draw call + the fish school), the gloved hands, the dive / surface audio ──
const seabedLayout = Seabed.scatterLagoon(chunk.seed, 360, [{ x: WRECK.x, z: WRECK.z, r: 18 }]);
const seabed = new Seabed(sky).build(seabedLayout);
game.scene.add(seabed.mesh); if (seabed.fish) game.scene.add(seabed.fish);
console.log('[seabed] ' + seabed.count + ' pieces, ' + seabed.tris + ' tris');

if (!game.camera.parent) game.scene.add(game.camera); // the weapon does this in main.ts: camera children (hands) and Player's fog lookup need it
const hands = new Hands(sky, game.camera);
const audio = new Audio();
document.addEventListener('keydown', () => audio.resume(), { once: true });
document.addEventListener('mousedown', () => audio.resume(), { once: true });
player.onEnterWater = (impact) => audio.splash(impact);
player.onExitWater = () => audio.waterExit();
player.onStroke = () => audio.swimStroke();
player.onSubmerge = () => { audio.dive(); audio.setUnderwater(true); };
player.onSurface = () => { audio.surface(); audio.setUnderwater(false); };

const boundary = new Boundary(sky).build();
game.scene.add(boundary.group);
const horizon = new Horizon(sky).build();
game.scene.add(horizon.group);

game.onUpdate((dt, t) => { ocean?.update(dt); boat.update(dt); palms.update(dt); seabed.update(dt); hands.update(dt, player); boundary.update(dt, t); horizon.update(dt, game.camera); audio.listenerYaw = player.yaw; });

(window as unknown as { __world: unknown }).__world = { ...world, ocean, pier, jetties, boat, rocks, hut, palms, lookout, wreck, shrine, bushes, seabed, seabedLayout, hands, audio, boundary, horizon, heightAt };
game.buildComposer();
game.start();
