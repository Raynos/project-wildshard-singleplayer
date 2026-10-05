import type { EquipmentRow, RangedFeelProfile } from '@wildshard/engine/combat/Equipment';

export const PINE_BOLT_HIT_STOP = { body: 0.035, head: 0.055, kill: 0.075 } as const;
export const PINE_RANGED_FEEL: RangedFeelProfile = {
  kick: { body: 0.35, head: 0.6, kill: 0.9, side: 0.6, killSide: 1.2 },
  trauma: { kill: 0.28, head: 0.15, killKinds: ['bear', 'elk', 'antler-king'], headKinds: ['antler-king'] },
};

export const CROSSBOW: EquipmentRow = {
  hitStop: PINE_BOLT_HIT_STOP, rangedFeel: PINE_RANGED_FEEL,
  cues: {"fire": "cue.crossbow.fire", "reload": "cue.reload", "impact": "cue.projectile.hit"},
  "id": "weapon.crossbow",
  "legacySlot": "crossbow",
  "ui": {
    "swapIcon": "<path d=\"M4 7c4 3 12 3 16 0M12 5v15M8 17h8\"/>",
    "name": "Crossbow",
    "icon": "crossbow",
    "touch": "ranged",
    "lockOn": false,
    "melee": false,
    "tracers": true,
    "ammo": {
      "label": "Bolts",
      "segments": 4,
      "bagLabel": "Iron bolts",
      "bagLabelFor": "Bolts"
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
  hitStop: PINE_BOLT_HIT_STOP, rangedFeel: PINE_RANGED_FEEL,
  cues: {"fire": "cue.longbow.loose", "reload": "cue.reload", "impact": "cue.projectile.hit", "charge": { "draw": "cue.longbow.draw" }},
  "id": "weapon.longbow",
  "legacySlot": "bow",
  "ui": {
    "swapIcon": "<path d=\"M6 3c7 3.5 7 14.5 0 18\"/><path d=\"M6 3v18\" stroke-width=\"0.9\"/><path d=\"M4 12h15M16.5 9.5 19 12l-2.5 2.5\"/>",
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
  hitStop: PINE_BOLT_HIT_STOP, rangedFeel: PINE_RANGED_FEEL,
  cues: {"fire": "cue.lever.fire", "reload": "cue.lever.reload", "impact": "cue.projectile.hit", "dry": "cue.lever.dry"},
  "id": "weapon.lever",
  "legacySlot": "rifle",
  "ui": {
    "swapIcon": "<path d=\"M3 13h14l3-2h1v3h-4l-2 2H9l-1 3H5l1-3H3z\"/>",
    "name": "Lever-action",
    "icon": "lever",
    "touch": "ranged",
    "lockOn": false,
    "melee": false,
    "tracers": true,
    "ammo": {
      "label": "Cartridges",
      "magazine": true,
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

declare module '@wildshard/engine/core/rng' { interface RngStreams { loot: true } }
