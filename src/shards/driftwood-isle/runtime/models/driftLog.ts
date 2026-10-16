/**
 * The drift log (E306 / E315 M1, second pass: a model on the contract, src/engine/models/model.ts): a sun-bleached beached log,
 * faceted and painted per facet by the one driftwood painter (src/shards/driftwood-isle/generators/driftLogs.ts, E149) — silver on top, brown
 * underneath, a crack now and then, dark end grain. Every code-built log on the island is one: the wreck's piles on the
 * cove beach (src/shards/driftwood-isle/world/Wreck.ts) and the dune line's logs (src/shards/driftwood-isle/world/GroundCover.ts).
 *
 * Its own space: the log lies along x through the origin, its underside on the ground. The world's logs are baked
 * offline into their own kits and placed `drawnInto` those meshes, so only a specimen ever draws one: the Explorer's
 * three variants are fixed-model templates (`drift-log-*`) loaded through the shard's geometry intake; a log of another
 * size scales its tone's template. The Blender cove's TRELLIS driftwood is a different model (src/shards/driftwood-isle/runtime/models/cove.ts).
 */
import { defineModel, type ModelContext, type ModelPart } from '@wildshard/engine/models/model';
import { lowPolyLookMaterial } from '@wildshard/engine/world/lowpolyKit';
import { DRIFT_LOG_GEOMETRY, loadFixedGeometry } from '../boot/fixedGeometry';

export interface DriftLogParams {
  /** length, metres */
  readonly len: number;
  /** radius at either end */
  readonly r0: number;
  readonly r1: number;
  /** body tone (0–2) */
  readonly tone: number;
}

/** each tone's baked template and the log it was baked at (generators/driftLogs.ts DRIFT_SPECIMENS) */
const TEMPLATES = [
  { kind: 'long', len: 4, r0: 0.26 }, { kind: 'short', len: 2.6, r0: 0.18 }, { kind: 'pale', len: 4, r0: 0.26 },
] as const;

function specimen(ctx: ModelContext, p: DriftLogParams): readonly ModelPart[] {
  const t = TEMPLATES[((Math.round(p.tone) % 3) + 3) % 3] ?? TEMPLATES[0], sx = p.len / t.len, sr = p.r0 / t.r0;
  return [{
    geometry: ctx.once(`driftwood-isle/drift-log:${t.kind}:${sx}:${sr}`, () => {
      const g = DRIFT_LOG_GEOMETRY[t.kind].copy();
      return sx === 1 && sr === 1 ? g : g.scale(sx, sr, sr);
    }),
    material: lowPolyLookMaterial(ctx.sky, 'still'), castShadow: true, receiveShadow: true,
  }];
}

export const driftLog = defineModel<DriftLogParams>({
  id: 'driftwood-isle/drift-log', name: 'Drift log', category: 'nature', pipeline: 'code',
  file: 'src/shards/driftwood-isle/runtime/models/driftLog.ts', surface: 'wood',
  prepare: loadFixedGeometry,
  defaults: { len: 4, r0: 0.26, r1: 0.19, tone: 0 },
  variants: [
    { id: 'long', label: 'Long', params: {} }, { id: 'short', label: 'Short', params: { len: 2.6, r0: 0.18, r1: 0.12, tone: 1 } },
    { id: 'pale', label: 'Pale', params: { tone: 2 } },
  ],
  build: (ctx, p) => specimen(ctx, p),
});
