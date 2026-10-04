import type { IconId } from '@wildshard/engine';

export type { EquipmentRow } from '@wildshard/engine';

declare module '@wildshard/engine' {
  interface EquipmentSlotMap { crossbow: true; sword: true; rifle: true; 'sword-iron': true; bow: true; sabre: true; spear: true }
  // oxlint-disable-next-line typescript/no-empty-object-type, typescript/no-empty-interface -- This declaration merges the icon library vocabulary into the engine extension point.
  interface EquipmentIconMap extends Record<IconId, true> {}
  interface EquipmentTouchMap { throwing: true }
}
