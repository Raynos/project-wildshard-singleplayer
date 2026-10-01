import type { EquipmentRow } from '#engine';
import { SWAP_GLYPHS } from './ui';

export const SWORD: EquipmentRow = {
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

export const WOODEN_SWORD: EquipmentRow = {
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

export const IRON_SWORD: EquipmentRow = {
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

