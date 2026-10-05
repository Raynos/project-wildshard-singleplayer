// SF59 step 2, fix 2 (docs/design/mmo/research/sf59-tsl-spike.md §2.3): the engine counts its own renders, so a node
// material's per-draw bump of three's `info.render.frame` never reaches the Memory saver or Nalati's grass placement.
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { installFrameCounter, renderCount } from '../../src/engine/render/frameCounter';

/** three r186's counting, as a stand-in: WebGLRenderer.render steps `info.render.frame` once before it draws, and the
 *  node handler's onBeforeRender steps it again for every node-material draw (WebGLNodesHandler.js) */
function fakeRenderer(nodeDrawsPerRender: () => number): { info: { render: { frame: number } }; render: (scene: THREE.Object3D, camera: THREE.Camera) => void; seen: number[] } {
  const r = {
    info: { render: { frame: 0 } },
    seen: [] as number[],
    render(_scene: THREE.Object3D, _camera: THREE.Camera): void {
      r.info.render.frame++;
      r.seen.push(renderCount(r)); // what a reader inside the render (a draw hook) sees
      for (let i = 0; i < nodeDrawsPerRender(); i++) { r.info.render.frame++; r.seen.push(renderCount(r)); }
    },
  };
  return r;
}

describe('the engine frame counter', () => {
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();

  it('has three\'s value with only classic materials on screen (behaviour identical for today\'s families)', () => {
    const r = fakeRenderer(() => 0);
    installFrameCounter(r);
    for (let i = 0; i < 5; i++) {
      r.render(scene, camera);
      expect(renderCount(r)).toBe(r.info.render.frame);
    }
    expect(r.seen).toEqual([1, 2, 3, 4, 5]);
  });

  it('advances once per rendered frame regardless of draws (node draws bump three\'s counter, not the engine\'s)', () => {
    let draws = 0;
    const r = fakeRenderer(() => draws);
    installFrameCounter(r);
    for (const n of [0, 3, 40, 1, 0]) { draws = n; r.render(scene, camera); }
    expect(renderCount(r)).toBe(5);
    expect(r.info.render.frame).toBe(5 + 44);
    // every reader inside one render sees one value: the grass places once per render, the saver settles once
    expect(r.seen).toEqual([1, 2, 2, 2, 2, ...Array.from({ length: 41 }, () => 3), 4, 4, 5]);
  });

  it('is idempotent and starts on first read for a renderer nobody installed', () => {
    const r = fakeRenderer(() => 2);
    expect(renderCount(r)).toBe(0);
    installFrameCounter(r);
    installFrameCounter(r);
    r.render(scene, camera);
    r.render(scene, camera);
    expect(renderCount(r)).toBe(2);
  });
});
