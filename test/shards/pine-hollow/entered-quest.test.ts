// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
import { app } from '../../../src/engine/app/runtime';
import { withOwner } from '../../../src/engine/app/ownership';
import { createLevelInstallation } from '../../../src/engine/level/installation';
import { DialogueBox, RewardCaption, ObjectiveLine } from '../../../src/engine/quest/view/ui';
import { Flags } from '../../../src/engine/world/interact/flags';
import { ShopPanel } from '../../../src/game/loot/ui/ShopPanel';
import { shardContext } from '../../../src/game/shard/context';
import { RetainedRuntimeHooks } from '../../../src/game/shard/retainedHooks';
import { emptyShardfileSource } from '../../../src/game/shardfile/loader';
import { emptyShardfile } from '../../../src/sdk/author';
import { newBoard } from '../../../src/shards/pine-hollow/quest/contracts';
import { BoardPanel, CountChip } from '../../../src/shards/pine-hollow/quest/ui';
import { PineQuestLifetime } from '../../../src/shards/pine-hollow/runtime/questLifetime';

it('keeps Pine quest state and exact HUD placement across two entries with no road input or pending rewards', async () => {
  const hud = document.createElement('div'); hud.id = 'hud'; document.body.append(hud);
  const resident = app.engineScope.child('pine.quest'), previousLevel = app.levelScope; app.levelScope = resident;
  const manifest = emptyShardfileSource(emptyShardfile({ slug: 'fixture', name: 'Fixture', author: 'Fixture', seed: 1, revision: 1 }));
  const base = createLevelInstallation(app, resident, {}, () => ({ set: () => undefined, detail: () => undefined }));
  const hooks = new RetainedRuntimeHooks(shardContext(base.context, manifest, { shard: manifest, rows: new Map(),
    bag: { tab: () => () => undefined, fragment: () => () => undefined } }));
  const lifetime = new PineQuestLifetime(hooks.context), flags = new Flags('pine.entered.fixture', false), state = newBoard();
  flags.set('talked:ranger'); state.streak = 3;
  const objective = withOwner(resident, () => new ObjectiveLine()); objective.set('Lanterns', '1/3'); objective.root.style.top = '42px';
  const next = document.createElement('span'); hud.append(next);
  const reward = withOwner(resident, () => new RewardCaption('Dawn', 'Hollow', 'Reward'));
  lifetime.retainRoot(objective.root, () => { objective.root.classList.remove('ws-quest-hide'); });
  lifetime.retainRoot(reward.root, () => { reward.show(false); });
  const board = lifetime.view('board', (scope) => new BoardPanel(() => state, scope));
  const trade = lifetime.view('trade', (scope) => new ShopPanel({ trader: 'Mott', place: 'Hollow',
    goods: [{ id: 'a', name: 'Pelt', does: 'A pelt', icon: 'star', price: 0 }], state: () => 'short',
    cost: () => [{ text: '1 hide (0)', have: false }], layout: { kind: 'slate', kicker: 'Stall', title: 'Swaps' }, scope }));
  const count = lifetime.view('count', (scope) => new CountChip(scope));
  const dialogue = lifetime.view('dialogue', (scope) => new DialogueBox(scope));
  let pendingRewards = 0, completedTalk = 0, rerolls = 0;
  lifetime.enter(() => { board().onReroll = () => { rerolls++; }; });
  vi.useFakeTimers();
  try {
    for (let visit = 0; visit < 2; visit++) {
      if (visit > 0) hooks.activate();
      expect(flags.has('talked:ranger')).toBe(true); expect(state.streak).toBe(3);
      expect(objective.root.nextSibling).toBe(next); expect(objective.root.style.top).toBe('42px');
      const oldBoard = board(), oldTrade = trade(), oldDialogue = dialogue();
      oldBoard.open(); oldTrade.open(); count().show('Resin', 1, 3);
      oldDialogue.open('Hale', ['A pending line'], () => { completedTalk++; });
      reward.show(true); objective.root.classList.add('ws-quest-hide');
      lifetime.timeout(450, () => { pendingRewards++; });
      const tear = oldBoard.root.querySelector('.ws-ph-tear');
      expect(resident.census.timers).toBeGreaterThan(0);
      hooks.deactivate();
      expect(oldBoard.isOpen).toBe(false); expect(oldTrade.isOpen).toBe(false); expect(oldDialogue.isOpen).toBe(false);
      expect(oldBoard.root.isConnected).toBe(false); expect(oldTrade.root.isConnected).toBe(false);
      expect(objective.root.isConnected).toBe(false); expect(reward.root.isConnected).toBe(false);
      expect(resident.census.listeners).toBe(0); expect(resident.census.timers).toBe(0);
      tear?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', bubbles: true }));
      await vi.advanceTimersByTimeAsync(4000);
      expect(completedTalk).toBe(0); expect(pendingRewards).toBe(0); expect(rerolls).toBe(0);
      expect(() => dialogue()).toThrow('left its cell'); expect(() => lifetime.timeout(1, () => undefined)).toThrow('left its cell');
    }
  } finally { vi.useRealTimers(); resident.dispose(); app.levelScope = previousLevel; hud.remove(); }
  expect(resident.census.nodes).toBe(0); expect(resident.census.listeners).toBe(0); expect(resident.census.disposers).toBe(0);
});
