// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { PerspectiveCamera, Vector3, type Mesh } from 'three';
import { Scope } from '../src/engine/app/scope';
import { GridAssembly } from '../src/game/grid/assembly';
import { GridCellEvents } from '../src/game/grid/boot';
import { copyAccent, copyMarks, copyNumber, numberQuads } from '../src/game/grid/copyIdentity';
import { installGridHud } from '../src/game/grid/gridHud';
import { ACCENTS } from '../src/game/shardfile/accent';

const copies = (mode: { developer: boolean; devserver: boolean }) => new GridAssembly(mode).cells.filter((cell) => cell.slug === '_template');

describe('template copies read distinct without a second product (playtest 1, SF52)', () => {
  it('declares a different accent and number for every template copy, in every mode', () => {
    for (const mode of [{ developer: false, devserver: false }, { developer: true, devserver: false }, { developer: true, devserver: true }]) {
      const cells = copies(mode);
      expect(cells.length).toBeGreaterThan(0);
      for (const cell of cells) expect(cell.identity).toBeDefined();
      expect(new Set(cells.map((cell) => cell.identity?.accent)).size).toBe(cells.length);
      expect(new Set(cells.map((cell) => copyNumber(cell.instance))).size).toBe(cells.length);
      // none takes the template's own accent (the solo template keeps it) or the road's
      for (const cell of cells) expect(cell.identity?.accent).not.toBe('sand');
    }
  });

  it('draws each copy\'s number as two merged meshes of a few KB, and nothing for a placement without identity', () => {
    for (const cell of copies({ developer: false, devserver: false })) {
      const marks = copyMarks(cell.instance, cell.identity);
      expect(marks).not.toBeNull();
      if (marks === null) continue;
      const meshes = marks.object.children as Mesh[];
      expect(meshes).toHaveLength(2);
      const bytes = meshes.reduce((sum, mesh) => sum + (mesh.geometry.getAttribute('position').array.byteLength), 0);
      expect(bytes).toBeLessThan(8 * 1024);
      marks.dispose();
      expect(marks.object.parent).toBeNull();
    }
    expect(copyMarks('template-solo', undefined)).toBeNull();
    expect(copyMarks('driftwood-isle', undefined)).toBeNull();
  });

  it('builds the seven-segment number the copy is named by', () => {
    expect(numberQuads(1).digits).toHaveLength(2);
    expect(numberQuads(8).digits).toHaveLength(7);
    expect(numberQuads(12).digits).toHaveLength(2 + 5);
    expect(copyNumber('template-5')).toBe(5);
    expect(copyNumber('pine-hollow')).toBeNull();
  });

  it('swaps the HUD to the copy\'s accent inside its cell and back to the road cyan outside', () => {
    const scope = new Scope('copy-accent'), root = document.createElement('div'), cells = new GridCellEvents();
    document.body.append(root);
    try {
      const state = installGridHud({ scope, hudRoot: root, camera: new PerspectiveCamera(), cells,
        title: () => ({ name: 'Template shard', subtitle: '' }), accent: () => ACCENTS.sand, velocity: () => new Vector3(), live: () => true,
        onInput: () => undefined, onLate: () => undefined });
      const seen = new Set<string>();
      for (const cell of copies({ developer: false, devserver: false })) {
        cells.enter({ instance: cell.instance, slug: cell.slug });
        expect(state().accent).toBe(copyAccent(cell.instance));
        seen.add(state().accent);
        cells.leave();
      }
      expect(seen.size).toBe(copies({ developer: false, devserver: false }).length);
      cells.enter({ instance: 'template-solo', slug: '_template' });
      expect(state().accent).toBe(ACCENTS.sand);
    } finally { scope.dispose(); root.remove(); }
  });
});
