import type { EquipmentRow } from '#game';
import { SWAP_GLYPHS } from '#kit';

export const JIAN: EquipmentRow = {
  cues: {"fire": "cue.sword.swing", "reload": "cue.reload", "impact": "cue.sword.hit"},
  "id": "weapon.jian",
  "legacySlot": "sword",
  "ui": {
    "swapIcon": SWAP_GLYPHS.sword,
    "name": "Neon Jian",
    "icon": "sword",
    "touch": "melee",
    "lockOn": true,
    "melee": true,
    "tracers": false
  },
  "meta": {
    "name": "Neon Jian",
    "icon": "sword",
    "blurb": "",
    "category": "weapon"
  }
};
