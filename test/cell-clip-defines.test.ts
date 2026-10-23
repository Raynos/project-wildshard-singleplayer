import { expect, test } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshLambertMaterial, MeshStandardMaterial } from 'three';
import { Scope } from '../src/engine/app/scope';
import { cellClip } from '../src/game/grid/cellClip';

test('a clipped variant keeps its source\'s defines (the cascades\' USE_CSM), so it shadows and keys like its source', () => {
  const scope = new Scope('clip defines'), root = new Group();
  try {
    const lambert = new MeshLambertMaterial(), standard = new MeshStandardMaterial();
    for (const material of [lambert, standard]) material.defines = { ...material.defines, USE_CSM: 1, CSM_CASCADES: 3, CSM_FADE: '' };
    const guard = cellClip(root, 250, scope); guard.sweep();
    const plain = new Mesh(new BoxGeometry(2, 40, 2), lambert); plain.position.x = 250; root.add(plain);
    const physical = new Mesh(new BoxGeometry(2, 40, 2), standard); physical.position.x = -250; root.add(physical);
    expect(plain.material).not.toBe(lambert); expect(physical.material).not.toBe(standard);
    expect(plain.material.defines).toEqual({ USE_CSM: 1, CSM_CASCADES: 3, CSM_FADE: '' });
    expect(physical.material.defines).toEqual({ STANDARD: '', USE_CSM: 1, CSM_CASCADES: 3, CSM_FADE: '' });
    expect(plain.material.defines).not.toBe(lambert.defines);
  } finally { scope.dispose(); }
});
