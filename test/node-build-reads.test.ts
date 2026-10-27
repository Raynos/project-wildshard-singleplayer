import { expect, test } from 'vitest';
import * as THREE from 'three';
import { NodeUniform, UniformNode } from 'three/webgpu';
import { pmremTexture, reference } from 'three/tsl';
import { buildReads } from '../src/engine/render/nodes/nodeBuildReuse';

const builder = (updates: { updateNodes?: unknown[]; updateBeforeNodes?: unknown[] }, fragment: unknown[] = []): object => ({
  updateNodes: updates.updateNodes ?? [], updateBeforeNodes: updates.updateBeforeNodes ?? [], updateAfterNodes: [],
  uniforms: { vertex: [], fragment }, uniformGroups: {} });

test('a build reads the scene environment only through a node that holds it', () => {
  const environment = new THREE.Texture(), other = new THREE.Texture();
  const lit = builder({ updateBeforeNodes: [pmremTexture(environment)] });
  expect(buildReads(lit, [environment])).toBe(true);
  expect(buildReads(lit, [other])).toBe(false);
  const plain = builder({}, [new NodeUniform('tint', 'float', new UniformNode(1))]);
  expect(buildReads(plain, [environment])).toBe(false);
});

test('a fog reference reads its fog; an unreadable builder counts as reading', () => {
  const fog = new THREE.Fog(0xffffff, 1, 10);
  expect(buildReads(builder({ updateNodes: [reference('near', 'float', fog)] }), [fog])).toBe(true);
  expect(buildReads(builder({ updateNodes: [reference('near', 'float', new THREE.Fog(0, 1, 2))] }), [fog])).toBe(false);
  expect(buildReads({ uniforms: { vertex: [], fragment: [] } }, [fog])).toBe(true);
  expect(buildReads(null, [fog])).toBe(true);
});
