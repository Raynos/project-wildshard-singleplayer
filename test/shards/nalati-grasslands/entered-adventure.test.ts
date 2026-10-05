// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
import { app } from '../../../src/engine/app/runtime';
import { withOwner } from '../../../src/engine/app/ownership';
import { createLevelInstallation } from '../../../src/engine/level/installation';
import { QuestChip } from '../../../src/engine/quest/view';
import { RewardCaption } from '../../../src/engine/quest/view/ui';
import { RetainedRuntimeHooks } from '../../../src/game/shard/retainedHooks';
import { shardContext } from '../../../src/game/shard/context';
import { emptyShardfileSource } from '../../../src/game/shardfile/loader';
import { emptyShardfile } from '../../../src/sdk/author';
import { installEnteredAdventure } from '../../../src/shards/nalati-grasslands/runtime/enteredAdventure';

it('detaches quest HUD, closes modal input and cancels rewards on the road, preserving positions across two entries', async () => {
  const hud = document.createElement('div'); hud.id = 'hud'; document.body.append(hud);
  const resident = app.engineScope.child('nalati.quest');
  const manifest = emptyShardfileSource(emptyShardfile({ slug: 'fixture', name: 'Fixture', author: 'Fixture', seed: 1, revision: 1 }));
  const installation = createLevelInstallation(app, resident, {}, () => ({ set: () => undefined, detail: () => undefined }));
  const hooks = new RetainedRuntimeHooks(shardContext(installation.context, manifest, { shard: manifest, rows: new Map(),
    bag: { tab: () => () => undefined, fragment: () => () => undefined } }));
  const chip = withOwner(resident, () => new QuestChip({ chip: () => ({ label: 'Quest', count: '1/2' }), markers: () => [] }));
  chip.line.root.style.top = '42px';
  const afterChip = document.createElement('span'); hud.append(afterChip);
  const entered = installEnteredAdventure(hooks.context, chip.line.root);
  const caption = withOwner(resident, () => new RewardCaption('Reward', 'Quest', 'Done'));
  entered.caption(caption.root);
  let completed = 0, timerCalls = 0;
  vi.useFakeTimers();
  try {
    for (let visit = 0; visit < 2; visit++) {
      if (visit > 0) hooks.activate();
      expect(chip.line.root.parentNode).toBe(hud); expect(chip.line.root.nextSibling).toBe(afterChip);
      expect(chip.line.root.style.top).toBe('42px'); expect(caption.root.parentNode).toBe(hud);
      const dialogue = entered.dialogue;
      dialogue.open('Elder', ['An unfinished quest'], () => { completed++; });
      expect(dialogue.isOpen).toBe(true); caption.show(true); chip.line.root.classList.add('ws-quest-hide');
      entered.timeout(6500, () => { timerCalls++; });
      expect(resident.census.timers).toBe(1);
      hooks.deactivate();
      expect(dialogue.isOpen).toBe(false); expect(dialogue.root.isConnected).toBe(false);
      expect(chip.line.root.isConnected).toBe(false); expect(caption.root.isConnected).toBe(false);
      expect(chip.line.root.classList.contains('ws-quest-hide')).toBe(false); expect(caption.root.classList.contains('show')).toBe(false);
      expect(resident.census.timers).toBe(0);
      expect(() => entered.dialogue).toThrow('left its cell');
      await vi.advanceTimersByTimeAsync(7000); expect(timerCalls).toBe(0); expect(completed).toBe(0);
    }
  } finally { vi.useRealTimers(); resident.dispose(); hud.remove(); }
  expect(resident.census.nodes).toBe(0); expect(resident.census.listeners).toBe(0); expect(resident.census.disposers).toBe(0);
});
