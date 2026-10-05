// @vitest-environment happy-dom
import { expect, it } from 'vitest';
import { Vector3 } from 'three';
import { app } from '../../../src/engine/app/runtime';
import { withOwner } from '../../../src/engine/app/ownership';
import { createLevelInstallation } from '../../../src/engine/level/installation';
import { BossBar } from '../../../src/engine/ui/BossBar';
import { EliteBar } from '../../../src/engine/ui/EliteBar';
import { shardContext } from '../../../src/game/shard/context';
import { installEnteredRuntimeAttachment, RetainedRuntimeHooks } from '../../../src/game/shard/retainedHooks';
import { emptyShardfileSource } from '../../../src/game/shardfile/loader';
import { emptyShardfile } from '../../../src/sdk/author';
import { installPineCombatAttachments } from '../../../src/shards/pine-hollow/runtime/combatService';

it('parks real combat widgets across two entries without losing captions, health or their exact element order', () => {
  const scope = app.engineScope.child('combat-hud');
  const manifest = emptyShardfileSource(emptyShardfile({ slug: 'home', name: 'Home', author: 'Fixture', seed: 1, revision: 1 }));
  const base = createLevelInstallation(app, scope, {}, () => ({ set: () => undefined, detail: () => undefined }));
  const hooks = new RetainedRuntimeHooks(shardContext(base.context, manifest, { shard: manifest, rows: new Map(),
    bag: { tab: () => () => undefined, fragment: () => () => undefined } }));
  const hud = document.createElement('div'), mini = document.createElement('div'), sentinel = document.createElement('span');
  mini.className = 'ws-minimap'; hud.append(mini); document.body.append(hud);
  const elite = withOwner(scope, () => new EliteBar(hud)), boss = withOwner(scope, () => new BossBar(hud));
  hud.append(sentinel);
  elite.show('Blackpaw', 'The Watcher'); elite.caption('ENRAGED'); elite.banner('Blackpaw', 'The Watcher');
  boss.showBar('THE ANTLER KING', [0.6, 0.3]); boss.setHp(0.55); boss.setPhase(2, 'LAST STAND');
  const eliteHtml = elite.root.innerHTML, bossHtml = boss.root.innerHTML, order = [...hud.children];
  try {
    installPineCombatAttachments(hooks.context, elite, boss);
    for (let entry = 0; entry < 2; entry++) {
      if (entry > 0) hooks.activate();
      elite.skulls([{ x: 1, z: 1, shown: true, dead: false, engaged: true, countdown: 0 }], new Vector3());
      const marks = mini.querySelector('.ws-elite-skulls');
      if (!(marks instanceof HTMLElement)) throw new Error('Missing minimap skull layer');
      expect(marks.hidden).toBe(false); expect([...hud.children]).toEqual(order);
      expect(elite.root.innerHTML).toBe(eliteHtml); expect(boss.root.innerHTML).toBe(bossHtml);
      hooks.deactivate();
      expect(elite.root.isConnected).toBe(false); expect(boss.root.isConnected).toBe(false); expect(marks.hidden).toBe(true);
      expect([...hud.children]).toEqual([mini, sentinel]);
      for (let frame = 0; frame < 600; frame++) app.clock.tick(1 / 60);
      expect(elite.root.innerHTML).toBe(eliteHtml); expect(boss.root.innerHTML).toBe(bossHtml);
      expect(hud.querySelectorAll('.show')).toHaveLength(0);
    }
    expect([...hud.childNodes].filter((node) => node.nodeType === Node.COMMENT_NODE)).toHaveLength(2);
  } finally { scope.dispose(); }
  expect([...hud.childNodes]).toEqual([mini, sentinel]); expect(mini.childNodes).toHaveLength(0);
  expect(scope.census).toMatchObject({ nodes: 0, listeners: 0, timers: 0, systems: 0, disposers: 0 });
  hud.remove();
});

it('refuses an ordinary context and keeps lazy minimap marks inactive until explicitly resumed', () => {
  const scope = app.engineScope.child('combat-hud-lazy');
  const manifest = emptyShardfileSource(emptyShardfile({ slug: 'home', name: 'Home', author: 'Fixture', seed: 1, revision: 1 }));
  const base = createLevelInstallation(app, scope, {}, () => ({ set: () => undefined, detail: () => undefined }));
  const context = shardContext(base.context, manifest, { shard: manifest, rows: new Map(),
    bag: { tab: () => () => undefined, fragment: () => () => undefined } });
  const mini = document.createElement('div'); mini.className = 'ws-minimap'; document.body.append(mini);
  const elite = withOwner(scope, () => new EliteBar(mini));
  try {
    expect(() => installEnteredRuntimeAttachment(context, elite.root)).toThrow('retained context');
    expect(elite.root.isConnected).toBe(true); expect(mini.querySelector('.ws-elite-skulls')).toBeNull();
    elite.setActive(false); elite.skulls([], new Vector3());
    const marks = mini.querySelector('.ws-elite-skulls');
    if (!(marks instanceof HTMLElement)) throw new Error('Missing minimap skull layer');
    expect(marks.hidden).toBe(true); elite.setActive(true); expect(marks.hidden).toBe(false);
  } finally { scope.dispose(); mini.remove(); }
  expect(scope.census.nodes).toBe(0);
});
