import * as THREE from 'three';
import { Game } from './Game';
import { Terrain } from '../world/Terrain';
import { TreeFactory } from '../world/TreeFactory';
import { Forest } from '../world/Forest';
import { Player } from '../player/Player';
import type { Sky } from '../world/Sky';
import { Tour } from './Tour';
import * as Heightfield from '../world/Heightfield';
import { getActiveChunk, setActiveChunk, chunkSlugFromUrl } from '../chunks/registry';
import type { ChunkDef } from '../chunks/ChunkDef';

/** Tree builders by `ChunkTrees.factory` id. Add a species here when a shard needs one. */
const TREE_FACTORIES = {
  pine: (renderer: THREE.WebGLRenderer, def: ChunkDef) => new TreeFactory(renderer, { bark: def.trees.bark, twigAtlas: def.trees.twigAtlas }).build(),
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
 * URL params: ?chunk=<slug>  which shard (default pine-hollow, see src/chunks/registry.ts)
 *             ?x=&z=&yaw=&pitch=  spawn pose (metres / radians)
 */
export async function bootstrap(onStep: (label: string, frac: number) => void = () => {}): Promise<World> {
  const params = new URLSearchParams(location.search);
  const num = (k: string, d: number) => (params.has(k) ? parseFloat(params.get(k)!) : d);
  const def = setActiveChunk(chunkSlugFromUrl(location.search));
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const game = new Game(canvas);
  onStep('Reading the sky', 0.05);
  const sky = await game.buildSky();
  onStep('Shaping terrain · splat layers', 0.2);
  const terrain = await new Terrain().build();
  terrain.group.traverse((o) => { const m = (o as THREE.Mesh).material as THREE.Material | undefined; if (m) sky.setupMaterial(m); });
  game.scene.add(terrain.group);

  onStep('Baking branch cards', 0.4);
  const factory = await TREE_FACTORIES[def.trees.factory](game.renderer, def);
  onStep(`Planting ${def.trees.noun}`, 0.55);
  const forest = new Forest(factory, sky).build();
  game.scene.add(forest.group);
  terrain.applyCanopy(forest.canopyMap);

  const player = new Player(game.camera, forest, canvas);
  player.spawn(num('x', def.spawn.x), num('z', def.spawn.z), num('yaw', def.spawn.yaw));
  player.pitch = num('pitch', 0);
  canvas.addEventListener('click', () => { if (!params.has('nolock')) player.lock(); });

  if (params.get('debug') === 'card') {
    // show the baked branch card in front of the camera
    const m = factory.needleMaterial;
    const tex = params.get('map') === 'normal' ? m.normalMap : params.get('map') === 'arm' ? m.roughnessMap : m.map;
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
