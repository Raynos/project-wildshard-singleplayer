import { NativeInventory } from '@wildshard/game/inventoryLaw';
import { DRIFTWOOD_NATIVE_PACK } from '../data/questInventory';

/** The authored pack keeps its original constructor and saved continuation. */
export class DriftwoodPack extends NativeInventory<string> {
  constructor() { super(DRIFTWOOD_NATIVE_PACK); }
}
