import type { ShardContext } from '../plugin/context';
import { Grass } from '@wildshard/engine/world/Grass';
import { macrotask } from '@wildshard/engine/boot/plan';
import { Particles } from '../systems/looks/particles';
import { configureGrassFieldData } from '../systems/looks/grassField';

/** Client-only meadow assembly over the native population field rows. The
 * existing level grass driver and atmosphere own their rendering resources. */
export async function installPageMeadow(ctx:ShardContext,input:unknown):Promise<{grass:Grass;particles:Particles}>{
  const runtime=ctx.game.runtime,world=runtime?.world,step=runtime?.step;
  if(ctx.scope.disposed||runtime===undefined||world===null||world===undefined||step===null||step===undefined)throw new Error('Meadow requires its counted world owner');
  configureGrassFieldData(input,ctx.scope);
  const result=await step('grass',async()=>{
    const grass=new Grass(world.sky,world.forest).build();await macrotask();
    const particles=new Particles(world.sky,world.forest).build();
    world.game.scene.add(grass.group,particles.group);return {grass,particles};
  });
  runtime.overhead.push(result.grass.group,result.particles.group);
  runtime.hooks.worldUpdate=dt=>{result.grass.update(dt,runtime.viewer());result.particles.update(dt,runtime.viewer(),world.game.camera);};
  return result;
}
