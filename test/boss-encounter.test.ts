// @vitest-environment happy-dom
import { expect, test, vi } from 'vitest';
import { Group, PerspectiveCamera, Scene, Vector3 } from 'three';
import { app } from '../src/engine/client/app/runtime';
import { Scope } from '../src/engine/shared/app/scope';
import type { BossScript } from '../src/engine/shared/ai/BossBrain';
import { installBossEncounter, type BossEncounterPorts, type BossEncounterRows, type BossPersistence } from '../src/game/client/Boss';
import bossRows from '../src/shards/pine-hollow/data/bossEncounter.json' with { type: 'json' };
import bossPresentation from '../src/shards/pine-hollow/data/bossPresentation.json' with { type: 'json' };
import { bossEncounterPresentation } from '@wildshard/format/bossEncounter';
import { mockCanvas } from '@wildshard/engine/test/weaponParity';
import type { EncounterRow } from '../src/game/client/boss/barFeed';
import { wirePage } from '../src/game/client/shardfile/wirePage';
import * as titan from '../src/shards/nalati-grasslands/generators/stormTitanFight';
import king from './fixtures/nalati-goldenKing-original.json' with { type: 'json' };

const ANTLER_KING_PRESENTATION = bossEncounterPresentation(bossPresentation, bossRows);

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
    expect(live.boss.takeReward()).toBe(false); expect(live.boss.rewardTaken).toBe(false); // not beaten yet: nothing to take
    live.update(2, 10); f.die(); f.daytime(); live.update(0.1, 11);
    expect(live.boss.state).toBe('victory'); expect(f.trophies).toBe(1); expect(f.grants).toBe(0);
    expect(f.events.filter(value => /scene:day|sting:chunk/.test(value))).toEqual(['scene:day', 'sting:chunk']);
    const drop = live.boss.reward; if (drop === null) throw new Error('Missing original reward pickup');
    expect(f.ports.interactables).toEqual([drop.interactable]);
    drop.interactable.onInteract(); drop.interactable.onInteract();
    expect(f.grants).toBe(1); expect(f.ports.interactables).toEqual([]); expect(f.saved['antler-king']?.rewardTaken).toBe(true);
    expect(f.events.filter(value => value === 'sting:pickup')).toHaveLength(1);
    expect(live.boss.takeReward()).toBe(false); // the record transition is once, whoever reaches the prompt
  } finally { live.ui.scope.dispose(); f.scope.dispose(); }
});

test.each([{ definition: titan.TITAN_ENCOUNTER, reward: titan.TITAN_REWARD }, { definition: king.encounter, reward: king.reward }])('a paid $definition.id record stays paid with its original event owner', ({ definition, reward }) => {
  const rows: BossEncounterRows = { definition, reward,
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

// N2: on the wire the brain never steps. The fight's row drives the same score the brain did, and a phase lookup reads the row: the page's script stays in its first phase.
test('on the wire a fight\'s row plays its score, feed and attempts in the brain\'s order', () => {
  mockCanvas();
  const on = Object.getOwnPropertyDescriptor(wirePage, 'on'), encounters = vi.spyOn(wirePage, 'encounters');
  Object.defineProperty(wirePage, 'on', { get: () => true, configurable: true });
  app.events.flush('update'); // what earlier fights left queued
  const f = fixture(ANTLER_KING_PRESENTATION), lines: string[] = [], attempts: string[] = [], listening = new Scope('boss-attempts'); app.events.on('boss.attempt', ({ outcome }) => { attempts.push(outcome); }, listening);
  const live = installBossEncounter(ANTLER_KING_PRESENTATION, () => f.script, { ...f.ports, row: 'antler.fight', toast: text => { lines.push(`toast ${text}`); }, feed: text => { lines.push(`feed ${text}`); } });
  const row = (state: string, phase = 0, reward: EncounterRow['reward'] = null): EncounterRow => ({ id: 'antler.fight', kind: 'boss', state, hp: .5, phase, shield: false, body: 1, skip: 0, banners: 0, signatures: 0, known: false, sleep: 0, reward });
  const frame = (state: string, phase = 0, reward: EncounterRow['reward'] = null): void => { encounters.mockReturnValue([row(state, phase, reward)]); live.update(.1, 1); };
  const score = (): string[] => f.events.filter(value => /scene:|score-phase:|combat:|sting:/.test(value));
  const next = ANTLER_KING_PRESENTATION.definition.phases[1];
  try {
    frame('armed'); frame('intro'); expect(score()).toEqual(['scene:boss', 'score-phase:1', 'combat:1']);
    expect(f.events.filter(value => value.startsWith('lock:')), 'an intro holds the page').toEqual(['lock:true']);
    frame('fight'); frame('beat', 1); frame('fight', 1);
    expect(f.events.filter(value => value.startsWith('lock:'))).toEqual(['lock:true', 'lock:false']);
    expect(score().slice(3)).toEqual(['score-phase:2']);
    expect(lines).toEqual([`feed ${ANTLER_KING_PRESENTATION.definition.name} · ${next?.name}`]);
    frame('armed', 1); expect(score().slice(4)).toEqual(['scene:night', 'sting:death']);
    frame('intro', 1); expect(score().slice(6), 'a retry opens on its checkpoint').toEqual(['scene:boss', 'score-phase:1', 'combat:1']);
    frame('fight', 1); f.daytime(); frame('victory', 1, { x: 1, y: 2, z: 3 });
    expect(score().slice(9)).toEqual(['scene:day', 'sting:chunk']);
    expect(lines, 'a reward lies on the ground: nothing to say').toHaveLength(1);
    app.events.flush('update'); expect(attempts).toEqual(['started', 'died', 'started', 'won']);
    expect(f.trophies, 'the server pays').toBe(0);
  } finally { listening.dispose(); live.ui.scope.dispose(); f.scope.dispose(); encounters.mockRestore(); if (on === undefined) Reflect.deleteProperty(wirePage, 'on'); else Object.defineProperty(wirePage, 'on', on); }
});

test('on the wire a row that only came into view has no moment, and a paid fight says so once', () => {
  mockCanvas();
  const on = Object.getOwnPropertyDescriptor(wirePage, 'on'), encounters = vi.spyOn(wirePage, 'encounters');
  Object.defineProperty(wirePage, 'on', { get: () => true, configurable: true });
  app.events.flush('update'); // what earlier fights left queued
  const f = fixture(ANTLER_KING_PRESENTATION), lines: string[] = [], attempts: string[] = [], listening = new Scope('boss-attempts'); app.events.on('boss.attempt', ({ outcome }) => { attempts.push(outcome); }, listening);
  const live = installBossEncounter(ANTLER_KING_PRESENTATION, () => f.script, { ...f.ports, row: 'antler.fight', toast: text => { lines.push(text); } });
  const row = (state: string): EncounterRow => ({ id: 'antler.fight', kind: 'boss', state, hp: 0, phase: 2, shield: false, body: 1, skip: 0, banners: 0, signatures: 0, known: false, sleep: 0, reward: null });
  const frame = (state: string | null): void => { encounters.mockReturnValue(state === null ? [] : [row(state)]); live.update(.1, 1); };
  try {
    frame(null); frame('victory'); frame(null); frame('victory');
    app.events.flush('update'); expect(f.events.filter(value => /scene:|sting:/.test(value))).toEqual([]); expect(attempts).toEqual([]); expect(lines).toEqual([]);
    frame('fight'); frame('victory');
    app.events.flush('update'); expect(f.events.filter(value => value.includes('sting:'))).toEqual(['sting:chunk']); expect(attempts).toEqual(['won']);
    expect(lines).toEqual([`${ANTLER_KING_PRESENTATION.definition.name} falls again — the gold is already yours`]);
    frame('fight'); frame(null); app.events.flush('update'); expect(attempts).toEqual(['won', 'left']);
  } finally { listening.dispose(); live.ui.scope.dispose(); f.scope.dispose(); encounters.mockRestore(); if (on === undefined) Reflect.deleteProperty(wirePage, 'on'); else Object.defineProperty(wirePage, 'on', on); }
});
