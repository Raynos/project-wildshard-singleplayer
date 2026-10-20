import { CueDirector } from '../src/game/audio/cueDirector';
import { expect, test } from 'vitest';
import { BoxGeometry, PerspectiveCamera, Scene, Vector3, type Vector2 } from 'three';
import { app } from '../src/engine/app/runtime';
import { Scope } from '../src/engine/app/scope';
import type { Game } from '../src/engine/core/Game';
import type { Player } from '../src/engine/player/Player';
import type { DayCycleClock } from '../src/engine/world/dayCycle';
import type { PageCreatureGuest } from '../src/game/population/creatureGuest';
import { TimedEncounters } from '../src/game/boss/timedEncounters';
import { setTerrainHeight, setTerrainPlacement } from '../src/engine/world/terrainHeight';
import { legacyDouble } from './fake/FakeGame';
import night from '../src/shards/nalati-grasslands/data/night.generated.json' with { type: 'json' };
import strikes from '../src/shards/nalati-grasslands/data/strikeProfiles.generated.json' with { type: 'json' };

test('a marsh watch composes its own phases, native identities, figures and contact rows', () => {
  setTerrainHeight(() => 0); setTerrainPlacement(() => [0, 1, 0], () => -1000);
  const scope = new Scope('marsh.watch'), figure = new BoxGeometry(.2, .5, .3);
  const game = legacyDouble<Game>({ app, levelScope: scope, scene: new Scene(), camera: new PerspectiveCamera(),
    renderer: legacyDouble<Game['renderer']>({ getDrawingBufferSize: (out: Vector2) => out.set(400, 800) }) });
  const rows = { ...night, phases: { slots: ['golden'], patrol: [] }, lightFloor: .7,
    slots: { ...night.slots, actors: { ...night.slots.actors, kind: 'marsh-guard' } },
    patrol: { ...night.patrol, actors: { ...night.patrol.actors, kind: 'marsh-watch' } },
    contact: { strike: strikes.arrow, tags: ['creature.marsh-watch'], origin: 'actor' } };
  try {
    const clock = legacyDouble<DayCycleClock>({ dayPhase: 'day' });
    const watch = new TimedEncounters({ game, player: legacyDouble<Player>({ position: new Vector3(1, 0, 2) }), sky: legacyDouble({}), forest: legacyDouble({}), sites: null, clock },
      rows, { rider: figure, captain: figure, storm: figure }, legacyDouble<PageCreatureGuest>({ weakPoint: () => false }), new CueDirector(game, night.cues, scope));
    expect(watch.slots).toBeDefined(); expect(watch.riders).toBeDefined();
    expect(watch.target(new Vector3(), new Vector3(0, 0, 1), 10, null)).toBeNull();
    watch.update(.05, .05);
    expect(() => new TimedEncounters({ game, player: legacyDouble({}), sky: legacyDouble({}), forest: legacyDouble({}), sites: null, clock },
      { ...rows, contact: { ...rows.contact, tags: ['bad'] } }, { rider: figure }, legacyDouble({}), new CueDirector(game, night.cues, scope))).toThrow();
  } finally { scope.dispose(); figure.dispose(); }
});
