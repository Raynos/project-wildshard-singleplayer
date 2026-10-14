// Original homestead preparation settings; live building and material owners stay native.
export const CABIN_PBR = [
  { key: 'log', scan: 'wood_trunk_wall', color: [0.95, 0.9, 0.84], normal: [0.8, 0.8] },
  { key: 'roof', scan: 'wood_planks_grey', color: [0.46, 0.43, 0.39], normal: [1.3, 1.3] },
  { key: 'beam', scan: 'wood_planks_grey', color: [0.9, 0.86, 0.8], normal: [1, 1] },
  { key: 'deck', scan: 'wood_planks_dirt', color: [1, 1, 1], normal: [1, 1] },
  { key: 'door', scan: 'rough_pine_door', color: [0.72, 0.68, 0.62], normal: [1, 1] },
  { key: 'stone', scan: 'stone_wall', color: [0.58, 0.56, 0.53], normal: [1, 1] },
  { key: 'bark', scan: 'pine_bark', color: [0.85, 0.8, 0.75], normal: [1, 1] },
] as const;
export const CABIN_MATERIALS = {
  endGrain: { roughness: 0.95, metalness: 0, color: 0xb0a48e },
  chink: { color: 0x4d473f, roughness: 1, metalness: 0 },
  glass: { color: 0x0a0c0e, roughness: 0.08, metalness: 0, transparent: true, opacity: 0.66, envMapIntensity: 0.8, emissiveIntensity: 1.15, side: 2, depthWrite: false },
  iron: { color: 0x2b2724, roughness: 0.6, metalness: 0.75 },
  cloth: { color: 0xffffff, roughness: 0.95, metalness: 0, vertexColors: true },
  char: { color: 0x14100d, roughness: 0.95, metalness: 0, emissive: 0xff4a08, emissiveIntensity: 0.12 },
} as const;
export const CABIN_GLASS_EMISSIVE = [1, 0.5, 0.17] as const;
export const CABIN_LIGHT = { count: 2, color: 0xffa050, intensity: 0, distance: 10, decay: 2 } as const;
export const CABIN_MOSS_BINDINGS = [{ key: 'roof', strength: 1, upOnly: true }, { key: 'stone', strength: 0.6, upOnly: false }] as const;
