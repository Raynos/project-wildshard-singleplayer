import type { EquipmentRow } from '#engine';
import { SWAP_GLYPHS } from '#kit';

export const SABRE: EquipmentRow = {
  "id": "weapon.sabre",
  "legacySlot": "sabre",
  "ui": {
    "swapIcon": SWAP_GLYPHS.sabre,
    "name": "Sabre",
    "icon": "sword",
    "touch": "melee",
    "lockOn": true,
    "melee": true,
    "tracers": false,
    "swapName": "Sabre"
  },
  "meta": {
    "name": "Sabre",
    "icon": "sword",
    "blurb": "",
    "category": "weapon"
  }
};

export const SPEAR: EquipmentRow = {
  "id": "weapon.spear",
  "legacySlot": "spear",
  "ui": {
    "swapIcon": SWAP_GLYPHS.spear,
    "name": "Spear",
    "icon": "sword",
    "touch": "spear",
    "lockOn": true,
    "melee": true,
    "tracers": false,
    "ammo": {
      "label": "Javelins",
      "segments": 3
    },
    "swapName": "Spear"
  },
  "meta": {
    "name": "Spear",
    "icon": "sword",
    "blurb": "",
    "category": "weapon"
  }
};

export const BOW: EquipmentRow = {
  "id": "weapon.bow",
  "legacySlot": "bow",
  "ui": {
    "swapIcon": SWAP_GLYPHS.bow,
    "name": "Bow",
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
    "name": "Bow",
    "icon": "longbow",
    "blurb": "",
    "category": "weapon"
  }
};

export const AR15: EquipmentRow = {
  "id": "weapon.rifle",
  "legacySlot": "rifle",
  "ui": {
    "swapIcon": SWAP_GLYPHS.rifle,
    "name": "AR-15",
    "icon": "rifle",
    "touch": "ranged",
    "lockOn": false,
    "melee": false,
    "tracers": true,
    "ammo": {
      "label": "Rounds",
      "segments": 6
    }
  },
  "meta": {
    "name": "AR-15",
    "icon": "rifle",
    "blurb": "",
    "category": "weapon"
  }
};

