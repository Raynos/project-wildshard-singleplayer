import type { EquipmentRow } from '@wildshard/engine/combat/Equipment';
import { SWAP_GLYPHS } from '@wildshard/game/weapons/starterGlyphs';

export const SABRE: EquipmentRow = {
  cues: {"fire": "cue.sabre.swing", "reload": "cue.reload", "impact": "cue.sabre.hit"},
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
  cues: {"fire": "cue.spear.thrust", "reload": "cue.reload", "impact": "cue.javelin.hit"},
  "id": "weapon.spear",
  "legacySlot": "spear",
  "ui": {
    "swapIcon": SWAP_GLYPHS.spear,
    "name": "Spear",
    "icon": "sword",
    "touch": "throwing",
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
  cues: {"fire": "cue.bow.loose", "reload": "cue.reload", "impact": "cue.arrow.hit"},
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
  cues: {"fire": "cue.firearm.fire", "reload": "cue.firearm.reload", "impact": "cue.projectile.hit"},
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
      "magazine": true,
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
