import { skyMapGraph } from './mapGraph';
import { SKY, SKY_SUN, type SkyGraph } from './skyLook';
import { SKY_ISLE_HD } from './skyIsles';

/**
 * The textured sky isles' looks (E399; SF59 `meshMap` graphs in the shardfile's `look.materials`, bound per model map by
 * world/looks.ts `skyMappedLook` in world/skyIsleHd.ts): the rock grey-brown with the turf kept green, the paint fed back as
 * a little light (`SKY_ISLE_HD.selfLight`), lit by the painted light; then, on the lit colour (the lighting stage's
 * `grade`), the low sun's turn of the masses and its gold rim, and the isles' own haze. A playable keel (`keel`) is all
 * rock and drops everything above its turf (its deck draws the top).
 */

/**
 * The aerial haze on the sky isles (E399 round 6, measured on mockup A's isle band, x 0.1-0.9, y 0.27-0.42: its darkest
 * isle rock is a hazed mauve, 107,81,77, where ours read dark brown, 75,58,38): toward the warm haze over `near`..`far` metres, at most `max`.
 */
export const SKY_ISLE_HAZE = { color: SKY.fog, near: 60, far: 320, max: 0.22 } as const;

/** An sRGB hex colour in linear space (the lit colour's space before the post chain). */
function linear(hex: number): number[] {
  return [16, 8, 0].map((shift) => { const v = ((hex >> shift) & 255) / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
}

/** A sky isle's look; `keel`: a playable island's keel, all rock, cut at its turf. */
function skyIsleGraph(keel: boolean): SkyGraph {
  const g = skyMapGraph({
    t: { op: 'mul', in: ['c', SKY_ISLE_HD.tint] }, l: { op: 'dot', in: ['t', [0.3, 0.59, 0.11]] },
    s0: { op: 'smoothstep', in: [0.15, 0.6, 'l'] }, s1: { op: 'mul', in: ['s0', 0.35] }, s2: { op: 'add', in: ['s1', 0.75] }, s3: { op: 'mul', in: ['l', [1.02, 0.96, 0.88]] }, stone: { op: 'mul', in: ['s3', 's2'] },
    // (row 1, the lead: the canopies read olive-grey; the mockups' crowns are lush green lit warm by the low sun)
    tr: { op: 'swizzle', in: ['t'], mask: 'x' }, tg: { op: 'swizzle', in: ['t'], mask: 'y' }, tb: { op: 'swizzle', in: ['t'], mask: 'z' },
    rb: { op: 'max', in: ['tr', 'tb'] }, rb1: { op: 'mul', in: ['rb', 0.92] }, gx: { op: 'sub', in: ['tg', 'rb1'] }, turf: { op: 'smoothstep', in: [0.02, 0.12, 'gx'] },
    lf0: { op: 'mul', in: ['t', 1.35] }, lf1: { op: 'mul', in: ['l', 0.35] }, lf2: { op: 'sub', in: ['lf0', 'lf1'] }, lf3: { op: 'mul', in: ['lf2', [1.02 * 1.15, 1.12 * 1.15, 0.78 * 1.15]] },
    leaf: { op: 'saturate', in: ['lf3'] }, paint: { op: 'mix', in: ['stone', 'leaf', 'turf'] }, glow: { op: 'mul', in: ['c', SKY_ISLE_HD.selfLight] },
    // the low sun behind them catches their edges gold (round 9, the seats: 'pale flat mesas'; mockup A's crags are dark
    // masses with sunlit gold rims), strongest on the sun's side (round 10), a share on the rest (round 12); the masses
    // turned from the low sun fall into a soft shade, the faces toward it brighten (top-10 row 9: a lit volume, not a cut-out)
    gN: { op: 'normalView' }, gW: { op: 'viewToWorld', in: ['gN'] }, gS: { op: 'dot', in: ['gW', [...SKY_SUN]] }, gP: { op: 'positionWorld' }, gE: { op: 'cameraPosition' },
    gD: { op: 'sub', in: ['gE', 'gP'] }, gV: { op: 'normalize', in: ['gD'] }, gNV: { op: 'dot', in: ['gW', 'gV'] }, gNVa: { op: 'abs', in: ['gNV'] }, gR0: { op: 'oneMinus', in: ['gNVa'] },
    gR1: { op: 'pow', in: ['gR0', 3] }, gR2: { op: 'smoothstep', in: [-0.1, 0.5, 'gS'] }, gR3: { op: 'mul', in: ['gR2', 0.6] }, gR4: { op: 'add', in: ['gR3', 0.4] }, gRim: { op: 'mul', in: ['gR1', 'gR4'] },
    gT: { op: 'smoothstep', in: [-0.45, 0.65, 'gS'] }, gSh: { op: 'mix', in: [SKY_ISLE_HD.shade[0], SKY_ISLE_HD.shade[1], 'gT'] }, gSh1: { op: 'mul', in: ['gSh', 0.95] },
    gLit: { op: 'litColour' }, gC0: { op: 'mul', in: ['gLit', 'gSh1'] }, gC1: { op: 'mul', in: ['gRim', 0.55] }, gC2: { op: 'mul', in: ['gC1', [1, 0.7, 0.36]] }, gC3: { op: 'add', in: ['gC0', 'gC2'] },
    gH0: { op: 'length', in: ['gD'] }, gH1: { op: 'sub', in: ['gH0', SKY_ISLE_HAZE.near] }, gH2: { op: 'div', in: ['gH1', SKY_ISLE_HAZE.far - SKY_ISLE_HAZE.near] }, gH3: { op: 'saturate', in: ['gH2'] },
    gH4: { op: 'mul', in: ['gH3', SKY_ISLE_HAZE.max] }, grade: { op: 'mix', in: ['gC3', linear(SKY_ISLE_HAZE.color), 'gH4'] },
    ...(keel ? { kP: { op: 'positionGeometry' }, kY: { op: 'swizzle', in: ['kP'], mask: 'y' }, kV: { op: 'varying', in: ['kY'] }, cut: { op: 'gt', in: ['kV', 0.02] } } : {}),
  }, { colour: keel ? 'stone' : 'paint', emissive: 'glow', ...(keel ? { discard: 'cut' } : {}) });
  return { ...g, stages: { ...g.stages, lighting: { ...g.stages.lighting, grade: 'grade' } } };
}

/** The decorative sky isles' look (`look.materials['sky-isle']`). */
export const SKY_ISLE_GRAPH = skyIsleGraph(false);
/** The playable islands' keels' look (`look.materials['sky-isle-keel']`). */
export const SKY_ISLE_KEEL_GRAPH = skyIsleGraph(true);
