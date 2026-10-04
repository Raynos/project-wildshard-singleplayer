/**
 * Creatures on the species rigs as models (E306 / E315 M5). A species (src/engine/entities/species/<kind>.ts,
 * `registerSpecies`) is the rig — bones, gaits, AI, variants — and the AnimalFactory builds it in the shard's style
 * (Driftwood's faceted low-poly, Pine Hollow's fur or its generated hulls, Nalati's painterly hulls). `creature(kind)` is
 * the model's fields for one species, so every shard's creature is a plain `defineModel` with its own id, file and
 * pipeline:
 *
 *   export const crab = defineModel<CreatureParams>({ id: 'driftwood-isle/crab', file: FILE, pipeline: 'code', ...creature('crab') });
 *
 * Its variants are the species' coats (and its spawn-by-name ones), its rig names the species (the Explorer stands it up
 * as an Animal and plays the gaits), its `build` is one rig from the shard's factory — `creatureFactory(ctx)`, which the
 * shard seeds in its creature style before it lists its roster. The copies are the AnimalManager's, never placed: the
 * shard lists them (`listRoster`, ./live.ts) with the count alive of their species.
 */
import { AnimalFactory, type AnimalStyle } from '../entities/AnimalFactory';
import { speciesDef } from '../entities/species/registry';
import type { SkyRig as Sky } from '../world/skyRig';
import type { ModelCategory } from '../world/registry';
import { modelContext, type ModelContext, type ModelDef } from './model';
import type { Renderer } from '../render/renderer';

/** a creature model's params: the species variant its rig is built for */
export interface CreatureParams { readonly variant: string }

/** the clips a species rig plays on the Explorer's turntable (Animal.ts gaits and reactions) */
export const CREATURE_CLIPS: readonly string[] = ['idle', 'walk', 'trot', 'charge', 'hit', 'die'];

const FACTORY = 'creatures:factory';

/** the shard's AnimalFactory in its creature style: seeded by `creatureContext`, else a pbr one on the context's sky */
export function creatureFactory(ctx: ModelContext): AnimalFactory {
  return ctx.once(FACTORY, () => new AnimalFactory(ctx.sky));
}

/** a model context whose creatures are built in the shard's style (the factory made on first build, not before) */
export function creatureContext(sky: Sky, style: AnimalStyle, renderer: Renderer | null = null): ModelContext {
  const ctx = modelContext(sky, renderer);
  let made: AnimalFactory | null = null;
  const once = ctx.once;
  return { get sky(): Sky { return ctx.sky; }, renderer: ctx.renderer, once: <T>(key: string, make: () => T): T => (key === FACTORY ? (made ??= new AnimalFactory(sky, { style })) as T : once(key, make)) };
}

/** The fields of the model of one species (all but its id, file and pipeline). */
export function creature(kind: string, o: { name?: string; category?: ModelCategory; spawnOnly?: boolean } = {}): Omit<ModelDef<CreatureParams>, 'id' | 'file' | 'pipeline'> {
  const sp = speciesDef(kind);
  const coats = [...sp.variants, ...(o.spawnOnly === true ? sp.spawnOnly ?? [] : [])];
  return {
    name: o.name ?? sp.label, category: o.category ?? 'creatures', surface: 'flesh',
    defaults: { variant: coats[0]?.id ?? '' },
    variants: coats.map((v) => ({ id: v.id, label: v.label, params: { variant: v.id } })),
    rig: { clips: CREATURE_CLIPS, species: kind },
    build: (ctx, p) => {
      const f = creatureFactory(ctx);
      return f.instantiate(f.model(kind, p.variant), 0.5).mesh;
    },
  };
}
