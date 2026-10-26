// Pine weapon finishes: authored material overrides and legendary drop sources.
const IVORY = 0xe9dfc6, BONE = 0xd9cfb4, SILVER = 0xc9ced4, GHOST_CYAN = 0x8fe3ff, EMBER = 0xff5a12, BRASS = 0xf2b24c;

export const WEAPON_FINISHES: { readonly 'ghost-stag': { readonly id: "ghost-stag"; readonly weapon: "crossbow"; readonly name: "Ghost Stag"; readonly blurb: "bone-white ash, the stag's own antlers for a prod"; readonly dropsFrom: { readonly kind: "deer"; readonly variant: "ghost"; }; readonly mats: { readonly 'xbow-wood': { readonly color: 14274484; readonly roughness: 0.6; readonly envMapIntensity: 0.8; readonly emissive: 9430015; readonly emissiveIntensity: 0.03; readonly plain: true; }; readonly 'xbow-prod': { readonly color: 15327174; readonly metalness: 0; readonly roughness: 0.55; readonly envMapIntensity: 0.6; readonly plain: true; }; readonly 'xbow-iron': { readonly color: 13225684; readonly roughness: 0.55; readonly envMapIntensity: 1.1; }; readonly 'xbow-brass': { readonly color: 13225684; readonly roughness: 0.5; }; readonly 'xbow-leather': { readonly color: 14341060; readonly roughness: 0.9; }; readonly 'xbow-cord': { readonly color: 15268863; readonly emissive: 9430015; readonly emissiveIntensity: 0.9; }; }; }; readonly 'hollow-ash': { readonly id: "hollow-ash"; readonly weapon: "crossbow"; readonly name: "Hollow Ash"; readonly blurb: "charred ash, cold light in the cracks"; readonly mats: { readonly 'xbow-wood': { readonly color: 2763310; readonly roughness: 1; readonly emissive: 9430015; readonly emissiveIntensity: 0.08; }; readonly 'xbow-prod': { readonly color: 1842466; readonly roughness: 0.9; readonly envMapIntensity: 0.9; }; readonly 'xbow-iron': { readonly color: 1381914; readonly roughness: 0.8; }; readonly 'xbow-brass': { readonly color: 13225684; readonly roughness: 0.5; }; readonly 'xbow-leather': { readonly color: 2762019; }; readonly 'xbow-cord': { readonly color: 1710618; }; }; }; readonly ironhide: { readonly id: "ironhide"; readonly weapon: "rifle"; readonly name: "Ironhide"; readonly blurb: "scarred iron plates, a boar-tusk grip, still warm from the forge"; readonly dropsFrom: { readonly kind: "boar"; readonly variant: "ironhide"; }; readonly mats: { readonly 'rifle-alu': { readonly color: 5913902; readonly roughness: 1; readonly metalness: 1; readonly envMapIntensity: 0.9; readonly emissive: 16734738; readonly emissiveIntensity: 0.02; }; readonly 'rifle-poly': { readonly color: 15327174; readonly metalness: 0; readonly roughness: 0.55; readonly envMapIntensity: 0.7; readonly plain: true; }; readonly 'rifle-steel': { readonly color: 3811874; readonly roughness: 0.9; readonly emissive: 16734738; readonly emissiveIntensity: 0.1; }; readonly 'rifle-brass': { readonly color: 15905356; readonly roughness: 0.45; readonly envMapIntensity: 1.2; }; 
// Pine Hollow's lever-action (LeverRifle.ts) wears it too: iron-dark steel, a tusk-ivory stock, brass
readonly 'lever-steel': { readonly color: 5913902; readonly roughness: 1; readonly metalness: 1; readonly envMapIntensity: 0.9; readonly emissive: 16734738; readonly emissiveIntensity: 0.03; }; readonly 'lever-wood': { readonly color: 15327174; readonly roughness: 0.55; readonly envMapIntensity: 0.7; }; readonly 'lever-brass': { readonly color: 15905356; readonly roughness: 0.45; readonly envMapIntensity: 1.2; }; }; }; readonly blackpaw: { readonly id: "blackpaw"; readonly weapon: "crossbow"; readonly name: "Blackpaw"; readonly blurb: "bear-black stock, claw-hook nocks, the rent in arrears"; readonly mats: { readonly 'xbow-wood': { readonly color: 2761245; readonly roughness: 0.95; readonly envMapIntensity: 0.7; }; readonly 'xbow-prod': { readonly color: 1446671; readonly roughness: 0.8; }; readonly 'xbow-iron': { readonly color: 2828840; readonly roughness: 0.7; }; readonly 'xbow-brass': { readonly color: 9075300; readonly roughness: 0.6; }; readonly 'xbow-leather': { readonly color: 1906452; readonly roughness: 1; }; readonly 'xbow-cord': { readonly color: 3812900; }; }; }; readonly imperial: { readonly id: "imperial"; readonly weapon: "crossbow"; readonly name: "Imperial"; readonly blurb: "antler-ivory stock, gold fittings, seven tines on the prod"; readonly mats: { readonly 'xbow-wood': { readonly color: 15128760; readonly roughness: 0.55; readonly envMapIntensity: 0.8; }; readonly 'xbow-prod': { readonly color: 13612426; readonly roughness: 0.5; readonly envMapIntensity: 0.9; }; readonly 'xbow-iron': { readonly color: 15905356; readonly roughness: 0.35; readonly metalness: 1; readonly envMapIntensity: 1.3; }; readonly 'xbow-brass': { readonly color: 15905356; readonly roughness: 0.3; readonly envMapIntensity: 1.4; }; readonly 'xbow-leather': { readonly color: 5909276; readonly roughness: 0.8; }; readonly 'xbow-cord': { readonly color: 15917744; }; }; }; readonly warden: { readonly id: "warden"; readonly weapon: "crossbow"; readonly name: "Warden"; readonly blurb: "bark-bound limbs, amber in the grain, it hums at night"; readonly mats: { readonly 'xbow-wood': { readonly color: 3023898; readonly roughness: 1; readonly emissive: 16747050; readonly emissiveIntensity: 0.06; }; readonly 'xbow-prod': { readonly color: 3813154; readonly roughness: 0.9; }; readonly 'xbow-iron': { readonly color: 2038808; readonly roughness: 0.8; }; readonly 'xbow-brass': { readonly color: 16752704; readonly emissive: 16747050; readonly emissiveIntensity: 0.5; readonly roughness: 0.5; }; readonly 'xbow-leather': { readonly color: 3885602; readonly roughness: 1; }; readonly 'xbow-cord': { readonly color: 16760944; readonly emissive: 16751162; readonly emissiveIntensity: 0.9; }; }; }; readonly 'scarback-furnace': { readonly id: "scarback-furnace"; readonly weapon: "rifle"; readonly name: "Scarback Furnace"; readonly blurb: "forge-black steel, molten light through the vents"; readonly mats: { readonly 'rifle-alu': { readonly color: 789777; readonly roughness: 0.7; readonly metalness: 1; readonly envMapIntensity: 1.1; readonly emissive: 16734738; readonly emissiveIntensity: 0.12; }; readonly 'rifle-poly': { readonly color: 2825494; readonly metalness: 0; readonly roughness: 0.95; }; readonly 'rifle-steel': { readonly color: 1052948; readonly roughness: 0.6; readonly emissive: 16734738; readonly emissiveIntensity: 0.25; }; readonly 'rifle-brass': { readonly color: 15905356; readonly roughness: 0.35; readonly envMapIntensity: 1.3; }; readonly 'lever-steel': { readonly color: 789777; readonly roughness: 0.7; readonly metalness: 1; readonly envMapIntensity: 1.1; readonly emissive: 16734738; readonly emissiveIntensity: 0.16; }; readonly 'lever-wood': { readonly color: 2825494; readonly metalness: 0; readonly roughness: 0.95; }; readonly 'lever-brass': { readonly color: 15905356; readonly roughness: 0.35; readonly envMapIntensity: 1.3; }; }; }; } = {
  'ghost-stag': {
    id: 'ghost-stag', weapon: 'crossbow', name: 'Ghost Stag', blurb: 'bone-white ash, the stag\'s own antlers for a prod',
    dropsFrom: { kind: 'deer', variant: 'ghost' },
    mats: {
      'xbow-wood': { color: BONE, roughness: 0.6, envMapIntensity: 0.8, emissive: GHOST_CYAN, emissiveIntensity: 0.03, plain: true },
      'xbow-prod': { color: IVORY, metalness: 0, roughness: 0.55, envMapIntensity: 0.6, plain: true },
      'xbow-iron': { color: SILVER, roughness: 0.55, envMapIntensity: 1.1 },
      'xbow-brass': { color: SILVER, roughness: 0.5 },
      'xbow-leather': { color: 0xdad3c4, roughness: 0.9 },
      'xbow-cord': { color: 0xe8fbff, emissive: GHOST_CYAN, emissiveIntensity: 0.9 },
    },
  },
  'hollow-ash': {
    id: 'hollow-ash', weapon: 'crossbow', name: 'Hollow Ash', blurb: 'charred ash, cold light in the cracks',
    mats: {
      'xbow-wood': { color: 0x2a2a2e, roughness: 1, emissive: GHOST_CYAN, emissiveIntensity: 0.08 },
      'xbow-prod': { color: 0x1c1d22, roughness: 0.9, envMapIntensity: 0.9 },
      'xbow-iron': { color: 0x15161a, roughness: 0.8 },
      'xbow-brass': { color: SILVER, roughness: 0.5 },
      'xbow-leather': { color: 0x2a2523 },
      'xbow-cord': { color: 0x1a1a1a },
    },
  },
  'ironhide': {
    id: 'ironhide', weapon: 'rifle', name: 'Ironhide', blurb: 'scarred iron plates, a boar-tusk grip, still warm from the forge',
    dropsFrom: { kind: 'boar', variant: 'ironhide' },
    mats: {
      'rifle-alu': { color: 0x5a3d2e, roughness: 1, metalness: 1, envMapIntensity: 0.9, emissive: EMBER, emissiveIntensity: 0.02 },
      'rifle-poly': { color: IVORY, metalness: 0, roughness: 0.55, envMapIntensity: 0.7, plain: true },
      'rifle-steel': { color: 0x3a2a22, roughness: 0.9, emissive: EMBER, emissiveIntensity: 0.1 },
      'rifle-brass': { color: BRASS, roughness: 0.45, envMapIntensity: 1.2 },
      // Pine Hollow's lever-action (LeverRifle.ts) wears it too: iron-dark steel, a tusk-ivory stock, brass
      'lever-steel': { color: 0x5a3d2e, roughness: 1, metalness: 1, envMapIntensity: 0.9, emissive: EMBER, emissiveIntensity: 0.03 },
      'lever-wood': { color: IVORY, roughness: 0.55, envMapIntensity: 0.7 },
      'lever-brass': { color: BRASS, roughness: 0.45, envMapIntensity: 1.2 },
    },
  },
  'blackpaw': {
    id: 'blackpaw', weapon: 'crossbow', name: 'Blackpaw', blurb: 'bear-black stock, claw-hook nocks, the rent in arrears',
    mats: {
      'xbow-wood': { color: 0x2a221d, roughness: 0.95, envMapIntensity: 0.7 },
      'xbow-prod': { color: 0x16130f, roughness: 0.8 },
      'xbow-iron': { color: 0x2b2a28, roughness: 0.7 },
      'xbow-brass': { color: 0x8a7a64, roughness: 0.6 },
      'xbow-leather': { color: 0x1d1714, roughness: 1 },
      'xbow-cord': { color: 0x3a2e24 },
    },
  },
  'imperial': {
    id: 'imperial', weapon: 'crossbow', name: 'Imperial', blurb: 'antler-ivory stock, gold fittings, seven tines on the prod',
    mats: {
      'xbow-wood': { color: 0xe6d8b8, roughness: 0.55, envMapIntensity: 0.8 },
      'xbow-prod': { color: 0xcfb58a, roughness: 0.5, envMapIntensity: 0.9 },
      'xbow-iron': { color: BRASS, roughness: 0.35, metalness: 1, envMapIntensity: 1.3 },
      'xbow-brass': { color: BRASS, roughness: 0.3, envMapIntensity: 1.4 },
      'xbow-leather': { color: 0x5a2b1c, roughness: 0.8 },
      'xbow-cord': { color: 0xf2e2b0 },
    },
  },
  'warden': {
    id: 'warden', weapon: 'crossbow', name: 'Warden', blurb: 'bark-bound limbs, amber in the grain, it hums at night',
    mats: {
      'xbow-wood': { color: 0x2e241a, roughness: 1, emissive: 0xff8a2a, emissiveIntensity: 0.06 },
      'xbow-prod': { color: 0x3a2f22, roughness: 0.9 },
      'xbow-iron': { color: 0x1f1c18, roughness: 0.8 },
      'xbow-brass': { color: 0xffa040, emissive: 0xff8a2a, emissiveIntensity: 0.5, roughness: 0.5 },
      'xbow-leather': { color: 0x3b4a22, roughness: 1 },
      'xbow-cord': { color: 0xffc070, emissive: 0xff9a3a, emissiveIntensity: 0.9 },
    },
  },
  'scarback-furnace': {
    id: 'scarback-furnace', weapon: 'rifle', name: 'Scarback Furnace', blurb: 'forge-black steel, molten light through the vents',
    mats: {
      'rifle-alu': { color: 0x0c0d11, roughness: 0.7, metalness: 1, envMapIntensity: 1.1, emissive: EMBER, emissiveIntensity: 0.12 },
      'rifle-poly': { color: 0x2b1d16, metalness: 0, roughness: 0.95 },
      'rifle-steel': { color: 0x101114, roughness: 0.6, emissive: EMBER, emissiveIntensity: 0.25 },
      'rifle-brass': { color: BRASS, roughness: 0.35, envMapIntensity: 1.3 },
      'lever-steel': { color: 0x0c0d11, roughness: 0.7, metalness: 1, envMapIntensity: 1.1, emissive: EMBER, emissiveIntensity: 0.16 },
      'lever-wood': { color: 0x2b1d16, metalness: 0, roughness: 0.95 },
      'lever-brass': { color: BRASS, roughness: 0.35, envMapIntensity: 1.3 },
    },
  },
} as const;
