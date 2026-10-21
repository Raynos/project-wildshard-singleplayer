import { sharedModelContext } from '@wildshard/engine/models/model';
import type { ShardProduct } from '@wildshard/game/shardfile/shardProduct';
import type { NativeView } from '../productSections.generated.d.ts';

/** One model context per sky, shared by the resident and its model views. */
export const pineModels = (...args: Parameters<typeof sharedModelContext>): ReturnType<typeof sharedModelContext> => sharedModelContext(...args);
let nativeView: NativeView | null = null;
/** Admission decodes and validates this section before the page hooks run. */
export function admitPineView(product: ShardProduct): void {
  nativeView = product.section<NativeView>('custom/nativeView');
}
export function pineView(): NativeView {
  if (nativeView === null) throw new Error('Pine native view rows are not admitted');
  return nativeView;
}
