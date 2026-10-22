import { setTerrainHeight } from '../src/engine/world/terrainHeight';
import { ReturnProgram } from '../src/game/population/returnProgram';
import admission from '../src/shards/nalati-grasslands/behaviour/admission.generated.json' with { type: 'json' };
import ecology from '../src/shards/nalati-grasslands/data/ecology.generated.json' with { type: 'json' };
import { beforeEach, expect, test } from 'vitest';
import { Group, Scene, Vector3, SkinnedMesh, BoxGeometry, MeshLambertMaterial } from 'three';
import type { Game } from '../src/engine/core/Game';
import type { Animal } from '../src/engine/entities/AnimalView';
import type { AnimalManager } from '../src/engine/entities/AnimalManager';
import type { Player } from '../src/engine/player/Player';
import type { EliteBar } from '../src/engine/ui/EliteBar';
import type { EliteDef, Elites } from '../src/game/Elite';
import { ExternalElitePage } from '../src/game/quest/elitePage';
import { NativeEliteController } from '../src/engine/ai/view/eliteController';
import { eliteDamageMul } from '../src/engine/entities/eliteBrain';
import { Scope } from '../src/engine/app/scope';
import { legacyDouble } from './fake/FakeGame';
import pouncer from '../src/shards/nalati-grasslands/data/aqbarsProfile.json' with { type: 'json' };

beforeEach(() => { setTerrainHeight(() => 0); });

const def: EliteDef = { id: 'marsh.guardian', name: 'Reed Guardian', epithet: 'Marsh stalker', lair: { x: 25, z: -40, r: 12 },
  awareR: 40, engageR: 20, leashR: 100, rule: 'always', respawnMin: 5, signature: 'Marsh leap', phase2: 'Enraged',
  drop: { skin: 'reed', skinName: 'Reed cloak', weapon: 'marsh-blade', blurb: '' } };

test('independent marsh encounter binds the approved pouncer policy, body and drops from data', () => {
  const retired: Animal[] = [], requests: unknown[][] = [], body = legacyDouble<Animal>({ mem: {}, herd: 4 });
  const animals = legacyDouble<AnimalManager>({ spawn: (...args) => { requests.push(args); return body; }, retire: actor => { retired.push(actor); } });
  const model = new Group(), game = legacyDouble<Game>({ scene: new Scene() });
  const scope = new Scope('keeper.fixture');
  const keeper = scope.run(() => new NativeEliteController({ def, variant: def.id, kind: 'marsh-cat', pattern: 'pouncer', spec: pouncer.spec,
    yaw: .7, offset: [3, -2], memory: { low: .2 }, tell: [.2, .7, .5], beam: [.5, .4, .8], messages: {}, voices: {} },
  { game, animals, player: legacyDouble<Player>({ position: new Vector3(1, 0, 2) }), lifecycle: legacyDouble<Elites>({}),
    bar: legacyDouble<EliteBar>({}), ledges: [], rock: { x: 0, z: 0, top: 10 } }, model));
  keeper.spawn(); expect(keeper.animal).toBe(body); expect(body.mem['low']).toBe(.2); expect(body.herd).toBe(-1);
  expect(requests[0]).toEqual(['marsh-cat', 28, -42, .7, def.id]);
  expect(eliteDamageMul(body, new Vector3(), new Vector3())).toBe(1);
  expect(keeper.dropModel()).not.toBe(model); expect(keeper.drainEffects()).toEqual([]);
  keeper.enterPhase2(); keeper.reset(); keeper.despawn(); expect(retired[0]).toBe(body); expect(keeper.animal).toBeNull(); scope.dispose();
});

test('an independent marsh herd encounter adopts native bodies and follows AS tells and rewards', () => {
  const template = ecology.externalElites.find(row => row.mode === 'herd');
  if (template?.mode !== 'herd') throw new Error('Missing herd fixture');
  const signatures: string[] = [], wins: string[] = [];
  const actor = legacyDouble<Animal>({ position: new Vector3(3, 0, 4), hp: 750, maxHp: 750, alive: true, mesh: new SkinnedMesh(new BoxGeometry(), new MeshLambertMaterial()) });
  const mount = legacyDouble<Animal>({ position: new Vector3(1, 0, 2), scale: 1, mesh: new SkinnedMesh() });
  const herd: NonNullable<Parameters<ExternalElitePage['adopt']>[1]> = { stallionState: 'display', stallion: actor, leadAway: () => undefined };
  const script = new ExternalElitePage({ ...template, def, spawn: { ...template.spawn, kind: 'marsh-stag' },
    adopted: { ...template.adopted, kind: 'marsh-stag', feed: 'A stag joins you' } },
  { game: legacyDouble<Game>({ scene: new Scene() }), animals: legacyDouble<AnimalManager>({}), player: legacyDouble<Player>({ position: new Vector3(10, 0, 20) }),
    elites: legacyDouble<Elites>({ signature: id => { signatures.push(id); }, won: id => { wins.push(id); } }) }, ReturnProgram.page(admission), new Group());
  script.observe(0, { available: true, kills: 0, bonded: false, mount: null }); expect(script.canSpawn()).toBe(true);
  script.spawn(); expect(script.drainEffects()[0]?.kind).toBe('request'); script.adopt(actor, herd);
  script.tick(.1, .1, false, false); expect(signatures).toEqual([def.id]); expect(script.barFrac()).toBe(1);
  herd.stallionState = 'beaten'; script.tick(.1, .2, false, false); expect(script.broken()).toBe(true);
  herd.stallion = null; script.observe(.1, { available: true, kills: 0, bonded: true, mount }); script.tick(.1, .3, false, false);
  expect(wins).toEqual([def.id]); expect(mount.scale).toBe(1.3);
  const effects = script.drainEffects(); expect(effects.map(effect => effect.kind)).toEqual(['record', 'feed']);
  script.despawn(); expect(script.animal).toBe(actor);
});
