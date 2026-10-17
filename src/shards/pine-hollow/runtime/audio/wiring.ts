import * as v from 'valibot';
import { installRuntimeGameplayAudio } from '@wildshard/game/plugin/audio';
import type { ShardContext } from '@wildshard/game/shard/context';
import type { Game } from '@wildshard/engine/core/Game';
import type { Audio } from '@wildshard/engine/audio/Audio';
import type { Music } from '@wildshard/engine/audio/Music';
import type { SkyRig } from '@wildshard/engine/world/skyRig';
import type { AnimalManager } from '@wildshard/engine/entities/AnimalManager';
import type { DeclaredAmbience } from '@wildshard/engine/audio/declaredAmbience';
import type { Elites } from '@wildshard/game/Elite';
import type { BuildingLife } from '../props/buildingLife';

/** Residual native door loan; gameplay policy and entry lifetimes are admitted DATA. */
export async function installPineAudio(h:{context:ShardContext;game:Game;audio:Audio;music:Music;sky:SkyRig;animals:AnimalManager;ambience:DeclaredAmbience;cabins:BuildingLife|null;elites:Elites}):Promise<void> {
  await installRuntimeGameplayAudio(h.context,{audio:h.audio,music:h.music,camera:h.game.camera,ambience:h.ambience,doors:h.cabins===null?null:{onDoor:h.cabins.onDoor.bind(h.cabins)},owners:{sky:h.sky,animals:h.animals,elites:h.elites}});
}

const number=v.pipe(v.number(),v.finite());
const point={x:number,y:number,z:number};
const ambienceRows=v.strictObject({floors:v.pipe(v.array(v.strictObject({...point,rot:number,hw:number,hd:number})),v.maxLength(128)),
  firePits:v.pipe(v.array(v.strictObject(point)),v.maxLength(16))});
/** Static cabin audio rows from the admitted product; neither lighting nor door code owns these lists. */
export function parseCabinAmbienceRows(value:unknown):v.InferOutput<typeof ambienceRows>{return v.parse(ambienceRows,value);}
