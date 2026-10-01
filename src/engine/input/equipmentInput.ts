import type { Scope } from '../app/scope';
import type { EquipmentAction } from '../combat/Tool';

export interface EquipmentInput { bind: (action: EquipmentAction, run: () => void, scope: Scope) => void }
const WHEEL_STEP = 60, WHEEL_GAP_MS = 180;
/** Legacy keyboard/wheel bindings, isolated from the service for the X1 input-service move. */
export class EquipmentDomInput implements EquipmentInput {
  private readonly actions = new Map<EquipmentAction, () => void>();
  private wheelAcc = 0; private wheelAt = 0;
  constructor(scope: Scope, allowed: () => boolean) {
    scope.listen(document, 'keydown', (event) => {
      if (!(event instanceof KeyboardEvent) || event.repeat || !allowed()) return;
      const digit = /^Digit([1-9])$/.exec(event.code)?.[1];
      if (digit !== undefined) this.actions.get(`swap.slot.${Number(digit) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}`)?.();
      else if (event.code === 'KeyQ') this.actions.get('swap')?.();
    });
    scope.listen(document, 'wheel', (event) => {
      if (!(event instanceof WheelEvent) || !allowed()) return;
      if (document.pointerLockElement === null && !(event.target instanceof HTMLCanvasElement)) return;
      if (Math.sign(event.deltaY) !== Math.sign(this.wheelAcc)) this.wheelAcc = 0;
      this.wheelAcc += event.deltaMode === 1 ? event.deltaY * 20 : event.deltaY;
      const now = event.timeStamp;
      if (Math.abs(this.wheelAcc) < WHEEL_STEP || now - this.wheelAt < WHEEL_GAP_MS) return;
      this.wheelAt = now;
      const action = this.wheelAcc > 0 ? 'swap.next' : 'swap.prev'; this.wheelAcc = 0;
      this.actions.get(action)?.();
    }, { passive: true });
  }
  bind(action: EquipmentAction, run: () => void, scope: Scope): void {
    this.actions.set(action, run);
    scope.onDispose(() => { if (this.actions.get(action) === run) this.actions.delete(action); });
  }
}
