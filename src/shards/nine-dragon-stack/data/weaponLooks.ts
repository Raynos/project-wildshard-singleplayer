/** Shared native material class ids and procedural hero surface rows. */
export const HERO_MATERIAL_CLASSES = { brass: 20, steel: 21, lacquer: 22, matte: 23, silk: 24, paper: 25, glow: 26, darkBrass: 27 } as const;

export const WEAPON_LOOKS = {
  brass: { wash: 0x9c7c3a, kind: HERO_MATERIAL_CLASSES.brass, line: 1 },
  darkBrass: { wash: 0x76592a, kind: HERO_MATERIAL_CLASSES.darkBrass, line: 1 },
  steel: { wash: 0x191c22, kind: HERO_MATERIAL_CLASSES.steel, line: 1 },
  bevel: { wash: 0x3a424e, kind: HERO_MATERIAL_CLASSES.steel, line: 1 },
  glow: { wash: 0xd9fbff, kind: HERO_MATERIAL_CLASSES.glow, emit: 4.2, line: 0 },
  lacquer: { wash: 0x121317, kind: HERO_MATERIAL_CLASSES.lacquer, col: 0.011, line: 1 },
  glove: { wash: 0x24252b, kind: HERO_MATERIAL_CLASSES.matte, line: 1 },
  leather: { wash: 0x1d1c20, kind: HERO_MATERIAL_CLASSES.matte, line: 1 },
  cloth: { wash: 0xe4ddcc, kind: HERO_MATERIAL_CLASSES.matte, row: 0.03, line: 1 },
  sleeve: { wash: 0x2a2d38, kind: HERO_MATERIAL_CLASSES.matte, row: 0.05, line: 1 },
  silk: { wash: 0xc22d1e, kind: HERO_MATERIAL_CLASSES.silk, line: 1 },
  silkDark: { wash: 0x8e1d14, kind: HERO_MATERIAL_CLASSES.silk, line: 1 },
  paper: { wash: 0xffffff, kind: HERO_MATERIAL_CLASSES.paper, line: 1 },
  eye: { wash: 0xff5a3a, kind: HERO_MATERIAL_CLASSES.glow, emit: 2.5, line: 0 },
  fang: { wash: 0xf2eee4, kind: HERO_MATERIAL_CLASSES.matte, line: 1 },
} as const;

