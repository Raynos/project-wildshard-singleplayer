// @vitest-environment happy-dom
import { expect, it } from 'vitest';
import { app } from '../../src/engine/app/runtime';
import { Scope } from '../../src/engine/app/scope';
import { INPUT_CONTEXTS } from '../../src/game/inputContexts';
import { TouchControls } from '../../src/engine/player/TouchControls';
import { declaredTemplateItems } from '../fake/declaredTemplateItems';
import { fakeWorld } from '../fake/world';

it('paints an already active attack relabel, respects an overlay and restores labels/icons on pop', () => {
  const scope = new Scope('G5-touch'), previous = app.levelScope;
  app.levelScope = scope;
  const f = fakeWorld();
  for (const key of ['preUpdate', 'onHoverChange', 'onSwimChange']) Reflect.set(f.player, key, undefined);
  for (const key of ['hover', 'swimming', 'submerged']) Reflect.set(f.player, key, false);
  for (const context of INPUT_CONTEXTS) app.input.register(context, scope);
  const weapons = declaredTemplateItems(app).service;
  try {
    app.input.register({ id: 'g5.fan', actions: ['attack', 'heavy', 'lock'], touch: { mode: 'melee', relabel: { r0: { label: 'SWING' }, lock: { label: 'PARRY' } } } }, scope);
    const overlay = new Scope('G5-overlay');
    app.input.register({ id: 'g5.overlay', actions: ['attack'], touch: { relabel: { r0: { label: 'CRACK', icon: '<path d="M0 0L1 1"/>', tone: 'ready' } } } }, overlay);
    app.input.push('onFoot', scope); app.input.push('weapon.melee', scope); app.input.push('g5.fan', scope);
    new TouchControls(f.player, weapons, true);
    const attack = document.querySelector('.ws-touch-attack');
    if (!(attack instanceof HTMLElement)) throw new Error('attack disc missing');
    const label = attack.querySelector('span.melee'), ranged = attack.querySelector('span.ranged'), svg = attack.querySelector('svg.melee');
    if (!(label instanceof HTMLElement) || !(ranged instanceof HTMLElement) || svg === null) throw new Error('attack markup missing');
    const ownIcon = svg.innerHTML;
    expect(label.textContent).toBe('SWING'); expect(ranged.textContent).toBe('SWING');
    expect(attack.classList.contains('hint-rest')).toBe(true);
    expect(document.querySelector('.ws-touch-disc.lock')?.classList.contains('hint-rest')).toBe(true);
    app.input.push('g5.overlay', overlay); expect(label.textContent).toBe('CRACK'); expect(svg.innerHTML).not.toBe(ownIcon);
    expect(attack.classList.contains('hint-ready')).toBe(true); expect(attack.classList.contains('hint-rest')).toBe(false);
    overlay.dispose(); expect(label.textContent).toBe('SWING'); expect(svg.innerHTML).toBe(ownIcon);
    app.input.pop('g5.fan'); expect(label.textContent).toBe('Attack'); expect(ranged.textContent).toBe('Fire'); expect(attack.classList.contains('hint')).toBe(false);
    app.input.register({ id: 'g22.baseline', actions: ['attack'], touch: { relabel: { r0: { label: 'Attack' } } } }, scope);
    app.input.push('g22.baseline', scope); expect(attack.classList.contains('hint')).toBe(false);
    app.input.pop('g22.baseline');
    app.input.pop('weapon.melee'); app.input.push('weapon.ranged', scope);
    expect(label.textContent).toBe('Attack'); expect(ranged.textContent).toBe('Fire');
    const hostile = '<img src=x onerror="bad()"><script>bad()</script>& literal';
    app.input.register({ id: 'literal.verb', actions: ['use'], touch: { relabel: { jump: { label: hostile } },
      verbs: { 'verb.1': { action: 'use', label: hostile, icon: '<svg viewBox="0 0 24 24"><path d="M0 0L1 1"/></svg>' } } } }, scope);
    app.input.push('literal.verb', scope);
    expect(document.querySelector('.ws-touch-disc.jump span')?.textContent).toBe(hostile);
    expect(document.querySelector('.ws-touch-verb.verb-one span')?.textContent).toBe(hostile);
    expect(document.querySelector('.ws-touch img, .ws-touch script, .ws-touch [onerror]')).toBeNull();
  } finally { scope.dispose(); app.levelScope = previous; app.input.clear(); document.body.replaceChildren(); }
});
