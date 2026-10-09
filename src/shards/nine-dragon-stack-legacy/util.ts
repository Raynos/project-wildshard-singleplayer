// Nine Dragon Stack clean-room spawn (E169): seeded randomness and the palette of the Jiehua Neon style bible
// (docs/design/nine-dragon-stack/ART-STYLE-RESEARCH.md §5.1).

/** 墨分五色, the five ink tones */
export const INK = { scorched: 0x111214, thick: 0x2a2c31, heavy: 0x474a52, light: 0x7b7f88, clear: 0xb3b5b8 } as const;
/** silk: paper and fog */
export const SILK = { raw: 0xe8dfc9, aged: 0xd6c9a8, blueHour: 0x8e9bb5, pale: 0xbfc8d4, soot: 0x4b4a45 } as const;
/** 磁青 sutra paper */
export const SUTRA = { indigo: 0x1d2b4a, deep: 0x0e1a2c } as const;
export const METAL = { gold: 0xc9a24a, brightGold: 0xe8c46a, silver: 0xaab3c2, brass: 0xb48a3c } as const;
/** 青绿 mineral washes */
export const MIN = {
  azurite: 0x2e5fa3, lightAzurite: 0x6f9ccf, malachite: 0x2f8a6a, lightMalachite: 0x7fbf9a, cinnabar: 0xc23b22,
  ochre: 0x8a6a3a, gamboge: 0xd9a441, clamshell: 0xf2eee4, lacquer: 0x7e1e1a,
} as const;
/** emissive only */
export const NEON = { magenta: 0xff3fa4, cyan: 0x3fe6ff, jade: 0x33f0b0, red: 0xff3b30, amber: 0xffb347, violet: 0x9d6bff, jian: 0xd9fbff } as const;
/** the pale blue-grey flat washes of the towers (round-4 A: cool grey concrete under a silk sky) */
export const WALL = [0x8d96a3, 0x838c9b, 0x979b9e, 0x7f8794, 0x978d80, 0x8a9390, 0x9e9a92, 0x7a8391, 0x8f8478, 0xa0968a] as const;

/** the characters of a sign's text (all BMP hanzi) */
export const chars = (s: string): string[] => Array.from(s);

export const clamp = (x: number, a: number, b: number): number => (x < a ? a : x > b ? b : x);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
   // the one smoothstep (E357 X5)
