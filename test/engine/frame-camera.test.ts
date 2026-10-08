// SF63 (E435): content that culls against the camera measures it from its own frame. A grid region's content stands under
// its view root at the cell's render offset while the page camera is in the page's space; `FrameCamera` is the camera seen
// from that root, and `place`'s cullers use it for a registry with a `frame` (standalone: the camera itself, unchanged).
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { FrameCamera } from '../../src/engine/world/frameCamera';
import { WorldRegistry } from '../../src/engine/world/registry';
import { modelContext, type ModelDef } from '../../src/engine/models/model';
import { cullPlaced, place } from '../../src/engine/models/place';

const material = new THREE.MeshBasicMaterial();
const rock: ModelDef<{ s: number }> = {
  id: 'shared/test-frame-rock', name: 'Rock', category: 'nature', pipeline: 'code', file: 'test/engine/frame-camera.test.ts', defaults: { s: 1 },
  build: (_c, p) => [{ geometry: new THREE.BoxGeometry(p.s, p.s, p.s), material, castShadow: true }],
};
const OFFSET = new THREE.Vector3(-555, 0, 0);
const camera = (at: THREE.Vector3): THREE.PerspectiveCamera => {
  const c = new THREE.PerspectiveCamera(60, 1, 0.1, 500);
  c.position.set(at.x, 2, at.z + 10); c.lookAt(at.x, 0, at.z); c.updateMatrixWorld(true);
  return c;
};
const root = (): THREE.Group => { const g = new THREE.Group(); g.position.copy(OFFSET); g.updateMatrixWorld(true); return g; };
const drawn = (object: THREE.Object3D): number => {
  let n = 0;
  object.traverse((o) => { if (o instanceof THREE.InstancedMesh) n += o.count; });
  return n;
};

describe('FrameCamera (SF63)', () => {
  it('is the camera itself while the frame is the scene\'s own', () => {
    const cam = camera(new THREE.Vector3());
    expect(new FrameCamera(new THREE.Group()).of(cam)).toBe(cam);
  });

  it('poses a stand-in at the camera seen from an offset frame, with its projection', () => {
    const cam = camera(OFFSET), local = new FrameCamera(root()).of(cam);
    expect(local).not.toBe(cam);
    expect(local.position.toArray().map((v) => Math.round(v * 1000) / 1000)).toEqual([0, 2, 10]);
    expect(local.projectionMatrix.equals(cam.projectionMatrix)).toBe(true);
    expect(local.fov).toBe(60);
    const d = new THREE.Vector3(), e = new THREE.Vector3();
    expect(local.getWorldDirection(d).distanceTo(cam.getWorldDirection(e))).toBeLessThan(1e-9);
  });

  it('place culls a framed registry\'s copies against the camera seen from its frame', () => {
    const ctx = modelContext(null), copies = Array.from({ length: 6 }, (_, i) => ({ x: i * 2 - 5, y: 0, z: 0 }));
    // the region's registry: its frame is the root at the cell's render offset; the camera stands over the copies in page space
    const framed = new WorldRegistry(); framed.frame = root();
    const inFrame = place(rock, copies, { ctx, draw: 'instanced', cull: { far: 60 }, registry: framed });
    // the same copies in a registry with no frame: the page camera is 555 m away from their boxes, so none is drawn
    const plain = new WorldRegistry();
    const unframed = place(rock, copies, { ctx, draw: 'instanced', cull: { far: 60 }, registry: plain });
    cullPlaced(camera(OFFSET));
    expect(drawn(inFrame.object)).toBe(6);
    expect(drawn(unframed.object)).toBe(0);
    framed.retire(); plain.retire();
  });
});
