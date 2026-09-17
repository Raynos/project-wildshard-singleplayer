import * as THREE from 'three';
import { Game } from './Game';
import { Terrain } from '../world/Terrain';
import { TreeFactory } from '../world/TreeFactory';
import { Forest } from '../world/Forest';
import { Player } from '../player/Player';
import type { Sky } from '../world/Sky';
import { Tour } from './Tour';

export interface World {
  game: Game;
  sky: Sky;
  terrain: Terrain;
  forest: Forest;
  player: Player;
  tour: Tour | null;
  params: URLSearchParams;
  num: (key: string, fallback: number) => number;
}

/**
 * Builds the base chunk (renderer, sky, terrain, forest, player) and returns the handles.
 * Feature entry points (dev/*.html) and main.ts both start here.
 *
 * URL params: ?x=&z=&yaw=&pitch=  spawn pose (metres / radians)
 */
export async function bootstrap(): Promise<World> {
  const params = new URLSearchParams(location.search);
  const num = (k: string, d: number) => (params.has(k) ? parseFloat(params.get(k)!) : d);
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const game = new Game(canvas);
  const sky = await game.buildSky();
  const terrain = await new Terrain().build();
  terrain.group.traverse((o) => { const m = (o as THREE.Mesh).material as THREE.Material | undefined; if (m) sky.setupMaterial(m); });
  game.scene.add(terrain.group);

  const factory = await new TreeFactory(game.renderer).build();
  const forest = new Forest(factory, sky).build();
  game.scene.add(forest.group);

  const player = new Player(game.camera, forest, canvas);
  player.spawn(num('x', 0), num('z', -235), num('yaw', 0));
  player.pitch = num('pitch', 0);
  canvas.addEventListener('click', () => { if (!params.has('nolock')) player.lock(); });

  if (params.get('debug') === 'card') {
    // show the baked branch card in front of the camera
    const m = factory.needleMaterial;
    const tex = params.get('map') === 'normal' ? m.normalMap : params.get('map') === 'arm' ? m.roughnessMap : m.map;
    const q = new THREE.Mesh(new THREE.PlaneGeometry(2, 1), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
    game.camera.add(q); q.position.set(0, 0, -1.2); game.scene.add(game.camera);
  }

  const tour = params.has('tour') ? new Tour(game.camera) : null;
  game.onUpdate((dt) => {
    if (tour) { tour.setTime(tour.time); player.position.copy(game.camera.position); player.position.y -= 1.7; }
    else player.update(dt);
    forest.update(dt, player.position);
  });
  return { game, sky, terrain, forest, player, tour, params, num };
}
