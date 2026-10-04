import { describe, expect, it } from 'vitest';
import { AppUi } from '../../src/engine/app/ui';
import { Scope } from '../../src/engine/app/scope';

describe('displayed prompt state', () => {
  it('reads the active resident HUD and forgets an evicted reader', () => {
    const beach = new Scope('beach'), forest = new Scope('forest');
    let active: Scope | null = beach, text = 'Talk to Wendell';
    const ui = new AppUi(() => active);
    ui.bind(beach, () => text); ui.bind(forest, () => 'Trade');
    expect(ui.prompt()).toBe('Talk to Wendell');
    text = ''; expect(ui.prompt()).toBe('');
    active = forest; expect(ui.prompt()).toBe('Trade');
    active = beach; beach.dispose(); expect(ui.prompt()).toBe('');
    active = null; expect(ui.prompt()).toBe('');
    forest.dispose();
  });
});
