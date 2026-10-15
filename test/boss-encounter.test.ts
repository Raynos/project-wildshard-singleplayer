// @vitest-environment happy-dom
import { expect, test, vi } from 'vitest';
import { Group, PerspectiveCamera, Scene, Vector3 } from 'three';
import { app } from '../src/engine/app/runtime';
import { Scope } from '../src/engine/app/scope';
import type { BossScript } from '../src/engine/ai/BossBrain';
import { installBossEncounter, type BossEncounterPorts, type BossEncounterRows, type BossPersistence } from '../src/game/Boss';
import { ANTLER_KING_PRESENTATION } from '../src/shards/pine-hollow/data/antlerKing';
import { mockCanvas } from './fake/weaponParity';
import { TITAN_ENCOUNTER, TITAN_REWARD } from '../src/shards/nalati-grasslands/data/stormTitanFight';

function fixture(rows: BossEncounterRows, owned = false) {
  const events: string[] = [], scope = new Scope('boss-encounter'), scene = new Scene(), camera = new PerspectiveCamera();
  const player = { position: new Vector3(), yaw: 0, pitch: 0 };
  let hp = 1, dead = false, phase = 0, grants = 0, trophies = 0, scoreReads = 0, ambient = 'night';
  const record = { defeated: owned, rewardTaken: owned, kills: owned ? 1 : 0 };
  const saved: ReturnType<BossPersistence['read']> = { [rows.definition.id]: record };
  const script = {
    get hpFrac() { return hp; }, get shielded() { return false; }, get dead() { return dead; }, get phase() { return phase; },
    inArena: () => true,
    reset: (value: number) => { phase = value; hp = rows.definition.phases[value]?.at ?? 1; dead = false; events.push(`reset:${value}`); },
    seal: (on: boolean) => { events.push(`seal:${on}`); },
    intro: () => new Vector3(0, 1, -5), begin: (value: number) => { phase = value; events.push(`begin:${value}`); },
    enterPhase: (value: number) => { phase = value; events.push(`phase:${value}`); },
    update: (_dt: number, _t: number, fighting: boolean) => { events.push(`room:${fighting}`); },
    clampHp: (value: number) => { hp = value; }, setInvulnerable: (on: boolean) => { events.push(`shield:${on}`); },
    victory: () => { events.push('victory'); }, rewardPoint: () => new Vector3(0, 0, 0), respawnPoint: () => ({ pos: new Vector3(4, 0, 0), yaw: 1 }),
  } satisfies BossScript & { readonly phase: number };
  const ports: BossEncounterPorts<typeof script> = {
    game: { scene, camera }, player, scope, chunkId: 'boss-test', interactables: [],
    persistence: { read: () => saved, write: value => { Object.assign(saved, value); events.push('persist'); } },
    reward: { model: () => { events.push('model'); return new Group(); }, grant: () => { grants++; }, trophy: () => { trophies++; } },
    lockInput: on => { events.push(`lock:${on}`); }, respawn: (pos, yaw) => { player.position.copy(pos); player.yaw = yaw; events.push('respawn'); },
    skipHeld: () => false,
    score: () => { scoreReads++; return {
      setScene: value => { events.push(`scene:${value}`); }, setBossPhase: value => { events.push(`score-phase:${value}`); },
      combat: value => { events.push(`combat:${value}`); }, playSting: value => { events.push(`sting:${value}`); },
    }; },
    ambientScene: () => ambient, scorePhase: fight => fight.phase,
  };
  return { events, scope, scene, script, ports, saved, get grants() { return grants; }, get trophies() { return trophies; }, get scoreReads() { return scoreReads; },
    damage: (value: number) => { hp = value; }, die: () => { dead = true; }, daytime: () => { ambient = 'day'; } };
}

test('Pine keeps bar/prewarm/register order, borrowed room stepping, phase checkpoints and one-time reward ownership', () => {
  mockCanvas();
  const f = fixture(ANTLER_KING_PRESENTATION), registration = vi.spyOn(app.encounters, 'boss');
  const live = installBossEncounter(ANTLER_KING_PRESENTATION, () => {
    expect(document.querySelector('.ws-boss')).not.toBeNull(); f.events.push('prewarm'); return f.script;
  }, { ...f.ports, advance: (boss, fight, dt, t) => {
    f.events.push('presence'); boss.update(dt, t); if (boss.state === 'dormant') fight.update(dt, t, false);
  } });
  try {
    expect(live.fight).toBe(f.script); expect(registration).toHaveBeenCalledWith('antler-king', live.boss, f.scope);
    expect(f.events).toEqual(['prewarm']); expect(f.scoreReads).toBe(0); expect(f.ports.interactables).toHaveLength(0);
    live.update(0.1, 1); expect(f.events.slice(-2)).toEqual(['presence', 'room:false']);
    live.boss.arm(); live.update(0.1, 2);
    expect(live.boss.state).toBe('intro'); expect(f.events.filter(value => /scene:|score-phase:|combat:/.test(value))).toEqual(['scene:boss', 'score-phase:1', 'combat:1']);
    live.update(5, 7); expect(live.boss.state).toBe('fight');
    f.damage(0.5); live.update(0.1, 8); expect(live.boss.state).toBe('beat');
    expect(f.events.filter(value => value.startsWith('score-phase:'))).toEqual(['score-phase:1', 'score-phase:2']);
    const checkpoint = live.boss.snapshot(); expect(checkpoint.checkpoint).toBe(1);
    expect(live.onPlayerDeath()).toBe(true); expect(live.boss.state).toBe('armed'); expect(f.ports.player.position.x).toBe(4);
    expect(f.events.indexOf('sting:death')).toBeLessThan(f.events.indexOf('respawn'));
    const before = f.events.length; live.boss.restore(checkpoint); expect(f.events).toHaveLength(before); // silent old continuation
    live.update(2, 10); f.die(); f.daytime(); live.update(0.1, 11);
    expect(live.boss.state).toBe('victory'); expect(f.trophies).toBe(1); expect(f.grants).toBe(0);
    expect(f.events.filter(value => /scene:day|sting:chunk/.test(value))).toEqual(['scene:day', 'sting:chunk']);
    const drop = live.boss.reward; if (drop === null) throw new Error('Missing original reward pickup');
    expect(f.ports.interactables).toEqual([drop.interactable]);
    drop.interactable.onInteract(); drop.interactable.onInteract();
    expect(f.grants).toBe(1); expect(f.ports.interactables).toEqual([]); expect(f.saved['antler-king']?.rewardTaken).toBe(true);
    expect(f.events.filter(value => value === 'sting:pickup')).toHaveLength(1);
  } finally { live.ui.scope.dispose(); f.scope.dispose(); }
});

test('a paid boss record stays paid and an ordinary W3 storm boss borrows its existing event and dormant owner', () => {
  const rows: BossEncounterRows = { definition: TITAN_ENCOUNTER, reward: TITAN_REWARD,
    score: { intro: [{ kind: 'combat', value: 1 }], phase: [{ kind: 'combat', value: 1 }], victory: [{ kind: 'sting', value: 'chunk' }], death: [{ kind: 'sting', value: 'death' }], pickup: [{ kind: 'sting', value: 'pickup' }] } };
  const f = fixture(rows, true), live = installBossEncounter(rows, () => f.script, f.ports);
  try {
    expect(live.boss.rewardTaken).toBe(true); expect(f.grants).toBe(0); expect(f.scoreReads).toBe(0);
    live.boss.arm(); live.update(0.1, 1); live.update(5, 6); f.die(); live.update(0.1, 7);
    expect(live.boss.state).toBe('victory'); expect(live.boss.reward).toBeNull(); expect(f.ports.interactables).toHaveLength(0);
    expect(f.trophies).toBe(1); expect(f.grants).toBe(0);
    expect(f.events.filter(value => /combat:|sting:/.test(value))).toEqual(['combat:1', 'sting:chunk']);
  } finally { live.ui.scope.dispose(); f.scope.dispose(); }
});

test('missing score owners and unbounded actions refuse before prewarm or opening a panel', () => {
  const f = fixture(ANTLER_KING_PRESENTATION), make = vi.fn(() => f.script), count = document.querySelectorAll('.ws-boss').length;
  const { score: _score, ...withoutScore } = f.ports;
  try {
    expect(() => installBossEncounter(ANTLER_KING_PRESENTATION, make, withoutScore)).toThrow('one score owner');
    expect(() => installBossEncounter(ANTLER_KING_PRESENTATION, make, { ...f.ports, music: () => { f.events.push('other music'); } })).toThrow('one score owner');
    const rows = { ...ANTLER_KING_PRESENTATION, score: { ...ANTLER_KING_PRESENTATION.score, intro: Array.from({ length: 17 }, () => ({ kind: 'combat' as const, value: 1 })) } };
    expect(() => installBossEncounter(rows, make, f.ports)).toThrow('Too many');
    expect(make).not.toHaveBeenCalled(); expect(document.querySelectorAll('.ws-boss')).toHaveLength(count); expect(f.scoreReads).toBe(0);
  } finally { f.scope.dispose(); }
});
