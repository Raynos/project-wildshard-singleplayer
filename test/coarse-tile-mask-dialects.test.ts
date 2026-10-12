import { describe, expect, it } from 'vitest';
import { BoxGeometry, GLSL3, Group, Mesh, MeshStandardMaterial } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { bool } from 'three/tsl';
import { Scope } from '../src/engine/app/scope';
import { coarseTileMask } from '../src/engine/world/coarseTileMask';
import { EngineNodesHandler } from '../src/engine/render/nodes/engineNodesHandler';
import { patchIds } from '../src/engine/render/shaderPatches';

describe('coarse masks across classic and node shader dialects', () => {
  it('declares matching explicit precision in the raw GLSL3 fallback', () => {
    const root = new Group(), shared = new MeshStandardMaterial();
    const mesh = new Mesh(new BoxGeometry(), shared); root.add(mesh);
    const scope = new Scope('test.raw-coarse-mask');
    coarseTileMask(root, 0, 0, scope);
    const shader = {
      uniforms: {}, isRawShaderMaterial: true, glslVersion: GLSL3,
      vertexShader: 'void main(){\n#include <project_vertex>\n}',
      fragmentShader: 'void main(){\n#include <clipping_planes_fragment>\n}',
    };
    Reflect.apply(mesh.material.onBeforeCompile.bind(mesh.material), mesh.material, [shader, {}]);
    expect(shader.vertexShader).toMatch(/^out highp vec2 wsCoarseXZ;/u);
    expect(shader.fragmentShader).toMatch(/^in highp vec2 wsCoarseXZ; uniform highp vec2 wsCoarseOrigin; uniform highp vec4 wsCoarseMask;/u);
    expect(shader.vertexShader).not.toMatch(/\bvarying\b/u);
    expect(shader.fragmentShader).not.toMatch(/\bvarying\b/u);
    expect(shader.vertexShader).toContain('instanceMatrix * wsCoarsePosition');
    expect(shader.fragmentShader).toContain('if (wsCoarseHidden > 0.5) discard;');
    scope.dispose(); mesh.geometry.dispose(); shared.dispose();
  });

  it('composes a native mask per tile while preserving the shared node mask', () => {
    new EngineNodesHandler(); // Explicit backend installation; no renderer or GPU needed.
    const shared = new MeshStandardNodeMaterial();
    shared.maskNode = bool(true);
    const original = shared.maskNode;
    const roots = [0, 1].map((x) => {
      const root = new Group(), mesh = new Mesh(new BoxGeometry(), shared);
      root.add(mesh);
      const scope = new Scope('test.native-coarse-mask');
      const update = coarseTileMask(root, x, 0, scope);
      return {root, mesh, scope, update};
    });
    expect(shared.maskNode).toBe(original);
    const masks = roots.map(({mesh}) => {
      expect(mesh.material).not.toBe(shared);
      expect(mesh.material.maskNode).not.toBeNull();
      expect(mesh.material.maskNode).not.toBe(original);
      expect(patchIds(mesh.material)).not.toContain('engine.coarse-tile-mask');
      return mesh.material.maskNode;
    });
    expect(masks[0]).not.toBe(masks[1]);
    for (const row of roots) {
      row.update(new Set([0, 1, 2, 3])); expect(row.root.visible).toBe(false);
      row.update(new Set([0])); expect(row.root.visible).toBe(true);
      row.scope.dispose(); expect(row.mesh.material).toBe(shared);
      row.mesh.geometry.dispose();
    }
    shared.dispose();
  });
});
