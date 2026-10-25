// @vitest-environment happy-dom
import { expect, test, vi } from 'vitest';
import { PerspectiveCamera } from 'three';
import { legacyDouble } from '@wildshard/engine/test/FakeGame';
import { Scope } from '@wildshard/engine/app/scope';
import { withOwner } from '@wildshard/engine/app/ownership';
import type { GameMenu } from '@wildshard/engine/ui/Menu';
import type { HUD } from '@wildshard/engine/ui/HUD';
import type { AnimalManager } from '@wildshard/engine/entities/AnimalManager';
import { BagMenu } from '../src/game/bag/tabs';
import { Inventory } from '../src/game/Inventory';
import { Progress } from '../src/game/Progress';
import { compendiumFor, registerCompendium } from '../src/game/compendium/registry';
import { shardContentIdentity } from '../src/game/shard/list';
import type { CompendiumHost } from '../src/game/compendium/install';
import { PINE_HOLLOW_COMPENDIUM } from '../src/shards/pine-hollow-legacy/compendium';
import { installPineCompendium } from '../src/shards/pine-hollow-legacy/compendium/install';

test('the frozen manifest opens its authored journal and retains the original save identity', async () => {
  const owner = new Scope('pine-journal-entry');
  const unregister = registerCompendium(PINE_HOLLOW_COMPENDIUM);
  const resume = vi.fn<() => void>(), enable = vi.fn<(on: boolean) => void>();
  try {
    expect(shardContentIdentity('pine-hollow-legacy')).toBe('pine-hollow');
    expect(compendiumFor('unregistered-pine-hollow-legacy')).toBeUndefined();
    const installed = withOwner(owner, () => {
      const menu = legacyDouble<GameMenu>({ scope: owner, isOpen: false, refresh: vi.fn<() => void>(),
        addTab: () => vi.fn<() => void>(), addTabFragment: () => vi.fn<() => void>() });
      new BagMenu(menu, { progress: new Progress('pine-journal-fixture'), inventory: new Inventory('pine-journal-fixture'), kit: () => [] });
      return installPineCompendium({ chunkId: 'pine-hollow-legacy', menu,
        game: { onUpdate: vi.fn<CompendiumHost['game']['onUpdate']>() }, camera: new PerspectiveCamera(),
        hud: legacyDouble<HUD>({ entered: true, holdPause: false, toast: vi.fn<HUD['toast']>(), onResume: resume }),
        animals: legacyDouble<AnimalManager>({ animals: [] }), cabins: null, interactables: [],
        weapons: { setEnabled: enable }, touchUi: () => true, nolock: true });
    });
    if (installed === null) throw new Error('Frozen Pine lost its authored journal');
    expect(installed.state.def).toBe(PINE_HOLLOW_COMPENDIUM);
    expect(installed.state.def.chunkId).toBe('chunk://local/pine-hollow');
    installed.state.take('ghost-stag');
    installed.journal.open('ghost-stag');
    await vi.dynamicImportSettled();
    await vi.waitFor(() => { expect(installed.journal.root.classList.contains('show')).toBe(true); });
    expect(installed.journal.root.querySelector<HTMLElement>('[data-entry="ghost-stag"]')?.dataset['state']).toBe('taken');
    expect(enable).toHaveBeenCalledWith(false);
    installed.journal.close();
    expect(resume).toHaveBeenCalledOnce();
  } finally { owner.dispose(); unregister(); }
});
