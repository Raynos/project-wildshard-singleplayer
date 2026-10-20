import { expect, test } from 'vitest';
import { Group, Scene, Vector3 } from 'three';
import type { Game } from '../src/engine/core/Game';
import type { Animal } from '../src/engine/entities/AnimalView';
import type { AnimalManager } from '../src/engine/entities/AnimalManager';
import type { Player } from '../src/engine/player/Player';
import type { EliteBar } from '../src/engine/ui/EliteBar';
import type { EliteDef, Elites } from '../src/game/Elite';
import { KeeperElitePage, eliteDamageMul } from '../src/game/quest/elitePage';
import { legacyDouble } from './fake/FakeGame';
import pouncer from '../src/shards/nalati-grasslands/data/aqbarsProfile.json' with { type: 'json' };

const def: EliteDef = { id: 'marsh.guardian', name: 'Reed Guardian', epithet: 'Marsh stalker', lair: { x: 25, z: -40, r: 12 },
  awareR: 40, engageR: 20, leashR: 100, rule: 'always', respawnMin: 5, signature: 'Marsh leap', phase2: 'Enraged',
  drop: { skin: 'reed', skinName: 'Reed cloak', weapon: '', blurb: '' } };

test('independent marsh encounter binds the approved pouncer policy, body and drops from data', () => {
  const retired: Animal[] = [], requests: unknown[][] = [], body = legacyDouble<Animal>({ mem: {}, herd: 4 });
  const animals = legacyDouble<AnimalManager>({ spawn: (...args) => { requests.push(args); return body; }, retire: actor => { retired.push(actor); } });
  const model = new Group(), game = legacyDouble<Game>({ scene: new Scene() });
  const keeper = new KeeperElitePage({ def, kind: 'marsh-cat', pattern: 'pouncer', spec: pouncer.spec,
    yaw: .7, offset: [3, -2], memory: { low: .2 }, tell: [.2, .7, .5], beam: [.5, .4, .8], messages: {}, voices: {} },
  { game, animals, player: legacyDouble<Player>({ position: new Vector3(1, 0, 2) }), elites: legacyDouble<Elites>({}),
    bar: legacyDouble<EliteBar>({}), ledges: [], rock: { x: 0, z: 0, top: 10 } }, model);
  keeper.spawn(); expect(keeper.animal).toBe(body); expect(body.mem['low']).toBe(.2); expect(body.herd).toBe(-1);
  expect(requests[0]).toEqual(['marsh-cat', 28, -42, .7, def.id]);
  expect(eliteDamageMul(body, new Vector3(), new Vector3())).toBe(1);
  expect(keeper.dropModel()).not.toBe(model); expect(keeper.drainEffects()).toEqual([]);
  keeper.enterPhase2(); keeper.reset(); keeper.despawn(); expect(retired[0]).toBe(body); expect(keeper.animal).toBeNull();
});
