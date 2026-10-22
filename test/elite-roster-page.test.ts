import { expect, test } from 'vitest';
import { Group, Scene, PerspectiveCamera, Vector3, SkinnedMesh, MeshLambertMaterial } from 'three';
import { Scope } from '../src/engine/app/scope';
import { app } from '../src/engine/app/runtime';
import { DeclaredEliteEntry } from '../src/engine/ai/view/eliteEntry';
import { StrikeRunner } from '../src/engine/ai/strikes';
import type { Game } from '../src/engine/core/Game';
import type { Animal } from '../src/engine/entities/AnimalView';
import type { AnimalManager } from '../src/engine/entities/AnimalManager';
import type { Player } from '../src/engine/player/Player';
import type { HUD } from '../src/engine/ui/HUD';
import type { Audio } from '../src/engine/audio/Audio';
import type { Music } from '../src/engine/audio/Music';
import type { EliteBar } from '../src/engine/ui/EliteBar';
import type { DayCycleClock } from '../src/engine/world/dayCycle';
import type { AdventurePersistence } from '../src/game/quest/persistence';
import type { PageWildlife } from '../src/game/population/wildlife';
import { Elites } from '../src/game/Elite';
import { ExternalElitePage } from '../src/game/quest/elitePage';
import { ReturnProgram } from '../src/game/population/returnProgram';
import { PageWildEnvironment } from '../src/game/population/pageGroups';
import { ELITE_CONDITION_COLUMNS } from '../src/format/eliteEntryRows';
import { legacyDouble } from './fake/FakeGame';
import ecology from '../src/shards/nalati-grasslands/data/ecology.generated.json' with { type: 'json' };
import admission from '../src/shards/nalati-grasslands/behaviour/admission.generated.json' with { type: 'json' };
import charge from '../src/shards/nalati-grasslands/data/eliteCharge.generated.json' with { type: 'json' };
import { parseExternalElite } from '../src/format/eliteFeature';
import { parseSpawnScript } from '../src/format/spawnScripts';
import { strike } from '../src/sdk/species';
import strikes from '../src/shards/nalati-grasslands/data/strikeProfiles.generated.json' with { type: 'json' };

test('a marsh roster binds its own herd, drop and identities without author callbacks', () => {
  const source = ecology.externalElites.find(row => row.mode === 'herd');
  if (source?.mode !== 'herd') throw new Error('Missing external template');
  const row = parseExternalElite({ ...source, def: { ...source.def, id: 'marsh.stag', name: 'Reed Stag', rule: 'always' as const,
    lair: { x: 30, z: -12, r: 15 } }, spawn: { ...source.spawn, kind: 'reed-stag', variant: 'silver', offset: [2, -4], mares: 3, foals: 0 },
    adopted: { scale: 1.1, kind: 'reed-stag', variant: 'silver', feed: 'The stag joins you' } });
  if (row.mode !== 'herd') throw new Error('Missing admitted herd row');
  const root = new Scope('marsh.roster'), construction = root.child('construction'), entered = root.child('entered'), requests: unknown[][] = [];
  const body = legacyDouble<Animal>({ position: new Vector3(30, 0, -12), mesh: new SkinnedMesh(undefined, new MeshLambertMaterial()), herd: -1, mem: {} });
  const members = [legacyDouble<Animal>({ herd: 0 })], herd = legacyDouble<ReturnType<PageWildlife['spawnHerd']>>({ members, adoptStallion: actor => { members.push(actor); } });
  const animals = legacyDouble<AnimalManager>({ herds: [legacyDouble<AnimalManager['herds'][number]>({ members })], spawn: (...args) => { requests.push(args); return body; } });
  const wildlife = legacyDouble<PageWildlife>({ spawnHerd: (...args) => { requests.push(args); return herd; }, spawnPack: () => { throw new Error('No pack request'); } });
  const game = legacyDouble<Game>({ app, renderer: legacyDouble<Game['renderer']>({}), scene: new Scene(), camera: new PerspectiveCamera(), levelScope: construction });
  const player = legacyDouble<Player>({ position: new Vector3() }), saved = { read: () => ({}), write: () => true };
  const rows = { entry: { version: 1, id: 'marsh.roster', ui: 'marsh.ui', conditionObservations: 'conditions',
    conditions: [{ id: 'always', program: 'rules', signal: 'eliteRule', observations: [{ field: 'rule', value: 0 }] }],
    entries: [{ id: row.def.id, condition: 'always', controller: { kind: 'borrowed', controller: row.def.id } }] },
    actions: [{ id: 1, controller: 0, kind: 'wildlife-herd', actorKind: row.spawn.kind, variant: row.spawn.variant, offset: row.spawn.offset, mares: 3, foals: 0, stallion: row.spawn.stallion },
      { id: 2, controller: 0, kind: 'record', actorKind: row.adopted.kind, variant: row.adopted.variant }, { id: 3, controller: 0, kind: 'feed', text: row.adopted.feed }],
    profiles: [], borrowed: [row], observations: [{ id: 'conditions', rows: ELITE_CONDITION_COLUMNS }],
    presentation: { [row.def.id]: { prompt: `Take the ${row.def.drop.skinName} ${row.def.drop.weapon} skin`,
      toast: `${row.def.drop.skinName} ${row.def.drop.weapon} skin — ${row.def.drop.blurb}`, hum: true, sting: { banner: .8, phase2: 1, kill: 'chunk' } } },
    strikes: [], fallbackStrike: strike(strikes.captain), prewarm: [] };
  const guest = ReturnProgram.page(admission), models = new Map([[row.def.id, new Group()]]), fight = parseSpawnScript(charge);
  try {
    expect(() => new DeclaredEliteEntry({ ...rows.entry, entries: [...rows.entry.entries, ...rows.entry.entries] }, construction)).toThrow('identities');
    const entry = new DeclaredEliteEntry<ExternalElitePage>(rows.entry, construction);
    entered.expose(app, 'levelScope', construction);
    entered.run(() => {
      const owner = new Elites({ scene: game.scene, camera: game.camera, player, condition: rule => entry.holds(rule) }, legacyDouble<EliteBar>({}), 'reed-marsh', saved);
      const controller = new ExternalElitePage(row, { game, player, animals, elites: owner }, guest, new Group(), fight, true);
      owner.bindDeclaredEntry(entry, rows, { construction, entered: { scope: entered, interactables: [],
        hud: legacyDouble<HUD>({ killFeed: () => undefined }), audio: legacyDouble<Audio>({ animal: () => undefined }), music: legacyDouble<Music>({}) }, game, player, body: 'animals', animals,
        models, program: { id: 'rules', scope: construction, value: guest }, controllers: [controller], environment: new PageWildEnvironment(),
        clock: legacyDouble<DayCycleClock>({ dayPhase: 'day', hour: 12, night: 0 }), weather: { stormActive: false }, ledges: [], rock: { x: 1, z: 2, top: 3 },
        patrol: null, wildlife, persistence: legacyDouble<AdventurePersistence>({ elites: saved, kill: () => undefined, feat: () => undefined }), contacts: new StrikeRunner() });
    });
    entry.initialize({ patrolAvailable: false, herdAvailable: true, kills: 0, bonded: false, mount: null });
    expect(requests).toEqual([[32, -16, 3, 0, false], ['reed-stag', 30, -12, 0, 'silver']]);
    expect(entry.scripts[0]?.animal).toBe(body); expect(body.herd).toBe(0); expect(members.some(member => member === body)).toBe(true);
    expect(entry.scripts[0]?.dropModel()).toBeInstanceOf(Group);
  } finally { root.dispose(); }
});
