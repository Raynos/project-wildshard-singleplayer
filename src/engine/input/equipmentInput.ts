import type { Scope } from '../app/scope';
import type { EquipmentAction } from '../combat/Tool';

export interface EquipmentInput { bind: (action: EquipmentAction, run: () => void, scope: Scope, allowed?: () => boolean) => void }
/** Device action boundary supplied by a client session. */
export interface EquipmentBinding { bind: (action: EquipmentAction, run: () => void, scope: Scope, allowed: () => boolean) => void }
/** Equipment selection shares the device/action map and respects blocking contexts. */
export class EquipmentActionInput implements EquipmentInput {
  private readonly allowed: () => boolean;
  private readonly binding: EquipmentBinding;
  constructor(binding: EquipmentBinding, allowed: () => boolean) { this.binding = binding; this.allowed = allowed; }
  bind(action: EquipmentAction, run: () => void, scope: Scope, allowed?: () => boolean): void { this.binding.bind(action, run, scope, allowed ?? this.allowed); }
}
