import { describe, expect, it, vi } from 'vitest';
import { Vector3, Group } from 'three';
import { CombatCues, resolveHitStop } from '../../src/engine/combat/cues';
import { sharedCombatCues } from '@wildshard/sdk/runtime/audio/combatCues';
import { driftwoodCombatCues } from '../../src/shards/driftwood-isle/runtime/audio/combatCues';
import { pineCombatCues } from '../../src/shards/pine-hollow/runtime/audio/combatCues';
import { ndCueMap } from '../../src/shards/nine-dragon-stack/runtime/audio/cues';
import { tap } from '../../src/engine/core/harnessTap';
import { PINE_BOLT_HIT_STOP, CROSSBOW, LEVER, LONGBOW } from '../../src/shards/pine-hollow/weapons/equipment';
import { Weapon, type WeaponState } from '../../src/engine/combat/Weapon';
import { EquipmentService } from '../../src/engine/combat/EquipmentService';
import { Events } from '../../src/engine/events/events';
import { Scope } from '../../src/engine/app/scope';
import type { CueOpts } from '../../src/engine/audio/Cues';

describe('combat cues preserve existing sound boundaries', () => {
  it('a resident cue map overrides fallback exactly once and leaves no route after disposal', () => {
    const fallback = vi.fn(() => true), resident = vi.fn(() => true);
    const cues = new CombatCues(fallback), scope = new Scope('resident-cues');
    cues.use(resident, scope);
    cues.fire(CROSSBOW);
    expect(resident).toHaveBeenCalledTimes(1); expect(fallback).not.toHaveBeenCalled();
    scope.dispose(); cues.fire(CROSSBOW);
    expect(resident).toHaveBeenCalledTimes(1); expect(fallback).toHaveBeenCalledTimes(1);
  });

  it('the shared fallback calls one existing tap-owning method and ocean melee stays silent here', () => {
    const audio = { rifleFire: vi.fn(), crossbowFire: vi.fn(), swordSwing: vi.fn(), swordHeavy: vi.fn(), swordHit: vi.fn(), boltImpact: vi.fn(), dryFire: vi.fn(), rifleReload: vi.fn(), reload: vi.fn(), weaponSwap: vi.fn() };
    const cues = new CombatCues(sharedCombatCues(audio, false));
    cues.fire(LEVER); expect(audio.rifleFire).toHaveBeenCalledExactlyOnceWith();
    cues.fire(CROSSBOW); expect(audio.crossbowFire).toHaveBeenCalledExactlyOnceWith();
    cues.cue('cue.jian.swing'); expect(audio.swordSwing).toHaveBeenCalledExactlyOnceWith();
    cues.cue('cue.jian.heavy'); expect(audio.swordHeavy).toHaveBeenCalledExactlyOnceWith();
    cues.impact(CROSSBOW, { surface: 'wood', pan: -0.4, gain: 0.7 }); expect(audio.boltImpact).toHaveBeenCalledExactlyOnceWith('wood', -0.4, 0.7);
    const island = new CombatCues(sharedCombatCues(audio, true)); island.cue('cue.sword.swing'); island.cue('cue.sword.heavy'); island.cue('cue.sword.hit');
    expect(audio.swordSwing).toHaveBeenCalledTimes(1); expect(audio.swordHeavy).toHaveBeenCalledTimes(1); expect(audio.swordHit).not.toHaveBeenCalled();
    expect(cues.cue('cue.unknown')).toBe(false);
  });
  it('Driftwood keeps whoosh direction, shell/wood/flesh impacts and the original kill bark', () => {
    const sfx = { whoosh: vi.fn(), impact: vi.fn(), vocal: vi.fn() }, cues = new CombatCues(driftwoodCombatCues(sfx));
    const point = new Vector3(1, 2, 3);
    cues.cue('cue.sword.swing', { speed: 1.2, heavy: true, dir: -1 }); expect(sfx.whoosh).toHaveBeenCalledExactlyOnceWith(1.2, { heavy: true, dir: -1 });
    cues.cue('cue.sword.hit', { point, kind: 'crab', strength: 0.8, killed: true }); expect(sfx.impact).toHaveBeenLastCalledWith('shell', 0.8, point); expect(sfx.vocal).toHaveBeenCalledExactlyOnceWith('crab', point, 1.3);
    cues.cue('cue.sword.hit', { point, kind: 'sailor', strength: 0.6 }); expect(sfx.impact).toHaveBeenLastCalledWith('wood', 0.6, point);
    cues.cue('cue.sword.clang', { point, clang: 'stone', strength: 0.5 }); expect(sfx.impact).toHaveBeenLastCalledWith('stone', 0.5, point);
  });
  it('Pine keeps its shot,0.42s echo, round-only reload, dry sound, draw and rock shot', () => {
    const shot = vi.fn(() => true), later = vi.fn<(run: () => void, seconds: number) => void>(() => undefined), stony = vi.fn(() => true);
    const cues = new CombatCues(pineCombatCues({ shot, later, stony, echoDelay: 0.42, echoGain: 0.55 }));
    cues.fire(LEVER); expect(shot).toHaveBeenCalledExactlyOnceWith('leverShot');
    const call = later.mock.calls[0]; if (call === undefined) throw new Error('echo was not scheduled');
    expect(call[1]).toBe(0.42);
    const runEcho = call[0]; runEcho();
    expect(shot).toHaveBeenLastCalledWith('leverEcho', { gain: 0.55 });
    const before = shot.mock.calls.length; expect(cues.reload(LEVER)).toBe(true); expect(shot.mock.calls).toHaveLength(before);
    cues.cue('cue.lever.round'); expect(shot).toHaveBeenLastCalledWith('leverRoundIn', { gain: 0.9 });
    cues.cue('cue.lever.dry'); expect(shot).toHaveBeenLastCalledWith('leverDry');
    cues.charge(LONGBOW, 'draw'); expect(shot).toHaveBeenLastCalledWith('longbowDraw', { gain: 0.8 });
    const point = new Vector3(1, 2, 3); cues.impact(CROSSBOW, { surface: 'ground', point }); expect(shot).toHaveBeenLastCalledWith('boltImpact-rock', { at: point });
    expect(cues.impact(CROSSBOW, { surface: 'flesh', point })).toBe(false);
    expect([resolveHitStop(PINE_BOLT_HIT_STOP, false, false), resolveHitStop(PINE_BOLT_HIT_STOP, true, false), resolveHitStop(PINE_BOLT_HIT_STOP, true, true)]).toEqual([0.035, 0.055, 0.075]);
  });
  it('Nine Dragon aliases reuse the S1.5 map and each original literal tap exactly once', () => {
    const play = vi.fn<(family: string, opts?: CueOpts) => boolean>(() => true), previous = tap.sound, sounds: string[] = [];
    tap.sound = (id) => { sounds.push(id); };
    try {
      const map = ndCueMap({ play }, () => 0.5);
      map('cue.jian.swing', {}); map('cue.jian.heavy', {}); map('cue.jian.hit', { surface: 'wood' }); map('cue.grapple.fire', {});
      expect(sounds).toEqual(['nd.jian.swing', 'nd.jian.heavy', 'nd.jian.hit.wood', 'nd.feizhua.fire']);
      expect(play.mock.calls.map((call) => call[0])).toEqual(['jian.swing', 'jian.swing.heavy', 'jian.hit.wood', 'feizhua.fire']);
      expect(map('cue.jian.hit', { surface: 'flesh' })).toBe(false); expect(map('cue.grapple.miss', {})).toBe(false);
    } finally { tap.sound = previous; }
  });
});

class EventWeapon extends Weapon {
  readonly model = new Group(); readonly state: WeaponState = { ammo: 4, magazine: 4, reserve: 0, ads: false, loaded: true, reloading: false, reloadProgress: 0 };
  adsHeld = false; enabled = true; holster = 0; aimInfo = null;
  tryFire(): void { this.onFire?.(); }
  update(): void { /* No view clock in the event fixture. */ }
}
describe('weapon events publish the source row and retain contact frames', () => {
  it('fires one queued event per old hook, with no extra sound callback', () => {
    const events = new Events(), scope = new Scope('weapon-events'), weapon = new EventWeapon(CROSSBOW);
    const service = new EquipmentService(weapon, { events, scope, input: { bind: () => undefined } });
    const log: string[] = [], points: number[] = [];
    events.on('weapon.fired', ({ id }) => { log.push(id); }, scope);
    events.on('weapon.hit', ({ id }) => { log.push(`hit:${id}`); }, scope);
    events.on('weapon.impact', ({ point }) => { points.push(point.x); }, scope);
    events.on('weapon.charge', ({ phase }) => { log.push(phase); }, scope);
    service.onFire = vi.fn<() => void>(() => undefined); weapon.tryFire(); weapon.onHit?.('boar', true, false);
    const point = new Vector3(2, 0, 0); weapon.onImpact?.('wood', point); point.x = 99; weapon.chargeEvent('draw', 1);
    expect(log).toEqual([]); expect(service.onFire).toHaveBeenCalledTimes(1);
    events.flush('update'); expect(log).toEqual(['weapon.crossbow', 'hit:weapon.crossbow', 'draw']); expect(points).toEqual([2]);
    scope.dispose(); expect(events.census()).toEqual({ listeners: 0, answerers: 0 });
  });
});
