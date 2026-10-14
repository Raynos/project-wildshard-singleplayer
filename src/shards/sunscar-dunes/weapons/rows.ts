import type { EquipmentIcon } from '@wildshard/engine/combat/Equipment';

/** The declared item icons this runtime draws (its HUD has the sword glyph for the whip). */
export function whipIcon(name: string): EquipmentIcon {
  if (name !== 'sword') throw new Error(`Signal Dunes has no item icon ${name}`);
  return name;
}

