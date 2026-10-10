// The viewmodel's geometry builder is the SDK's class kit (@wildshard/sdk/kit/classKit, SHARD-PLATFORM M3, the kit
// system) over this shard's material classes (data/vmLook.ts CLS), under the names the viewmodel's pieces use.
import { CLASS_EDGE, ClassKit, type ClassLook, classCurve, v3 as classV3 } from '@wildshard/sdk/kit/classKit';
import { CLS } from '../data/vmLook';

/** how a viewmodel piece looks */
export type Look = ClassLook;
/** edge mask bits of the face rule */
export const E: typeof CLASS_EDGE = CLASS_EDGE;
/** Catmull-Rom through the points, `per` samples per span */
export const curve: typeof classCurve = classCurve;
/** a new Vector3 */
export const v3: typeof classV3 = classV3;

/** the viewmodel's builder: a raw mesh vertex without a class is brass, the glow class emits */
export class Geo extends ClassKit {
  constructor() { super({ fallback: CLS.brass, glow: CLS.glow }); }
}
