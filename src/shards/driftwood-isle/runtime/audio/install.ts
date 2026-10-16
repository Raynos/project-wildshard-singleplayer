import { installRuntimeAudioEntry, installRuntimeGameplayAudio } from '@wildshard/game/plugin/audio';
import type { ShardContext } from '@wildshard/game/shard/context';
import { windUniforms } from '@wildshard/engine/world/TreeFactory';
import { driftwoodWorld } from '../../world/build';
import { SECTIONS } from '../sections';

/** Residual native floor/dusk loans; gameplay and cue policy are admitted DATA. */
export async function installDriftwoodAudio(ctx:ShardContext):Promise<void> {
  const shell=ctx.game.runtime;if(shell?.world===undefined||shell.world===null||shell.play===null)throw new Error('Audio requires a play host');
  const {game,sky,player}=shell.world,{audio,music}=shell.play,built=driftwoodWorld(shell);
  installRuntimeAudioEntry(ctx,'play',{audio,music});
  const floor=(owner:{floorHeightAt:(x:number,z:number)=>number|undefined}|null):{floorHeightAt:(x:number,z:number)=>number|undefined}|null=>owner===null?null:{floorHeightAt:owner.floorHeightAt.bind(owner)};
  const wreck=built.wreck===null?null:{holdBounds:built.wreck.holdBounds,floorHeightAt:built.wreck.floorHeightAt.bind(built.wreck)};
  const shrine=built.shrine===null?null:{floorHeightAt:built.shrine.floorHeightAt.bind(built.shrine),setDusk:built.shrine.setDusk.bind(built.shrine),group:{position:built.shrine.group.position}};
  const world={pier:floor(built.pier),jetties:built.jetties.map(floor),boat:floor(built.boat),hut:floor(built.hut),lookout:floor(built.lookout),bridge:floor(built.bridge),wreck,shrine,palmSpecs:built.palmSpecs};
  await installRuntimeGameplayAudio(ctx,{audio,music,camera:game.camera,listener:player,objects:shell.objects,owners:{sky,world,cove:ctx.product.section('custom/fixedLayouts',SECTIONS).cove.spec,wind:windUniforms}});
}
