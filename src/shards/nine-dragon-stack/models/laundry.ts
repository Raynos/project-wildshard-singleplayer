/**
 * The laundry line (E306 / E315 second pass): washing hung out over the Well — a sagging wire strung between a gallery's
 * posts with shirts and sheets pegged on (../generators/props.ts `laundry`), the lower Well's shorter lines along a front
 * (../generators/wellParts.ts `laundryLine`), and a bamboo pole out from a bare wall (`laundryPole`). Each copy is drawn
 * into its band's kit (one merged mesh a band, the neon spill baked in), its washing drawn from the band's random stream,
 * and recorded where it hangs (`hungLine`: at its first end, turned so its own +x runs to the other); build.ts registers
 * them there (`place` with `drawnInto`). A copy's params are its span and rise. Built here alone for the Model Explorer,
 * its washing from a stream of its own. (The facade kit's laundry poles are facade pieces: models/facade.ts.)
 */
import type { LaundryKind } from '../world/specimenDims';
import { ndLook, need, specimen, withSpecimens } from '../world/modelLook';
import { defineModel, type ModelVariant } from '@wildshard/engine/models/model';

const FILE = 'src/shards/nine-dragon-stack/models/laundry.ts';

export interface LaundryParams {
  readonly kind: LaundryKind;
  /** metres, end to end across the ground */
  readonly span: number;
  /** metres the far end is above the near one */
  readonly rise: number;
}

const variant = (kind: LaundryKind, label: string, span: number, rise: number): ModelVariant<LaundryParams> => ({ id: kind, label, params: { kind, span, rise } });

export const laundryLineModel = defineModel<LaundryParams>({
  id: 'nine-dragon-stack/laundry-line', name: 'Laundry line', category: 'props', pipeline: 'code', file: FILE,
  defaults: { kind: 'gallery', span: 2.6, rise: -0.05 },
  variants: [variant('gallery', 'Between gallery posts', 2.6, -0.05), variant('lower', 'Along a lower-Well front', 2.4, -0.05), variant('pole', 'A pole out from the wall', 1.6, 0.05)],
  specimenYaw: Math.PI, // (the washing's faces look down +z, where the Explorer's camera looks from)
  // (G285: baked per variant, ../generators/specimens.ts; a copy in the world is drawn into its kit with its own span)
  build: (ctx, p) => withSpecimens(ctx, 'nine-dragon-stack/laundry-line', () => [{ geometry: specimen(ctx, `laundry:${p.kind}:${p.span}:${p.rise}`), material: need(ndLook(ctx).mat, 'the Jiehua program') }]),
});
