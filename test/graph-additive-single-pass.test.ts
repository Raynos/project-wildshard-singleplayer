import { expect, test } from 'vitest';
import * as THREE from 'three';
import { compileGraph } from '../src/engine/render/graph/compile';
import type { GraphIr } from '../src/format/materialGraph';

const glow = (effectState: NonNullable<GraphIr['effectState']>, doubleSided = true): GraphIr =>
  ({ version: 1, kind: 'material', model: 'unlit', nodes: {}, stages: { surface: { colour: [1, 0.5, 0] } }, doubleSided, effectState });

test('an additive double-sided graph that writes no depth draws in one pass (O14)', () => {
  const material = compileGraph(glow({ blend: 'additive', depthWrite: false })).material;
  expect(material.blending).toBe(THREE.AdditiveBlending);
  expect(material.side).toBe(THREE.DoubleSide);
  expect(material.forceSinglePass).toBe(true);
  material.dispose();
});

test('order-dependent blends keep three\'s two passes', () => {
  for (const [ir, why] of [[glow({ blend: 'alpha', depthWrite: false }), 'alpha blending'], [glow({ blend: 'additive' }), 'depth writes'],
    [glow({ blend: 'additive', depthWrite: false }, false), 'front faces only']] as const) {
    const material = compileGraph(ir).material;
    expect(material.forceSinglePass, why).toBe(false);
    material.dispose();
  }
});
