import { NativeInventory, nativeInventorySchema } from '@wildshard/game/inventoryLaw';
import { PINE_NATIVE_PACK } from '../data/questInventory';

/** Historical native continuation bounds; the page save remains caller-owned. */
export const PinePackSchema = nativeInventorySchema(PINE_NATIVE_PACK);
/** The authored native pack uses the same shared stacking and trade law. */
export const createPinePack = (): NativeInventory<(typeof PINE_NATIVE_PACK.kinds)[number]> => new NativeInventory(PINE_NATIVE_PACK);
/** The declared native inventory surface. */
export type PinePack = ReturnType<typeof createPinePack>;
