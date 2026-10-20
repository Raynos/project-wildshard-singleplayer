// @vitest-environment happy-dom
import { expect, test } from 'vitest';
import { Group, Scene, PerspectiveCamera, Vector3, SkinnedMesh, MeshLambertMaterial } from 'three';
import { Scope } from '../src/engine/app/scope';
import { withOwner } from '../src/engine/app/ownership';
import type { Game } from '../src/engine/core/Game';
import type { Animal } from '../src/engine/entities/AnimalView';
import type { AnimalManager } from '../src/engine/entities/AnimalManager';
import type { Player } from '../src/engine/player/Player';
import type { DayCycleClock } from '../src/engine/world/dayCycle';
import type { AdventurePersistence } from '../src/game/quest/persistence';
import type { PageWildlife } from '../src/game/population/wildlife';
import { EliteRosterPage, type EliteRosterRows } from '../src/game/quest/eliteRosterPage';
import { ReturnProgram } from '../src/game/population/returnProgram';
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
  const rows: EliteRosterRows = { keepers: [], external: [row], conditions: [{ id: 'always', signal: 'eliteRule', observations: { rule: 0 } }],
    strikes: [], fallbackStrike: strike(strikes.captain), knockDuration: .5, prewarm: [] };
  const scope = new Scope('marsh.roster'), requests: unknown[][] = [];
  const body = legacyDouble<Animal>({ position: new Vector3(30, 0, -12), mesh: new SkinnedMesh(undefined, new MeshLambertMaterial()), herd: -1, mem: {} });
  const members = [legacyDouble<Animal>({ herd: 0 })], herd = legacyDouble<ReturnType<PageWildlife['spawnHerd']>>({ members, adoptStallion: actor => { members.push(actor); } });
  const animals = legacyDouble<AnimalManager>({ herds: [legacyDouble<AnimalManager['herds'][number]>({ members })], spawn: (...args) => { requests.push(args); return body; } });
  const wildlife = legacyDouble<PageWildlife>({ spawnHerd: (...args) => { requests.push(args); return herd; } });
  const game = legacyDouble<Game>({ scene: new Scene(), camera: new PerspectiveCamera(), renderer: legacyDouble({}), level: legacyDouble<Game['level']>({ id: 'reed-marsh' }), levelScope: scope });
  const context = { game, player: legacyDouble<Player>({ position: new Vector3() }), ledges: [], rock: { x: 1, z: 2, top: 3 },
    clock: legacyDouble<DayCycleClock>({ dayPhase: 'day' }), weather: { stormActive: false } };
  const guest = ReturnProgram.page(admission), models = new Map([[row.def.id, new Group()]]), fight = parseSpawnScript(charge);
  try {
    expect(() => new EliteRosterPage(context, { ...rows, external: [row, row] }, guest, models, fight)).toThrow('identities');
    const roster = new EliteRosterPage(context, rows, guest, models, fight);
    const saved = legacyDouble<AdventurePersistence>({ elites: { read: () => ({}), write: () => true } });
    withOwner(scope, () => { roster.bind({ persistence: saved, animals, wildlife, taming: null, interactables: [],
      hud: legacyDouble({}), audio: legacyDouble({}), music: legacyDouble({}) }); });
    roster.initialize();
    expect(requests).toEqual([[32, -16, 3, 0, false], ['reed-stag', 30, -12, 0, 'silver']]);
    expect(roster.scripts[0]?.animal).toBe(body); expect(body.herd).toBe(0); expect(members.some(member => member === body)).toBe(true);
    expect(roster.scripts[0]?.dropModel()).toBeInstanceOf(Group);
  } finally { scope.dispose(); }
});
