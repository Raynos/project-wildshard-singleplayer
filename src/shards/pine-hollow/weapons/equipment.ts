import type { EquipmentRow } from '#engine';
import { SWAP_GLYPHS } from '#kit';

export const CROSSBOW: EquipmentRow = {
  "id": "weapon.crossbow",
  "legacySlot": "crossbow",
  "ui": {
    "swapIcon": SWAP_GLYPHS.crossbow,
    "name": "Crossbow",
    "icon": "crossbow",
    "touch": "ranged",
    "lockOn": false,
    "melee": false,
    "tracers": true,
    "ammo": {
      "label": "Bolts",
      "segments": 4,
      "bagLabel": "Iron bolts"
    },
    "swapName": "Crossbow"
  },
  "meta": {
    "name": "Hunting crossbow",
    "icon": "crossbow",
    "blurb": "",
    "category": "weapon"
  }
};

export const LONGBOW: EquipmentRow = {
  "id": "weapon.longbow",
  "legacySlot": "bow",
  "ui": {
    "swapIcon": SWAP_GLYPHS.bow,
    "name": "Warden's longbow",
    "icon": "longbow",
    "touch": "bow",
    "lockOn": false,
    "melee": false,
    "tracers": false,
    "ammo": {
      "label": "Arrows",
      "segments": 4
    },
    "swapName": "Bow",
    "huntersEye": true
  },
  "meta": {
    "name": "Warden's longbow",
    "icon": "longbow",
    "blurb": "",
    "category": "weapon"
  }
};

export const LEVER: EquipmentRow = {
  "id": "weapon.lever",
  "legacySlot": "rifle",
  "ui": {
    "swapIcon": SWAP_GLYPHS.rifle,
    "name": "Lever-action",
    "icon": "lever",
    "touch": "ranged",
    "lockOn": false,
    "melee": false,
    "tracers": true,
    "ammo": {
      "label": "Cartridges",
      "segments": 7
    }
  },
  "meta": {
    "name": "Lever-action",
    "icon": "lever",
    "blurb": "",
    "category": "weapon"
  }
};

