import type { Scope } from '../../shared/app/scope';
import type { EquipmentAction } from '../../shared/combat/Tool';

export interface EquipmentInput { bind: (action: EquipmentAction, run: () => void, scope: Scope, allowed?: () => boolean) => void }
