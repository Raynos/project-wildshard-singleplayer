// @vitest-environment happy-dom
import { expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { Scope } from '../src/engine/app/scope';
import { GridCellEvents } from '../src/game/grid/boot';
import { installGridHud } from '../src/game/grid/gridHud';

it('names each copy on entry while preserving its biome, ordinary shard title and scoped lifetime', () => {
  const scope = new Scope('copy-title'), root = document.createElement('div'), cells = new GridCellEvents();
  document.body.append(root);
  try {
    const state = installGridHud({ scope, hudRoot: root, camera: new PerspectiveCamera(), cells,
      title: (cell) => cell.slug === '_template' ? { name: 'Template shard', subtitle: 'Grey-box teaching level' } : { name: 'Pine Hollow', subtitle: 'Forest' },
      accent: () => null, velocity: () => new Vector3(), live: () => true, onInput: () => undefined, onLate: () => undefined });
    const names: string[] = [];
    for (const instance of ['template-1', 'template-2', 'template-6']) {
      cells.enter({ instance, slug: '_template' });
      const name = root.querySelector('.ws-grid-title b')?.textContent ?? '';
      names.push(name); expect(name).toBe(`Template shard · ${instance.slice(-1)}`);
      expect(root.querySelector('.ws-grid-title span')?.textContent).toBe('Grey-box teaching level');
      expect(state().card).toBe(name);
      cells.leave();
    }
    expect(new Set(names).size).toBe(3);
    cells.enter({ instance: 'pine-hollow', slug: 'pine-hollow' });
    expect(state().card).toBe('Pine Hollow');
    scope.dispose(); expect(root.childElementCount).toBe(0);
  } finally { scope.dispose(); root.remove(); }
});
