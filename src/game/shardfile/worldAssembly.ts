import * as v from 'valibot';
import type { Scope } from '@wildshard/engine/app/scope';
import type { ModelContext } from '@wildshard/engine/models/model';
import type { ModelSite } from '@wildshard/engine/models/place';
import type { WorldRegistry } from '@wildshard/engine/world/registry';
import { WorldAssemblySchema, type WorldAssemblyStage } from '@wildshard/format/worldAssembly';
import { publishEntryOwner } from './entryOwners';
import type { SceneHandles } from './sceneHandles';

/** What an assembly builds against: the construction scope its loans belong to, the admitted scene handles, the shard's
 *  site catalogue (for `site` stages), the model context and registry sites register into, and the build's slice. */
export interface WorldAssemblyPorts {
  readonly scope: Scope;
  readonly scenes: SceneHandles;
  readonly sites?: { readonly site: (key: string, choice: string, ctx: ModelContext, registry: WorldRegistry | null) => ModelSite };
  readonly context: ModelContext;
  readonly registry: WorldRegistry | null;
  /** the build's time slice, after each stage (labelled progress) */
  readonly slice: (label: string) => Promise<void>;
}

/** G571: an admitted world assembly (format/worldAssembly), run stage by stage in its declared order. Client-only. */
export class WorldAssembly {
  private at = 0;
  private constructor(private readonly stages: readonly WorldAssemblyStage[], private readonly ports: WorldAssemblyPorts) {}
  static admit(input: unknown, ports: WorldAssemblyPorts): WorldAssembly { return new WorldAssembly(v.parse(WorldAssemblySchema, input).stages, ports); }

  /** Run the next declared stage, which must be `id` (the build keeps the declared order), and publish its loans. */
  async next(id: string): Promise<void> {
    const stage = this.stages[this.at];
    if (stage?.id !== id) throw new Error(`World assembly expected ${stage?.id ?? 'no stage'}, not ${id}`);
    this.at++;
    const { scope, scenes } = this.ports;
    if (stage.kind === 'place') {
      const placed = await scenes.place(stage.id);
      if (scope.disposed) throw new Error('World assembly owner left');
      publishEntryOwner(scope, 'object', stage.id, placed.object); publishEntryOwner(scope, 'placed', stage.id, [placed]);
      publishEntryOwner(scope, 'floor', stage.id, (x, z) => scenes.floorAt(stage.id, x, z));
    } else if (stage.kind === 'site') {
      const sites = this.ports.sites; if (sites === undefined) throw new Error('World assembly site needs its catalogue');
      const site = sites.site(stage.model, stage.choice, this.ports.context, this.ports.registry);
      publishEntryOwner(scope, 'object', stage.id, site.group); publishEntryOwner(scope, 'placed', stage.id, [site.placed]);
      publishEntryOwner(scope, 'site', stage.id, site.anchors); publishEntryOwner(scope, 'floor', stage.id, site.floorHeightAt);
    } else publishEntryOwner(scope, 'object', stage.id, stage.kind === 'mesh' ? scenes.mesh(stage.part) : scenes.group(stage.part));
    await this.ports.slice(stage.label);
  }

  /** Every declared stage ran. */
  get done(): boolean { return this.at === this.stages.length; }
}
