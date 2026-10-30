import { expect, test } from 'vitest';
import { nativeSummary, attributionSummary, sampledCpu } from '../scripts/perf/draw-census-report.mjs';

test('render cost stays paired with its completed frame and zero draws stay unknown', () => {
  const result = nativeSummary([
    { calls: 10, renderMs: 2, workMs: 4, triangles: 100 },
    { calls: 100, renderMs: 1, workMs: 5, triangles: 200 },
    { calls: 0, renderMs: 3, workMs: 6, triangles: 0 },
  ]);
  expect(result.renderUsPerDrawP50).toBe(200);
  expect(result.zeroDrawFrames).toBe(1);
  expect(nativeSummary([{ calls: 0, renderMs: 0, workMs: 0, triangles: 0 }]).renderUsPerDrawP50).toBeNull();
  expect(() => nativeSummary([{ calls: 1, renderMs: Number.NaN, workMs: 0, triangles: 0 }])).toThrow('Invalid native');
});

test('all multi-draw submissions retain shadow, screen and owner attribution', () => {
  const draw = { owner: 'level>trees', count: 4, program: 1, materialId: 'm', geometryId: 'g', nodeMaterial: true, instances: 10, skinned: false };
  const result = attributionSummary([{ draws: [{ ...draw, pass: 'shadow' }, { ...draw, pass: 'render-target' },
    { ...draw, owner: 'post', pass: 'screen', program: 2, count: 1 }], useProgram: 3, uniforms: 8 }]);
  expect(result.draws).toBe(9);
  expect(result.passes).toEqual({ shadow: 4, 'render-target': 4, screen: 1 });
  expect(result.byOwner.find(row => row.owner === 'shadow|level>trees')?.drawsPerFrame).toBe(4);
  expect(result.programs).toBe(2);
});

test('CPU wrapper overhead excludes the stock draw and counts nested hooks once', () => {
  const callFrame = (source: string, name: string) => ({ source, name });
  const profile = { nodes: [
    { id: 1, callFrame: callFrame('/src/engine/core/worldDepth.ts', 'renderWorld'), children: [2] },
    { id: 2, callFrame: callFrame('/src/engine/render/uploadOwnership.ts', 'renderer.renderBufferDirect'), children: [3] },
    { id: 3, callFrame: callFrame('/src/engine/render/memorySaver.ts', 'renderer.renderBufferDirect'), children: [4] },
    { id: 4, callFrame: callFrame('/node_modules/three/src/renderers/WebGLRenderer.js', 'renderBufferDirect') },
  ], samples: [2, 3, 4], timeDeltas: [1000, 2000, 4000] };
  const result = sampledCpu(profile, frame => frame, 1);
  expect(result.msPerFrame).toMatchObject({ renderWorld: 7, stockDraw: 4, drawWrappers: 3 });
  expect(sampledCpu(profile, () => ({ source: '', name: '' }), 1).msPerFrame['drawWrappers']).toBeNull();
});
