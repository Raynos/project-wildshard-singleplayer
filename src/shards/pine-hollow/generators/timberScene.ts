/** Pine's retained timber builders, expressed as real world meshes in one author Scene. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { bake, WholeShape, type BakedScene } from '@wildshard/sdk/bake';
import type { TimberBuilder } from './timberKit';
import { TimberRecorder } from './timberBake';
import { bakeFireLookout } from './fireLookout';
import { bakeSiteTimbers } from './siteTimbers';
import { timberFrame, ZIP_YAW, landingSite, bridgeSite } from './timberPlacement';
import { LOOKOUT } from '../data/layout';

/** Original non-indexed material draws, before any world placement or finishing policy. */
export function timberDraws(timber: TimberBuilder): Map<string, THREE.BufferGeometry> {
  const { parts, glass } = timber.built();
  const draws = new Map<string, THREE.BufferGeometry>();
  const add = (key: string, list: readonly THREE.BufferGeometry[]): void => {
    if (list.length === 0) return;
    const expanded = list.map(part => part.index === null ? part : part.toNonIndexed());
    const geometry = mergeGeometries(expanded);
    for (let i = 0; i < expanded.length; i++) if (expanded[i] !== list[i]) expanded[i]?.dispose();
    draws.set(key, geometry);
  };
  for (const [key, list] of parts) add(key, list); add('glass', glass);
  return draws;
}

function addTimber(scene: THREE.Scene, timber: TimberBuilder, identity: string, frame: THREE.Matrix4): void {
  for (const [key, geometry] of timberDraws(timber)) {
    const material = new THREE.MeshStandardMaterial({ roughness: 1 }); material.name = key;
    const whole = new WholeShape(`${identity}-${key}`, new THREE.Mesh(geometry, material), { nativeAttributes: true, partition: true });
    whole.matrixAutoUpdate = false; whole.matrix.copy(frame); scene.add(whole);
  }
}

/** Original lookout at its crag-top site; no collider, rider or lamp owner is installed at author time. */
export function pineLookoutScene(heightAt: (x: number, z: number) => number): THREE.Scene {
  const scene = new THREE.Scene(); scene.name = 'pine-hollow.lookout';
  const frame = timberFrame(LOOKOUT.x, heightAt(LOOKOUT.x, LOOKOUT.z), LOOKOUT.z, ZIP_YAW);
  bakeFireLookout(new TimberRecorder(timber => { addTimber(scene, timber, 'fire-lookout', frame); }));
  return scene;
}

/** Only actual world copies are placed. Turntable oracle copies never become fake world instances. */
export function pineSiteTimberScene(heightAt: (x: number, z: number) => number): THREE.Scene {
  const scene = new THREE.Scene(); scene.name = 'pine-hollow.site-timbers';
  const landing = landingSite(heightAt), crossing = bridgeSite(heightAt);
  bakeSiteTimbers(heightAt, new TimberRecorder((timber, _row, ordinal) => {
    if (ordinal === 0) addTimber(scene, timber, 'zipline-landing', landing.at);
    else if (ordinal === 2) addTimber(scene, timber, 'creek-footbridge', crossing.at);
  }));
  return scene;
}

function finish(scene: THREE.Scene, project?: string): BakedScene {
  try { return bake(scene, { slug: 'pine-hollow', name: 'Pine Hollow' }, project === undefined ? {} : { project }); }
  finally {
    scene.traverse(node => {
      if (!(node instanceof THREE.Mesh)) return;
      const geometry: unknown = node.geometry, material: unknown = node.material;
      if (geometry instanceof THREE.BufferGeometry) geometry.dispose();
      if (material instanceof THREE.Material) material.dispose();
    });
  }
}
/** Central Scene bake of the placed lookout, retaining ordinals for exact original-draw assembly. */
export function pineLookoutBake(heightAt: (x: number, z: number) => number, project?: string): BakedScene { return finish(pineLookoutScene(heightAt), project); }
/** Central Scene bake of the landing and footbridge, with original renderer-fitted geometry and placements. */
export function pineSiteTimberBake(heightAt: (x: number, z: number) => number, project?: string): BakedScene { return finish(pineSiteTimberScene(heightAt), project); }
