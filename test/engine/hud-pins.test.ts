// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { App, Scope, type DiscSpot, type TouchRelabel } from '#engine';
import { hudAdapters } from '#engine/ui/hudAdapters';
import type { Game } from '#engine/core/Game';
import { legacyDouble } from '../fake/FakeGame';

afterEach(() => document.body.replaceChildren());
describe('world pins and scoped touch relabels', () => {
  it('projects content in mount order, hides null/behind-camera pins, removes them and restores lower labels', () => {
    const app = new App(), scope = new Scope('hud'), root = document.createElement('div'); document.body.append(root);
    const camera = new PerspectiveCamera(72, 1, 0.1, 100); camera.updateMatrixWorld(true);
    let label: TouchRelabel | null = null;
    const adapters = hudAdapters(legacyDouble<Game>({ app, camera }), scope, root, (_spot: DiscSpot, hint) => { label = hint; });
    const mark = document.createElement('div'), chip = document.createElement('div');
    let at: Vector3 | null = new Vector3(0, 0, -10);
    const removeMark = adapters.pin(() => at, mark), removeChip = adapters.pin(new Vector3(0, 0, -10), chip);
    const project = (): void => { for (const system of app.systemsByPhase().late) system.run(0, 0); };
    project(); expect(root.children[0]).toBe(mark); expect(root.children[1]).toBe(chip);
    expect(mark.style.display).toBe('block'); expect(mark.style.transform).toContain('translate3d(');
    at = null; project(); expect(mark.style.display).toBe('none');
    at = new Vector3(0, 0, 10); project(); expect(mark.style.display).toBe('none');
    const low = adapters.relabel('lock', 'Lock', ''), high = adapters.relabel('lock', 'Grapple', 'claw', { label: 'Grapple', tone: 'ready', accent: '#ffcf70' });
    expect(label).toMatchObject({ label: 'Grapple', accent: '#ffcf70' }); high(); expect(label).toMatchObject({ label: 'Lock' });
    low(); expect(label).toBeNull(); removeMark(); removeChip(); expect(root.children).toHaveLength(0);
    scope.dispose(); expect(app.systemsByPhase().late).toHaveLength(0); app.engineScope.dispose();
  });
});
