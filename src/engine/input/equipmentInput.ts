import type { Scope } from '../app/scope';
import type { EquipmentAction } from '../combat/Tool';

export interface EquipmentInput { bind: (action: EquipmentAction, run: () => void, scope: Scope, allowed?: () => boolean) => void }
