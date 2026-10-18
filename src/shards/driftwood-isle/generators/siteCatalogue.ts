import rocks from '../data/rockScenes.generated.json' with { type: 'json' };
import authored from '../data/siteCatalogue.json' with { type: 'json' };
import hut from '../data/hutBake.json' with { type: 'json' };
import lookout from '../data/lookoutBake.json' with { type: 'json' };
import shrine from '../data/shrineBake.json' with { type: 'json' };
import wreck from '../data/wreckSites.json' with { type: 'json' };

interface Layout {
  readonly origin: unknown;
  readonly colliders: readonly unknown[];
  readonly floors: readonly unknown[];
  readonly anchors: unknown;
  readonly descs: readonly unknown[];
  readonly site?: unknown;
}

/** Shared author facts for product admission and pre-admission Explorer metadata. */
export function siteCatalogue(): unknown {
  const layouts: Readonly<Record<string, Readonly<Record<string, Layout>>>> = { hut: { world: hut }, lookout: { world: lookout }, shrine };
  const wreckLayouts: Readonly<Record<string, unknown>> = wreck;
  const rows = structuredClone(authored);
  for (const model of rows.models) {
    if (model.key === 'shrine') Object.assign(model, { defaults: { site: shrine.specimen.site } });
    if (model.key === 'shipwreck') Object.assign(model, { defaults: { site: wreck.specimen } });
    for (const choice of model.choices) {
      const layout = layouts[model.key]?.[choice.id];
      if (layout !== undefined) {
        const { origin, colliders, floors, anchors } = layout;
        Object.assign(choice, { colliders: layout.descs, site: { origin, colliders, floors, anchors } });
        if (model.key === 'shrine') Object.assign(choice, { params: { site: layout.site } });
      } else if (model.key === 'shipwreck' && wreckLayouts[choice.id] !== undefined) Object.assign(choice, { params: { site: wreckLayouts[choice.id] } });
      else throw new Error(`Missing scene model layout: ${model.key}/${choice.id}`);
    }
  }
  return { ...rows, models: [...rows.models, ...rocks.catalogue] };
}
