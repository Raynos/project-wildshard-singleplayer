// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { App } from '../../src/engine/app/app';
import { Scope } from '../../src/engine/app/scope';
import { EffectService } from '../../src/engine/combat/effects/EffectService';
import { PlayerHealth } from '../../src/engine/combat/health';
import type { DebugRowSpec } from '../../src/engine/level/context';
import { STARTER_EFFECTS } from '../../src/kit/effects/starter';
import { installStarterEffects } from '../../src/kit/effects/install';
import { DialogueBox } from '../../src/engine/quest/view/ui';
import { Flags } from '../../src/engine/world/interact/flags';
import { NpcTalk } from '../../src/engine/quest/view';
import { BoardPanel, CountChip } from '../../src/shards/pine-hollow/quest/ui';
import { ShopPanel } from '../../src/game/loot/ui/ShopPanel';
import { newBoard } from '../../src/shards/pine-hollow/quest/contracts';

afterEach(() => document.body.replaceChildren());
describe('scoped status and quest UI', () => {
  it('registers one Debug row, applies at five seconds, mounts only active icons and releases everything', () => {
    const app = new App(), scope = new Scope('status'), player = { position: new Vector3(), effectMoveLocked: false, effectMoveScale: 1 };
    const health = new PlayerHealth(app.events, { now: () => 0, dodging: () => false, dodgeGuard: () => false, position: () => player.position });
    const effects = new EffectService(STARTER_EFFECTS, scope, app.events);
    let row: DebugRowSpec | undefined;
    app.registerEffects(effects, scope);
    installStarterEffects({ app, scope,
      debugRow: (value) => { row = value; }, system: (spec) => { app.addSystem(spec, scope); },
      on: (name, fn, opts) => { app.events.on(name, fn, scope, opts); },
      hud: { widget: (_band, el) => { document.body.append(el); scope.onDispose(() => { el.remove(); }); } },
    }, { player, health, effects });
    const step = (dt: number): void => { for (const system of app.systemsByPhase().update) system.run(dt, 0); };
    expect(row).toMatchObject({ id: 'effects.apply', group: 'combat', label: 'Apply effect', initial: 'off' });
    expect(row?.choices.map((choice) => choice.value)).toEqual(['off', 'stun', 'burn', 'poison', 'bleed', 'slow']);
    step(5); expect(effects.active(health)).toHaveLength(0); expect(document.querySelector('.ws-status-effects')).toBeNull();
    row?.change('stun'); step(4.9); expect(player.effectMoveLocked).toBe(false);
    step(0.1); expect(player.effectMoveLocked).toBe(true);
    expect(document.querySelector('[data-effect="effect.stun"] svg path')?.getAttribute('d')).toBeTruthy();
    expect(document.body.textContent).toContain('STUN 2s');
    row?.change('off'); step(1.3); expect(player.effectMoveLocked).toBe(false);
    expect(document.querySelector('.ws-status-effects')?.textContent).toBe('');
    scope.dispose(); expect(document.body.children).toHaveLength(0); expect(app.systemsByPhase().update).toHaveLength(0);
    app.engineScope.dispose();
  });
  it('dismissing dialogue never raises its sets; completing or empty dialogue runs the content callback', () => {
    const scope = new Scope('talk'), dialogue = new DialogueBox(scope), flags = new Flags('npc', false);
    const speaker = { talking: false }, at = new Vector3(); let completed = 0;
    const talk = new NpcTalk({ dialogue, flags, at, radius: 3.2, label: 'Talk', speaker,
      npc: { id: 'person', name: 'Person', dialogue: [{ when: { none: ['talked'] }, lines: ['A line'], sets: ['talked'] }] },
      onDone: () => { completed++; }, onEmpty: () => { completed++; } });
    talk.talk(); expect(speaker.talking).toBe(true); talk.update(new Vector3(0, 0, 6));
    expect(flags.has('talked')).toBe(false); expect(speaker.talking).toBe(false);
    talk.talk(); dialogue.advance(); dialogue.advance(); expect(flags.has('talked')).toBe(true); expect(completed).toBe(1);
    talk.talk(); expect(completed).toBe(2); scope.dispose(); expect(document.body.children).toHaveLength(0);
  });
  it('Pine board/trade listeners release with their owner, so a disposed panel cannot reopen', () => {
    const scope = new Scope('panels'), board = new BoardPanel(newBoard, scope);
    const trade = new ShopPanel({ trader: 'Mott', place: 'Hollow', goods: [{ id: 'a', name: 'A', does: 'a', icon: 'star', price: 0 }], state: () => 'short', cost: () => [{ text: '1 hide (0)', have: false }], layout: { kind: 'slate', kicker: 'Stall', title: 'Swaps' }, scope });
    const count = new CountChip(scope);
    let rerolls = 0;
    board.onReroll = () => { rerolls++; };
    board.open(); trade.open(); count.show('Resin', 1, 3);
    const old = board.root.querySelector('button.ws-ph-tear');
    const census = scope.census;
    for (let i = 0; i < 50; i++) { board.render(); trade.render(); count.show('Resin', 1, 3); }
    expect(scope.census).toEqual(census);
    old?.dispatchEvent(new MouseEvent('click')); expect(rerolls).toBe(0);
    scope.dispose(); board.open(); trade.open(); count.show('Resin', 2, 3);
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', bubbles: true }));
    expect(board.isOpen).toBe(false); expect(trade.isOpen).toBe(false); expect(document.body.children).toHaveLength(0);
  });
});
