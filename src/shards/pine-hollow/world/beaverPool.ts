/** Pine owns its per-frame pool lowering and wet-bed presentation. */
import * as THREE from 'three';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import type { PineWaterSurface } from './poolSurface';
import { drawPineWater, pineWaterSurface, setWaterFade } from './water';
import LAYOUT from '../data/layout.generated.json' with { type: 'json' };
import { loadSiteTimbers } from '../runtime/world/timberSites';
import { pineModels } from '../runtime/world/context';
import authored from '../data/timberWorld.generated.json' with { type: 'json' };

export class BeaverPool {
  readonly group = new THREE.Group();
  private surface: PineWaterSurface | undefined;
  private flow: THREE.Mesh | undefined;
  constructor(private readonly sky: Sky) {}
  async build(): Promise<this> {
    const views = await loadSiteTimbers(pineModels(this.sky));
    const still = views.get('pine-pool-still'), trickle = views.get('pine-pool-trickle');
    if (still === undefined || trickle === undefined) throw new Error('[pool] admitted water draws missing');
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
    setWaterFade('trickle', surface.reveal); this.trickle.visible = surface.reveal > 0.001;
  }
}
