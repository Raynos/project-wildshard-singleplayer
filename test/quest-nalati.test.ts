// NALATI-MERGE Q1–Q3: the shared quest core (places with saved discovery, the chained line) and Nalati's chapter 1
// (TULPAR) as data — validated, walked, caught up from a save that already tamed / won, and the elder's dialogue order.
import { describe, expect, it } from 'vitest';
import { Flags } from '../src/world/interact/flags';
import { lineFor, validateQuest } from '../src/game/quest/quest';
import { QuestLine, placesWithDiscovery } from '../src/game/quest/core';
import { CAMP_NPCS, ELDER, NALATI_PLACES, NALATI_QUESTS, NALATI_QUEST_EXTERNAL, TULPAR_DONE, TULPAR_QUEST } from '../src/game/quest/nalati';
import { NALATI_MAP } from '../src/chunks/nalatiLayout';

const fresh = (): Flags => new Flags('chunk://test/nalati-quest', false);
/** play a talk to the end: the entry's `sets` go up (NpcTalk does this when the dialogue closes) */
const talk = (flags: Flags, npc = ELDER): string[] => { const e = lineFor(npc, flags); for (const f of e?.sets ?? []) flags.set(f); return e?.lines ?? []; };

describe('Nalati quest line data', () => {
  it('validates: every flag a chapter reads is raised by the runtime', () => {
    const raised = new Set([...NALATI_QUEST_EXTERNAL, ...NALATI_QUESTS.map((q) => q.completeFlag)]);
    for (const q of NALATI_QUESTS) expect(validateQuest(q, raised), q.id).toEqual([]);
  });
  it('TULPAR is three steps after the elder: tame → kokpar → home', () => {
    expect(TULPAR_QUEST.steps.map((s) => s.id)).toEqual(['tame', 'kokpar', 'home']);
    expect(TULPAR_QUEST.startWhen).toEqual({ all: ['talked:elder'] });
  });
  it('every camp person has something to say from the first meeting', () => {
    for (const npc of Object.values(CAMP_NPCS)) expect(lineFor(npc, fresh())?.lines.length, npc.id).toBeGreaterThan(0);
  });
  it('the 17 map places, unique ids', () => {
    expect(NALATI_PLACES).toHaveLength(NALATI_MAP.pois.length);
    expect(new Set(NALATI_PLACES.map((p) => p.id)).size).toBe(NALATI_PLACES.length);
  });
});

describe('TULPAR, played', () => {
  it('the elder starts it, the steps advance, the elder ends it', () => {
    const flags = fresh();
    const line = new QuestLine(NALATI_QUESTS, flags);
    const q = line.active;
    expect(q?.def.id).toBe('tulpar');
    expect(q?.isStarted).toBe(false);
    expect(q?.markers().map((m) => m.id)).toEqual(['elder']);
    expect(talk(flags)[0]).toMatch(/Salem/);
    expect(q?.current?.id).toBe('tame');
    expect(q?.markers().map((m) => m.id)).toEqual(['plains', 'argymaq']);
    expect(talk(flags)[0]).toMatch(/horse plains/);            // the hint, again
    flags.set('tamed:horse');
    expect(q?.current?.id).toBe('kokpar');
    flags.set('won:kokpar');
    expect(q?.current?.id).toBe('home');
    expect(talk(flags)[0]).toMatch(/whole valley/);
    expect(flags.has(TULPAR_DONE)).toBe(true);
    expect(line.active).toBeNull();
    expect(talk(flags)[0]).toMatch(/sack of flour/);
  });
  it('catches up: a save that already tamed and won finishes on the first talk', () => {
    const flags = fresh();
    flags.set('tamed:horse'); flags.set('won:kokpar');
    const line = new QuestLine(NALATI_QUESTS, flags);
    let completed = 0;
    line.onComplete = () => { completed++; };
    expect(talk(flags)[0]).toMatch(/whole valley/);
    expect(flags.has(TULPAR_DONE)).toBe(true);
    expect(completed).toBe(1);
  });
  it('Argymaq gets his own line, and a tamed horse starts the chapter at the kokpar', () => {
    const flags = fresh();
    flags.set('tamed:horse'); flags.set('tamed:argymaq');
    const line = new QuestLine(NALATI_QUESTS, flags);
    expect(talk(flags)[0]).toMatch(/ARGYMAQ/);
    expect(line.active?.current?.id).toBe('kokpar');
  });
});

describe('placesWithDiscovery (the shared core)', () => {
  it('discovers within r, once, into a saved `seen:` flag; the map names only what was found', () => {
    const flags = fresh();
    const toasts: string[] = [];
    const places = placesWithDiscovery([{ id: 'camp', label: 'NOMAD CAMP', x: 0, z: 0, r: 10 }, { id: 'rock', label: 'EAGLE ROCK', x: 100, z: 0, r: 10 }], flags, (t) => { toasts.push(t); }, () => [{ id: 'q', label: 'Q', short: 'Q', x: 5, z: 5 }]);
    places.update(3, 3);
    places.update(3, 3);
    expect(toasts).toEqual(['Discovered · NOMAD CAMP']);
    expect(flags.has('seen:camp')).toBe(true);
    expect(places.mapPois().map((p) => p.kind)).toEqual(['place', 'unknown', 'quest']);
  });
});
