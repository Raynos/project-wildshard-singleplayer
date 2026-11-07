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
  const ports: BossEncounterPorts = {
    game: { scene, camera }, player, scope, chunkId: 'boss-test', interactables: [],
    persistence: { read: () => saved, write: value => { Object.assign(saved, value); events.push('persist'); } },
    reward: { model: () => { events.push('model'); return new Group(); }, grant: () => { grants++; }, trophy: () => { trophies++; } },
    lockInput: on => { events.push(`lock:${on}`); }, respawn: (pos, yaw) => { player.position.copy(pos); player.yaw = yaw; events.push('respawn'); },
    skipHeld: () => false,
    score: () => { scoreReads++; return {
      setScene: value => { events.push(`scene:${value}`); }, setBossPhase: value => { events.push(`score-phase:${value}`); },
      combat: value => { events.push(`combat:${value}`); }, playSting: value => { events.push(`sting:${value}`); },
    }; },
    ambientScene: () => ambient,
  };
  return { events, scope, scene, script, ports, saved, get grants() { return grants; }, get trophies() { return trophies; }, get scoreReads() { return scoreReads; },
    damage: (value: number) => { hp = value; }, die: () => { dead = true; }, daytime: () => { ambient = 'day'; } };
}

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
