import * as THREE from 'three';
import { Game } from './Game';
import { TERRAIN_RES } from './config';
import { Terrain } from '../world/Terrain';
import { TreeFactory } from '../world/TreeFactory';
import { SpruceFactory } from '../world/Spruce';
import { Forest } from '../world/Forest';
import { Player } from '../player/Player';
import type { Sky } from '../world/Sky';
import { Tour } from './Tour';
import * as Heightfield from '../world/Heightfield';
import { runDirect, type StepRunner } from '../boot/plan';
import { getActiveChunk, setActiveChunk, chunkSlugFromUrl } from '../chunks/registry';
import type { ChunkDef } from '../chunks/ChunkDef';
import { loadRapier } from '../physics/rapier';
import { Physics } from '../physics/Physics';
import { setActivePhysics } from '../physics/active';
import { loadNavmesh } from '../physics/navmesh';
import { setRagdollClock } from '../physics/ragdoll';
import { Bodies, setActiveBodies } from '../physics/bodies';
import { addEdgeWalls, addTerrain } from '../physics/terrain';
import { ColliderBridge } from '../physics/bridge';
import { addPiece } from '../physics/pieces';
import { activeRegistry, type WorldRegistry } from '../world/registry';
import { installPhysicsDebug } from '../physics/debug';

/** Tree builders by `ChunkTrees.factory` id. Add a species here when a shard needs one. */
const TREE_FACTORIES = {
  pine: (renderer: THREE.WebGLRenderer, def: ChunkDef, _sky: Sky) => new TreeFactory(renderer, { bark: def.trees.bark, twigAtlas: def.trees.twigAtlas }).build(),
  spruce: (renderer: THREE.WebGLRenderer, _def: ChunkDef, sky: Sky) => new SpruceFactory(renderer, sky).build(), // Nalati: painterly Tian Shan spruce (src/world/Spruce.ts)
  none: (renderer: THREE.WebGLRenderer, _def: ChunkDef, _sky: Sky) => new TreeFactory(renderer).buildEmpty(),
} as const;

export interface World {
  game: Game;
  sky: Sky;
  terrain: Terrain;
  forest: Forest;
  player: Player;
  /** the shard's Rapier world (src/physics/), stepped in Game's fixed 60 Hz loop */
  physics: Physics;
  /** every built thing, registered once (src/world/registry.ts): the scene, physics and the floors listen here */
  registry: WorldRegistry;
  tour: Tour;
  /** the shard being played (src/chunks/registry.ts) */
  chunk: ChunkDef;
  /** Explore World owns the camera (src/explore/Explore.ts): the player is not updated and does not drive it */
  freeCamera: boolean;
  params: URLSearchParams;
  num: (key: string, fallback: number) => number;
}

/**
 * Builds the base chunk (renderer, sky, terrain, forest, player) and returns the handles.
 * Feature entry points (dev/*.html) and main.ts both start here.
 *
 * URL params: ?chunk=<slug>  which shard (default driftwood-isle, see src/chunks/registry.ts)
 *             ?x=&z=&yaw=&pitch=  spawn pose (metres / radians)
 */
export async function bootstrap(step: StepRunner = runDirect): Promise<World> {
  const params = new URLSearchParams(location.search);
  const num = (k: string, d: number): number => { const v = params.get(k); return v === null ? d : Number.parseFloat(v); };
  const def = setActiveChunk(chunkSlugFromUrl(location.search));
  const rapier = loadRapier(); // streamed compile from the first moment of boot; the `physics` step below awaits it
  const navmesh = loadNavmesh(def.slug); // the shard's baked navmesh (P6b), a declared boot file; the `physics` step awaits it
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const game = await step('renderer', () => new Game(canvas));
  const sky = await step('sky', () => game.buildSky());
  const terrain = await step('terrain', async (p) => {
    const t = await new Terrain().build();
    t.group.traverse((o) => { const m = (o as THREE.Mesh).material as THREE.Material | undefined; if (m) sky.setupMaterial(m); });
    game.scene.add(t.group);
    p.detail(`${TERRAIN_RES}² heightfield · ${def.assets.groundLayers.length} splat layers`);
    return t;
  });
  const factory = await step('cards', () => TREE_FACTORIES[def.trees.factory](game.renderer, def, sky));
  const forest = await step('forest', (p) => {
    const f = new Forest(factory, sky).build();
    if (f.trees.length === 0) f.group.visible = false; // an ocean shard: the empty needle / twig batches still cost 24k tris + shadow draws on the phone
    else game.scene.add(f.group);
    terrain.applyCanopy(f.canopyMap);
    p.detail(`${f.trees.length.toLocaleString()} ${def.trees.noun}`);
    return f;
  });

  const physics = await step('physics', async (p) => {
    const ph = new Physics(await rapier);
    await navmesh;
    addTerrain(ph);
    addEdgeWalls(ph);
    p.detail(`${ph.world.colliders.len()} colliders`);
    return ph;
  });
  setActivePhysics(physics); // weapons, aim assist, interact query it (src/physics/active.ts)
  setRagdollClock(() => game.alpha); // ragdoll poses interpolate between fixed steps like everything else
  installPhysicsDebug(physics, game.scene, params);

  const player = new Player(game.camera, physics, canvas);
  setActiveBodies(new Bodies(physics, player.position).attach(game)); // PHYSICS P7: items as bodies (src/physics/bodies.ts), stepped in the fixed phases, capped near the player
  // the world's moving hand-made boxes (the interactables' doors / chests / levers, Wendell, the dev scenes' boxes), mirrored every fixed step
  const bridge = new ColliderBridge(physics, player.colliders);
  // the registry's listeners: a registered piece is drawn, collides, and (until P4 / P3) lends the player its floor
  const registry = activeRegistry(); // the one list of built things: scene, physics, floors and Explore's catalog read it
  const moving: (() => void)[] = []; // pieces that follow a moving object (the boat): posed every fixed step
  registry.onAdd((piece) => {
    if (piece.object) game.scene.add(piece.object);
    const added = addPiece(physics, piece);
    if (added.body) moving.push(added.sync);
    if (piece.floor && piece.solidFloor !== true) player.platforms.push(piece.floor);
  });
  // the forest's trunks (Pine Hollow's 1 770 pines; none on the island)
  if (forest.trees.length > 0) registry.add({ id: 'forest', name: 'Forest', category: 'nature', file: 'src/world/Forest.ts', surface: 'wood', colliders: forest.colliderDescs() });
  // the shard's paths as walkways where they cross ground steeper than the motor climbs (PHYSICS P4) — laid by main.ts
  // once the builders have registered their decks, so no board pokes up through one (`addPathWalkways`)
  player.spawn(num('x', def.spawn.x), num('z', def.spawn.z), num('yaw', def.spawn.yaw));
  player.pitch = num('pitch', 0);

  if (params.get('debug') === 'card') {
    // show the baked branch card in front of the camera
    const m = factory.needleMaterial;
    const tex = params.get('map') === 'normal' ? m.normalMap : params.get('map') === 'arm' ? ('roughnessMap' in m ? m.roughnessMap : null) : m.map;
    const q = new THREE.Mesh(new THREE.PlaneGeometry(2, 1), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
    game.camera.add(q); q.position.set(0, 0, -1.2); game.scene.add(game.camera);
  }

  const tour = new Tour(game.camera);
  tour.active = params.has('tour');
  const world: World = { game, sky, terrain, forest, player, physics, registry, tour, chunk: getActiveChunk(), params, num, freeCamera: false };
  canvas.addEventListener('click', () => { if (!params.has('nolock') && !world.freeCamera) player.lock(); }); // Explore's free camera keeps the cursor
  // frame phases (Game.ts): input → fixed steps (pre: move the boxes, step: advance the world, post: the player's move) → update → late
  const playing = () => !tour.active && !world.freeCamera;
  game.onInput((dt) => { if (playing()) player.input(dt); });
  game.onFixed('pre', () => { bridge.sync(); for (const m of moving) m(); });
  game.onFixed('step', () => { physics.step(); });
  game.onFixed('post', (dt) => { const on = playing(); player.setBodyEnabled(on); if (on) player.step(dt); });
  game.onUpdate((dt) => {
    if (tour.active) { tour.setTime(tour.time); player.position.copy(game.camera.position); player.position.y -= 1.7; }
    else if (!world.freeCamera) player.update(dt, game.alpha);
    forest.update(dt, world.freeCamera ? game.camera.position : player.position); // Explore's free camera: LOD around the eye, not the parked player
  });
  (window as unknown as { __hf: unknown }).__hf = Heightfield;
  return world;
}
