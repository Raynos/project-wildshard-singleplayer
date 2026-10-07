import type { EquipmentRow } from '@wildshard/engine/combat/Equipment';
import { SWAP_GLYPHS } from './starterGlyphs';

/** The base sword equipment row, retaining its legacy slot and cue IDs. */
export const SWORD: EquipmentRow = {
  cues: {"fire": "cue.sword.swing", "reload": "cue.reload", "impact": "cue.sword.hit"},
  "id": "weapon.sword",
  "legacySlot": "sword",
  "ui": {
    "swapIcon": SWAP_GLYPHS.sword,
    "name": "Sword",
    "icon": "sword",
    "touch": "melee",
    "lockOn": true,
    "melee": true,
    "tracers": false
  },
  "meta": {
    "name": "Sword",
    "icon": "sword",
    "blurb": "",
    "category": "weapon"
  }
};

/** The starter wooden sword equipment row and existing UI metadata. */
export const WOODEN_SWORD: EquipmentRow = {
  cues: {"fire": "cue.sword.swing", "reload": "cue.reload", "impact": "cue.sword.hit"},
  "id": "weapon.sword",
  "legacySlot": "sword",
  "ui": {
    "swapIcon": SWAP_GLYPHS.sword,
    "name": "Wooden sword",
    "icon": "sword",
    "touch": "melee",
    "lockOn": true,
    "melee": true,
    "tracers": false
  },
  "meta": {
    "name": "Wooden sword",
    "icon": "sword",
    "blurb": "",
    "category": "weapon"
  }
};

/** The upgraded iron sword equipment row and existing UI metadata. */
export const IRON_SWORD: EquipmentRow = {
  cues: {"fire": "cue.sword.swing", "reload": "cue.reload", "impact": "cue.sword.hit"},
  "id": "weapon.sword-iron",
  "legacySlot": "sword-iron",
  "ui": {
    "swapIcon": SWAP_GLYPHS.sword,
    "name": "Iron sword",
    "icon": "sword",
    "touch": "melee",
    "lockOn": true,
    "melee": true,
    "tracers": false
  },
  "meta": {
    "name": "Iron sword",
    "icon": "sword",
    "blurb": "",
    "category": "weapon"
  }
};
