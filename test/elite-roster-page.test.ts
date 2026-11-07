import {admissionPage} from './fixtures/nalati-admission-loan';
import { expect, test } from 'vitest';
import { Group, Scene, PerspectiveCamera, Vector3, SkinnedMesh, MeshLambertMaterial } from 'three';
import { Scope } from '../src/engine/shared/app/scope';
import { app } from '../src/engine/client/app/runtime';
import { BorrowedElite, DeclaredEliteEntry } from '../src/engine/client/ai/view/eliteEntry';
import { StrikeRunner } from '../src/engine/shared/ai/strikes';
import type { Game } from '../src/engine/client/core/Game';
import type { Animal } from '../src/engine/client/entities/AnimalView';
import type { AnimalManager } from '../src/engine/server/entities/AnimalManager';
import type { Player } from '../src/engine/client/player/Player';
import type { HUD } from '../src/engine/client/ui/HUD';
import type { Audio } from '../src/engine/client/audio/Audio';
import type { Music } from '../src/engine/client/audio/Music';
import type { EliteBar } from '../src/engine/client/ui/EliteBar';
import type { DayCycleClock } from '../src/engine/shared/world/dayCycle';
import type { AdventurePersistence } from '../src/game/shared/quest/persistence';
import { Elites, type EliteWildlife } from '../src/game/client/Elite';

import { PageAir } from '../src/game/client/population/pageAir';
import { ELITE_CONDITION_COLUMNS } from '@wildshard/format/eliteEntryRows';
import { legacyDouble } from '@wildshard/engine/test/FakeGame';
import { NALATI_ECOLOGY as ecology } from '../src/shards/nalati-grasslands/generators/ecology.mjs';
import { parseExternalElite } from '@wildshard/format/eliteFeature';
import { strike } from '../src/sharddev/species';
import strikes from './fixtures/nalati-strikeProfiles-original.json' with { type: 'json' };

test('a marsh roster binds its own drop and identities, and wakes no lair of its own', () => {
  const source = ecology.externalElites.find(row => row.mode === 'herd');
  if (source?.mode !== 'herd') throw new Error('Missing external template');
  const row = parseExternalElite({ ...source, def: { ...source.def, id: 'marsh.stag', name: 'Reed Stag', rule: 'always' as const,
    lair: { x: 30, z: -12, r: 15 } }, spawn: { ...source.spawn, kind: 'reed-stag', variant: 'silver', offset: [2, -4], mares: 3, foals: 0 },
    adopted: { scale: 1.1, kind: 'reed-stag', variant: 'silver', feed: 'The stag joins you' } });
  if (row.mode !== 'herd') throw new Error('Missing admitted herd row');
  const root = new Scope('marsh.roster'), construction = root.child('construction'), entered = root.child('entered'), requests: unknown[][] = [];
  const body = legacyDouble<Animal>({ position: new Vector3(30, 0, -12), mesh: new SkinnedMesh(undefined, new MeshLambertMaterial()), herd: -1, mem: {} });
  const members = [legacyDouble<Animal>({ herd: 0 })], herd = legacyDouble<ReturnType<EliteWildlife['spawnHerd']>>({ members, adoptStallion: actor => { members.push(actor); } });
  const animals = legacyDouble<AnimalManager>({ herds: [legacyDouble<AnimalManager['herds'][number]>({ members })], spawn: (...args) => { requests.push(args); return body; } });
  const wildlife = legacyDouble<EliteWildlife>({ spawnHerd: (...args) => { requests.push(args); return herd; }, spawnPack: () => { throw new Error('No pack request'); } });
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
  const guest = admissionPage(), models = new Map([[row.def.id, new Group()]]);
  try {
    expect(() => new DeclaredEliteEntry({ ...rows.entry, entries: [...rows.entry.entries, ...rows.entry.entries] }, construction)).toThrow('identities');
    const entry = new DeclaredEliteEntry(rows.entry, construction);
    entered.expose(app, 'levelScope', construction);
    entered.run(() => {
      const owner = new Elites({ scene: game.scene, camera: game.camera, player, condition: rule => entry.holds(rule) }, legacyDouble<EliteBar>({}), 'reed-marsh', saved);
      const controller = new BorrowedElite(row, { game, player, elites: owner }, guest, new Group(), true);
      owner.bindDeclaredEntry(entry, rows, { construction, entered: { scope: entered, interactables: [],
        hud: legacyDouble<HUD>({ killFeed: () => undefined }), audio: legacyDouble<Audio>({ animal: () => undefined }), music: legacyDouble<Music>({}) }, game, player, body: 'animals', animals,
        models, program: { id: 'rules', scope: construction, value: guest }, controllers: [controller], environment: new PageAir(),
        clock: legacyDouble<DayCycleClock>({ dayPhase: 'day', hour: 12, night: 0 }), weather: { stormActive: false }, ledges: [], rock: { x: 1, z: 2, top: 3 },
        patrol: null, wildlife, persistence: legacyDouble<AdventurePersistence>({ elites: saved, kill: () => undefined, feat: () => undefined }), contacts: new StrikeRunner() });
    });
    entry.initialize({ patrolAvailable: false, herdAvailable: true, kills: 0, bonded: false, mount: null });
    expect(requests).toEqual([]); // a lair's body is its row's: a page wakes none
    expect(entry.scripts[0]?.animal).toBeNull();
    expect(entry.scripts[0]?.dropModel()).toBeInstanceOf(Group);
  } finally { root.dispose(); }
});
