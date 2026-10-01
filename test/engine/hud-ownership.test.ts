// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { HudSlots } from '../../src/engine/ui/hudSlots';
import { Scope } from '../../src/engine/app/scope';

describe('explicit HUD owners', () => {
  it('resolves widget descendants and child scope ancestry while parked, then forgets discarded nodes', () => {
    const hud = new HudSlots(), level = new Scope('level'), owner = level.child('widget');
    const root = document.createElement('div'), widget = document.createElement('div'), child = document.createElement('span');
    widget.append(child); hud.widget('band.1', widget, 0, owner, root);
    expect(hud.ownerOf(widget)).toBe(owner); expect(hud.ownerOf(child)?.belongsTo(level)).toBe(true);
    widget.remove(); expect(hud.ownerOf(child)).toBe(owner);
    const state = hud.snapshot(); hud.restore(state); expect(hud.ownerOf(child)).toBe(owner);
    owner.dispose(); expect(hud.ownerOf(widget)).toBeNull(); expect(hud.ownerOf(child)).toBeNull();
    hud.widget('band.1', widget, 0, owner, root); expect(root.children).toHaveLength(0);
    expect(hud.ownerOf(widget)).toBeNull(); level.dispose();
  });

  it('owns queued discs and pills through their scopes and cancels placement on disposal', () => {
    const hud = new HudSlots(), scope = new Scope('controls'), pill = document.createElement('div');
    const disc = hud.disc({ cls: 'fixture', icon: '', label: 'Fixture', spot: 'up0' }, scope);
    hud.pill(pill, () => { /* Fixture gesture. */ }, scope);
    expect(hud.ownerOf(disc)).toBe(scope); expect(hud.ownerOf(pill)).toBe(scope);
    scope.dispose();
    expect(hud.ownerOf(disc)).toBeNull(); expect(hud.ownerOf(pill)).toBeNull();
    const layer = document.createElement('div'), status = document.createElement('div'); hud.mount(layer, status);
    expect(layer.children).toHaveLength(0); expect(status.children).toHaveLength(0);
  });
});
