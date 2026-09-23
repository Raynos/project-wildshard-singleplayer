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
  tour: Tour;
  /** the shard being played (src/chunks/registry.ts) */
  chunk: ChunkDef;
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

  const player = new Player(game.camera, forest, canvas);
  player.spawn(num('x', def.spawn.x), num('z', def.spawn.z), num('yaw', def.spawn.yaw));
  player.pitch = num('pitch', 0);
  canvas.addEventListener('click', () => { if (!params.has('nolock')) player.lock(); });

  if (params.get('debug') === 'card') {
    // show the baked branch card in front of the camera
    const m = factory.needleMaterial;
    const tex = params.get('map') === 'normal' ? m.normalMap : params.get('map') === 'arm' ? ('roughnessMap' in m ? m.roughnessMap : null) : m.map;
    const q = new THREE.Mesh(new THREE.PlaneGeometry(2, 1), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
    game.camera.add(q); q.position.set(0, 0, -1.2); game.scene.add(game.camera);
  }

  const tour = new Tour(game.camera);
  tour.active = params.has('tour');
  game.onUpdate((dt) => {
    if (tour.active) { tour.setTime(tour.time); player.position.copy(game.camera.position); player.position.y -= 1.7; }
    else player.update(dt);
    forest.update(dt, player.position);
  });
  (window as unknown as { __hf: unknown }).__hf = Heightfield;
  return { game, sky, terrain, forest, player, tour, chunk: getActiveChunk(), params, num };
}
