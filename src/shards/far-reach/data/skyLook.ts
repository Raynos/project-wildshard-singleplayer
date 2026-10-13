/**
 * Sky Reach's painted light (review 2026-10-01 item 1; the engine's `painterLight`): the golden-hour key stays low and
 * behind the islands (the mockup's mood), and three painter's terms keep the camera-facing sides from going black: a warm
 * bounce from the anti-sun side, a sun-coloured rim (island lips, the windmill, the pines, creatures, the fan) and a warm
 * plum shade floor (the review's p10 L* ≥ 25). The sun never moves here (no day cycle), so its direction is baked in.
 */
export const SKY_PAINTER_LIGHT = {
  // E399 round 2 (seat C: 'front-lit, a strong warm fill from behind the camera'): less fill, more rim, warmer shade
  bounce: [0.32, 0.21, 0.15],
  bounceLift: 0.55,
  rim: [2.6, 1.7, 0.85],
  // (round 7: the middle band's shade lifted here rather than by a global gamma, which flattened the unlit meadow)
  floor: [0.56, 0.44, 0.4],
  prefix: 'far', optOut: 'FAR_NO_PAINT',
} as const;

/** The fixed sun, toward the light (look/sun.ts `SUN_DIR`: the panorama's sun at heading 352.16°, elevation 6.01°). */
export const SKY_SUN = [-0.13565746816854515, 0.10470203849028618, -0.9852078635831522] as const;
const [sunX, , sunZ] = SKY_SUN, bounceLength = Math.hypot(sunX, SKY_PAINTER_LIGHT.bounceLift, sunZ);
/**
 * The painted light as an SF59 lighting stage (the same three terms as the engine's `painterLightGlsl`, which reaches only
 * classic materials): a graph spreads `nodes` into its own and takes `lighting` as its stage. The sun is the physical
 * Lambert diffuse with its specular kept; the ambient is the irradiance plus the warm bounce wrapped round the anti-sun
 * side, floored at the plum shade, plus the sun-coloured rim (strongest looking into the sun, on the sides).
 */
export const SKY_PAINTER_GRAPH = {
  nodes: {
    plAlb: { op: 'albedo' }, plN: { op: 'normalView' }, plL: { op: 'sunDirection' }, plNL: { op: 'dot', in: ['plN', 'plL'] }, plNLs: { op: 'saturate', in: ['plNL'] },
    plC: { op: 'sunColour' }, plSh: { op: 'sunShadow' }, plS0: { op: 'mul', in: ['plAlb', 'plC'] }, plS1: { op: 'mul', in: ['plS0', 'plNLs'] }, plS2: { op: 'mul', in: ['plS1', 'plSh'] },
    plSun: { op: 'mul', in: ['plS2', 1 / Math.PI] },
    plW: { op: 'viewToWorld', in: ['plN'] }, plP: { op: 'positionWorld' }, plE: { op: 'cameraPosition' }, plV0: { op: 'sub', in: ['plE', 'plP'] }, plV: { op: 'normalize', in: ['plV0'] },
    plNV0: { op: 'dot', in: ['plW', 'plV'] }, plNV: { op: 'saturate', in: ['plNV0'] }, plBk0: { op: 'dot', in: ['plV', [-sunX, -SKY_SUN[1], -sunZ]] }, plBk: { op: 'saturate', in: ['plBk0'] },
    plUy: { op: 'swizzle', in: ['plW'], mask: 'y' }, plUa: { op: 'abs', in: ['plUy'] }, plSide: { op: 'oneMinus', in: ['plUa'] },
    plR0: { op: 'oneMinus', in: ['plNV'] }, plR1: { op: 'pow', in: ['plR0', 3] }, plBk2: { op: 'mul', in: ['plBk', 'plBk'] }, plR3: { op: 'mix', in: [0.2, 1, 'plBk2'] },
    plR5: { op: 'mix', in: [0.3, 1, 'plSide'] }, plR6: { op: 'mul', in: ['plR1', 'plR3'] }, plRim: { op: 'mul', in: ['plR6', 'plR5'] },
    plWr0: { op: 'dot', in: ['plW', [-sunX / bounceLength, SKY_PAINTER_LIGHT.bounceLift / bounceLength, -sunZ / bounceLength]] }, plWr1: { op: 'add', in: ['plWr0', 0.45] }, plWr2: { op: 'div', in: ['plWr1', 1.45] }, plWrap: { op: 'saturate', in: ['plWr2'] },
    plIrr: { op: 'irradiance' }, plI0: { op: 'mul', in: ['plIrr', 'plAlb'] }, plI1: { op: 'mul', in: ['plI0', 1 / Math.PI] }, plB0: { op: 'mul', in: ['plAlb', SKY_PAINTER_LIGHT.bounce] }, plB1: { op: 'mul', in: ['plB0', 'plWrap'] },
    plI2: { op: 'add', in: ['plI1', 'plB1'] }, plF: { op: 'mul', in: ['plAlb', SKY_PAINTER_LIGHT.floor] }, plI3: { op: 'max', in: ['plI2', 'plF'] },
    plRc: { op: 'mul', in: ['plAlb', SKY_PAINTER_LIGHT.rim] }, plRl: { op: 'mul', in: ['plRc', 'plRim'] }, plAmb: { op: 'add', in: ['plI3', 'plRl'] },
  },
  lighting: { sun: 'plSun', sunSpecular: 1, ambient: 'plAmb' },
} as const;

/**
 * Sky Reach's haze (the engine's `headingHaze`): the painted horizon's colour in the direction you look (gold toward the
 * sun, rose-lavender away), from the panorama's haze strip (look/panoramaData.ts) warmed to gold (E392: the targets sink
 * far islands into warm gold); E399 (the council: 'no golden haze toward the sun'): the air toward the low sun goes only
 * a little gold over distance. Its near / far / max are look/sun.ts `FOG`.
 */
export const SKY_HAZE = { tint: [1.04, 0.98, 0.84], sunHaze: 0.12, name: 'far.rose-fog', prefix: 'far' } as const;
