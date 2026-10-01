import type { Scope } from '../app/scope';
import type { EquipmentAction } from '../combat/Tool';
import { app } from '../app/runtime';

export interface EquipmentInput { bind: (action: EquipmentAction, run: () => void, scope: Scope) => void }
/** Equipment selection shares the device/action map and respects blocking contexts. */
export class EquipmentActionInput implements EquipmentInput {
  private readonly allowed: () => boolean;
  constructor(_scope: Scope, allowed: () => boolean) { this.allowed = allowed; }
  bind(action: EquipmentAction, run: () => void, scope: Scope): void { app.input.bind(action, run, scope, this.allowed); }
}
