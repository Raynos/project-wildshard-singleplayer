/** Pine owns its per-frame pool lowering and wet-bed presentation. */
import * as THREE from 'three';
import type { ShardContext } from '@wildshard/game/plugin/context';
import { installWorldScenes } from '@wildshard/game/shardfile/worldScenes';
import { residentWorldScope } from '@wildshard/game/shardfile/hybridPresentation';
import type { PineWaterSurface } from './poolSurface';
import { drawPineWater, pineWaterSurface, setWaterFade } from './water';
import LAYOUT from '../data/layout.generated.json' with { type: 'json' };
import { setLiveWaterLevel } from '@wildshard/engine/world/water/declared';
import authored from '../data/timberWorld.generated.json' with { type: 'json' };

export class BeaverPool {
  readonly group = new THREE.Group();
  private surface: PineWaterSurface | undefined;
  private flow: THREE.Mesh | undefined;
  /** the still surface and the dam trickle: the world scenes' published pool meshes (generators/worldScenes.ts `pool`) */
  async build(ctx: ShardContext): Promise<this> {
    const scenes = await installWorldScenes(ctx, ctx.product.section('world/scenes'), residentWorldScope(ctx));
    const still = scenes.mesh('pool.still'), trickle = scenes.mesh('pool.trickle');
    this.surface = drawPineWater('pool', still.geometry.clone(), authored.poolGround);
    this.flow = pineWaterSurface('trickle', trickle.geometry.clone());
    this.group.add(this.surface.mesh, this.flow); this.group.name = 'beaver-pool';
    this.publish(); return this;
  }
  get still(): THREE.Mesh { return this.ready().mesh; }
  get trickle(): THREE.Mesh { if (this.flow === undefined) throw new Error('Pool is not built'); return this.flow; }
  get level(): number { return this.ready().level; }
  setOpen(open: boolean, instant = false): void { this.ready().setLowered(open, instant); if (instant) this.publish(); }
  update(dt: number): void { this.ready().update(dt); this.publish(); }
  private ready(): PineWaterSurface { if (this.surface === undefined) throw new Error('Pool is not built'); return this.surface; }
  private publish(): void {
    const surface = this.ready(); LAYOUT.beaverPoolLevel.y = surface.level;
    setLiveWaterLevel('pine-hollow.beaver-pool', surface.level); // the declared creek's pool stretch (generators/bake-geography.mjs POOL_LEVEL)
    setWaterFade('trickle', surface.reveal); this.trickle.visible = surface.reveal > 0.001;
  }
}
