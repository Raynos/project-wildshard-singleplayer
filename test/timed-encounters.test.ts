import * as reachQueries from '../src/engine/ai/reach';
import type { PlayerHealth } from '../src/engine/combat/health';
import type { Animal } from '../src/engine/entities/AnimalView';
import { ReturnProgram } from '../src/game/population/returnProgram';
import { parse } from 'valibot';
import { TimedEncountersSchema } from '@wildshard/format/encounterRows';
import { CueDirector } from '../src/game/audio/cueDirector';
import { expect, test, vi } from 'vitest';
import { BoxGeometry, PerspectiveCamera, Scene, Vector3, type Vector2 } from 'three';
import { app } from '../src/engine/app/runtime';
import { Scope } from '../src/engine/app/scope';
import type { Game } from '../src/engine/core/Game';
import type { Player } from '../src/engine/player/Player';
import type { DayCycleClock } from '../src/engine/world/dayCycle';
import { NalatiNight } from '../src/shards/nalati-grasslands/world/nightView';
import { setTerrainHeight, setTerrainPlacement } from '../src/engine/world/terrainHeight';
import { legacyDouble } from './fake/FakeGame';
import night from '../src/shards/nalati-grasslands/data/night.generated.json' with { type: 'json' };
import strikes from '../src/shards/nalati-grasslands/data/strikeProfiles.generated.json' with { type: 'json' };

test('the listed night binding preserves phases, native identities, figures and contact rows', () => {
  setTerrainHeight(() => 0); setTerrainPlacement(() => [0, 1, 0], () => -1000);
  const scope = new Scope('marsh.watch'), figure = new BoxGeometry(.2, .5, .3);
  const game = legacyDouble<Game>({ app, levelScope: scope, scene: new Scene(), camera: new PerspectiveCamera(),
    renderer: legacyDouble<Game['renderer']>({ getDrawingBufferSize: (out: Vector2) => out.set(400, 800) }) });
  const rows = { ...night, presentation: 'marsh', phases: { slots: ['golden'], patrol: [] }, lightFloor: .7,
    slots: { ...night.slots, actors: { ...night.slots.actors, kind: 'marsh-guard' } },
    patrol: { ...night.patrol, actors: { ...night.patrol.actors, kind: 'marsh-watch' } },
    contact: { strike: strikes.arrow, tags: ['creature.marsh-watch'], origin: 'actor' } };
  try {
    const clock = legacyDouble<DayCycleClock>({ dayPhase: 'day' });
    const watch = new NalatiNight({ game, player: legacyDouble<Player>({ position: new Vector3(1, 0, 2) }), sky: legacyDouble({}), forest: legacyDouble({}), sites: null, clock },
      parse(TimedEncountersSchema,rows), { rider: figure, captain: figure, storm: figure }, ReturnProgram.page(night.program), new CueDirector(game, night.cues, scope));
    expect(watch.slots).toBeDefined(); expect(watch.riders).toBeDefined();
    expect(watch.target(new Vector3(), new Vector3(0, 0, 1), 10, null)).toBeNull();
    watch.update(.05, .05);
    expect(() => parse(TimedEncountersSchema,{ ...rows, contact: { ...rows.contact, tags: ['bad'] } })).toThrow();
  } finally { scope.dispose(); figure.dispose(); }
});

test('night contacts preserve origin, strike range and cover before native player damage',()=>{
  const scope=new Scope('night.contacts'),figure=new BoxGeometry(.2,.5,.3),position=new Vector3(1,0,2);
  const game=legacyDouble<Game>({app,levelScope:scope,scene:new Scene(),camera:new PerspectiveCamera(),
    renderer:legacyDouble<Game['renderer']>({getDrawingBufferSize:(out:Vector2)=>out.set(400,800)})});
  const target=legacyDouble<PlayerHealth>({}),actor=legacyDouble<Animal>({kind:'ghost-rider',label:'Rider',position:new Vector3(1,0,2),scale:1,yaw:0});
  const playerRead=vi.spyOn(app,'player','get').mockReturnValue(target),hit=vi.spyOn(app.combat,'hit').mockReturnValue(null),reach=vi.spyOn(reachQueries,'canReach').mockReturnValue(true);
  try{
    const create=(origin:'actor'|'player')=>new NalatiNight({game,player:legacyDouble<Player>({position}),sky:legacyDouble({}),forest:legacyDouble({}),sites:null,clock:legacyDouble<DayCycleClock>({dayPhase:'day'})},
      parse(TimedEncountersSchema,{...night,presentation:'night',contact:{strike:strikes.arrow,tags:['creature.ghost-rider'],origin}}),{rider:figure,captain:figure,storm:figure},ReturnProgram.page(night.program),new CueDirector(game,night.cues,scope));
    const watch=create('actor');vi.spyOn(watch.riders,'update').mockReturnValue([{damage:17,from:actor}]);
    watch.update(.1,.1);expect(hit).toHaveBeenCalledTimes(1);const firstHit=hit.mock.calls[0]?.[0];expect(firstHit?.target).toBe(target);expect(firstHit?.amount).toBe(17);expect(firstHit?.point).toBe(actor.position);expect(firstHit?.cause).toEqual({kind:actor.kind,label:actor.label});
    hit.mockClear();reach.mockReturnValue(false);watch.update(.1,.2);expect(hit).not.toHaveBeenCalled();
    reach.mockReturnValue(true);actor.position.x=100;watch.update(.1,.3);expect(hit).not.toHaveBeenCalled();
    const playerOrigin=create('player');vi.spyOn(playerOrigin.riders,'update').mockReturnValue([{damage:19,from:actor}]);
    playerOrigin.update(.1,.4);expect(hit).toHaveBeenCalledTimes(1);expect(hit.mock.calls[0]?.[0].amount).toBe(19);
  }finally{playerRead.mockRestore();hit.mockRestore();reach.mockRestore();scope.dispose();figure.dispose();}
});
