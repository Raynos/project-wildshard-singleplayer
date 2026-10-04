/**
 * The laundry line (E306 / E315 second pass): washing hung out over the Well — a sagging wire strung between a gallery's
 * posts with shirts and sheets pegged on (../world/props.ts `laundry`), the lower Well's shorter lines along a front
 * (../world/well-lower-life.ts `laundryLine`), and a bamboo pole out from a bare wall (`laundryPole`). Each copy is drawn
 * into its band's kit (one merged mesh a band, the neon spill baked in), its washing drawn from the band's random stream,
 * and recorded where it hangs (`hungLine`: at its first end, turned so its own +x runs to the other); build.ts registers
 * them there (`place` with `drawnInto`). A copy's params are its span and rise. Built here alone for the Model Explorer,
 * its washing from a stream of its own. (The facade kit's laundry poles are facade pieces: models/facade.ts.)
 */
import { Vector3 } from 'three';
import { Kit } from '../world/kit';
import { type LaundryKind, laundry } from '../world/props';
import { laundryLine as lowerLine, laundryPole } from '../world/well-lower-life';
import { ndLook, need } from '../world/modelLook';
import { Rng } from '@wildshard/engine/core/rng';
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
  build: (ctx, p) => {
    const geometry = ctx.once(`nds:laundry:${p.kind}:${p.span}:${p.rise}`, () => {
      const k = new Kit(), rng = new Rng(17);
      const a = new Vector3(0, 0, 0), b = new Vector3(p.span, p.rise, 0);
      if (p.kind === 'gallery') laundry(k, rng, a, b);
      else if (p.kind === 'lower') lowerLine(k, rng, a, b);
      else laundryPole(k, rng, a, b, new Vector3(1, 0, 0));
      return k.build();
    });
    return [{ geometry, material: need(ndLook(ctx).mat, 'the Jiehua program') }];
  },
});
