// SHARD-PLATFORM M3 (look-family rows): Driftwood's streamed ground cover as data (world/GroundCover.ts builds it through
// runtime/looks/streamedCover.ts): its cells, reaches, caps, upload budget, slope reach and kinds, and the material graphs
// its plants wear (SHARD-PLATFORM W2 C2: the shardfile's `look.materials`, compiled by the hybrid runtime). The kinds'
// densities and tints stay code.
import type { GraphIr, GraphNode } from '@wildshard/format/materialGraph';
import type { StreamedCoverRow } from './lookRows';

/**
 * The cover's numbers. 16 m cells of 520 candidates, refilled every 4 m; the desktop reaches 1.25× further (E117) with
 * 3× the instance caps (the phone 1.8×); a plant grows over a quarter of its (far − near). The far set rebuilds every 8 m
 * with 16 m of slack within 1.5 ms (desktop 2 ms) a frame and grows in over 0.8 s where it lands somewhere new. E186: the
 * whole cover uploads at most 256 KB a frame and the near set starts 1 m early. E156 C: plants on sloping ground (slope
 * 0.01 ≈ 8° … 0.08 ≈ 23°) keep their reach × up to 1.7, fading out 5 … 14 m over the ground (Explore's height).
 *
 * The kinds (E43 the beach, E117 the far models of 3–8 triangles: the near model's silhouette from 25 m on, its flowers
 * as flat chips; for tufts only 60 % of them get one): tufts, ferns, hibiscus, daisies and pebbles on the grass, shells and
 * starfish on the sand, bushes along the sand → grass edge.
 */
export const GROUND_COVER: StreamedCoverRow = {
  cell: 16,
  refill: 4,
  candidates: 520,
  cacheMin: 96,
  reachK: { phone: 1, desktop: 1.25 },
  capK: { phone: 1.8, desktop: 3 },
  growShare: 0.25,
  farRefill: 8,
  farSlack: 16,
  farBudgetMs: { phone: 1.5, desktop: 2 },
  farIn: 0.8,
  eyeSlack: 2,
  uploadBytes: 262144,
  nearLag: 1,
  sink: 0.02,
  slopeReach: { up: 1.7, lo: 0.01, hi: 0.08, fadeFrom: 5, fadeTo: 14 },
  look: 'driftwood-cover',
  meshPrefix: 'ground-cover-',
  kinds: [
    { name: 'tuft', geometry: 'tuft', cap: 5200, reach: [14, 34], scale: [0.9, 1.5], far: { geometry: 'tuftFar', reach: [26, 60], cap: 16000, keep: 0.6 } },
    { name: 'fern', geometry: 'fern', cap: 1400, reach: [14, 34], scale: [0.7, 1.4], far: { geometry: 'fernFar', reach: [26, 60], cap: 4400, keep: 1 } },
    { name: 'hibiscus', geometry: 'hibiscus', cap: 900, reach: [14, 34], scale: [0.8, 1.3], far: { geometry: 'hibiscusFar', reach: [26, 64], cap: 3200, keep: 1 } },
    { name: 'daisy', geometry: 'daisy', cap: 800, reach: [9, 22], scale: [0.8, 1.4], far: { geometry: 'daisyFar', reach: [16, 40], cap: 1600, keep: 1 } },
    { name: 'pebble', geometry: 'pebble', cap: 400, reach: [9, 22], scale: [0.7, 1.5] },
    { name: 'shells', geometry: 'shells', cap: 1600, reach: [10, 26], scale: [1.3, 2.3] },
    { name: 'starfish', geometry: 'starfish', cap: 300, reach: [8, 20], scale: [1.1, 1.8] },
    { name: 'bush', geometry: 'bush', cap: 900, reach: [16, 38], scale: [0.8, 1.6], far: { geometry: 'bushFar', reach: [30, 76], cap: 4000, keep: 1 } },
  ],
};

/** the look.materials id a kind's near (`far` false) or far model wears */
export const coverLookId = (kind: string, far: boolean): string => `${GROUND_COVER.look}-${kind}${far ? '-far' : ''}`;

/**
 * The plants' graph, one program for every kind and tier (their numbers are params the cover sets): the toon family's
 * light model (the catalogue's live toon look, following the day clock), flat-shaded, double-sided, roughness 0.9, its
 * colour the vertex colours (× the instance tint).
 *
 * Each plant stands at its own edge by distance (E117), bent away from the player's legs (`player`), swaying in the wind.
 * Its edge in [near + grow, far] (`reach`, × the slope reach `rk`) comes from its yaw, read back from the instance's x
 * axis (the refill's h = yaw / 2π). `mode` 0: it takes on the ground's colour and is gone at its edge; 1: it swaps to its
 * far model there, same size (a plant past `keep` has none and goes like 0); 2: that far model, from the near edge to its
 * own far edge (`farReach`), where it takes on the ground's colour first; `farIn` grows a far set in where it lands
 * somewhere new. Nothing scales (E156: scaling read as the plants bouncing); a hidden plant collapses to its origin.
 * E156 A: the ground it fades into (`aGround`) wears the cover as the terrain draws it from here (`aCover` rgb + top,
 * `aNrm.w` its side: 1 − (1 − top)·(1 − side)^(√(1 − f²) / f) at facing f), and its normal turns up with it.
 */
function coverGraph(): GraphIr {
  const { up, lo, hi } = GROUND_COVER.slopeReach;
  const n: Record<string, GraphNode> = {
    io: { op: 'objectOrigin' }, axis4: { op: 'instanceTransform', in: [[1, 0, 0, 0]] }, axis: { op: 'swizzle', in: ['axis4'], mask: 'xyz' },
    axisX: { op: 'swizzle', in: ['axis'], mask: 'x' }, axisZ: { op: 'swizzle', in: ['axis'], mask: 'z' }, axisNz: { op: 'negate', in: ['axisZ'] },
    yaw: { op: 'atan', in: ['axisNz', 'axisX'] }, turns: { op: 'div', in: ['yaw', 6.2831853] }, turns1: { op: 'add', in: ['turns', 1] }, h: { op: 'fract', in: ['turns1'] },
    eye: { op: 'cameraPosition' }, toC: { op: 'sub', in: ['eye', 'io'] }, dc: { op: 'length', in: ['toC'] }, dcK: { op: 'max', in: ['dc', 0.001] }, toCn: { op: 'div', in: ['toC', 'dcK'] },
    nrm: { op: 'attribute', name: 'aNrm', type: 'vec4' }, nrmXyz: { op: 'swizzle', in: ['nrm'], mask: 'xyz' }, nrmY: { op: 'swizzle', in: ['nrm'], mask: 'y' }, side: { op: 'swizzle', in: ['nrm'], mask: 'w' },
    facingRaw: { op: 'dot', in: ['nrmXyz', 'toCn'] }, facing: { op: 'abs', in: ['facingRaw'] },
    // the slope reach (E156 C; GroundCover's reachMax: the same numbers)
    slope: { op: 'oneMinus', in: ['nrmY'] }, slopeK: { op: 'smoothstep', in: [lo, hi, 'slope'] }, reachUp: { op: 'param', param: 'reachUp' },
    rkA: { op: 'mul', in: ['reachUp', up - 1] }, rkB: { op: 'mul', in: ['rkA', 'slopeK'] }, rk: { op: 'add', in: ['rkB', 1] },
    reachP: { op: 'param', param: 'reach' }, reach: { op: 'mul', in: ['reachP', 'rk'] }, farP: { op: 'param', param: 'farReach' }, farR: { op: 'mul', in: ['farP', 'rk'] },
    rX: { op: 'swizzle', in: ['reach'], mask: 'x' }, rY: { op: 'swizzle', in: ['reach'], mask: 'y' }, rZ: { op: 'swizzle', in: ['reach'], mask: 'z' },
    rFrom: { op: 'add', in: ['rX', 'rZ'] }, edge: { op: 'mix', in: ['rFrom', 'rY', 'h'] },
    fX: { op: 'swizzle', in: ['farR'], mask: 'x' }, fY: { op: 'swizzle', in: ['farR'], mask: 'y' }, fZ: { op: 'swizzle', in: ['farR'], mask: 'z' },
    fFrom: { op: 'add', in: ['fX', 'fZ'] }, fEdge: { op: 'mix', in: ['fFrom', 'fY', 'h'] },
    // mode 2, the far model: shown from the near edge to its own; fading into the ground before it, or growing in
    pastNear: { op: 'step', in: ['edge', 'dc'] }, insideFar: { op: 'step', in: ['dc', 'fEdge'] }, visFar: { op: 'mul', in: ['pastNear', 'insideFar'] },
    fadeW: { op: 'mul', in: ['fZ', 2.5] }, fadeWK: { op: 'max', in: ['fadeW', 6] }, fadeFrom: { op: 'sub', in: ['fEdge', 'fadeWK'] }, fadeFar: { op: 'smoothstep', in: ['fadeFrom', 'fEdge', 'dc'] },
    farIn: { op: 'param', param: 'farIn' }, growing: { op: 'oneMinus', in: ['farIn'] }, groundFar: { op: 'max', in: ['fadeFar', 'growing'] },
    // modes 0 / 1, the near model: shown inside its edge; one that swaps keeps its colour, one that doesn't fades into the ground
    visNear: { op: 'step', in: ['dc', 'edge'] }, mode: { op: 'param', param: 'mode' }, keep: { op: 'param', param: 'keep' },
    hashed: { op: 'mul', in: ['h', 97.13] }, hashF: { op: 'fract', in: ['hashed'] }, kept: { op: 'lt', in: ['hashF', 'keep'] }, keepsAll: { op: 'gte', in: ['keep', 1] },
    hasFar: { op: 'or', in: ['keepsAll', 'kept'] }, handover: { op: 'gt', in: ['mode', 0.5] }, swaps: { op: 'and', in: ['handover', 'hasFar'] },
    fadeNear: { op: 'smoothstep', in: ['rX', 'edge', 'dc'] }, groundNear: { op: 'select', in: ['swaps', 0, 'fadeNear'] },
    isFar: { op: 'gt', in: ['mode', 1.5] }, vis: { op: 'select', in: ['isFar', 'visFar', 'visNear'] }, groundK: { op: 'select', in: ['isFar', 'groundFar', 'groundNear'] },
    // the ground it fades into, wearing the cover as the terrain draws it from here
    coverIn: { op: 'attribute', name: 'aCover', type: 'vec4' }, top: { op: 'swizzle', in: ['coverIn'], mask: 'w' }, coverRgb: { op: 'swizzle', in: ['coverIn'], mask: 'xyz' },
    f: { op: 'clamp', in: ['facing', 0.03, 1] }, f2: { op: 'mul', in: ['f', 'f'] }, sin2: { op: 'oneMinus', in: ['f2'] }, sinF: { op: 'pow', in: ['sin2', 0.5] }, slant: { op: 'div', in: ['sinF', 'f'] },
    bareTop: { op: 'oneMinus', in: ['top'] }, bareTopK: { op: 'max', in: ['bareTop', 0.001] }, bareSide: { op: 'oneMinus', in: ['side'] }, bareSideK: { op: 'max', in: ['bareSide', 0.001] },
    bareSeen: { op: 'pow', in: ['bareSideK', 'slant'] }, bare: { op: 'mul', in: ['bareTopK', 'bareSeen'] }, seen: { op: 'oneMinus', in: ['bare'] },
    groundIn: { op: 'attribute', name: 'aGround', type: 'vec3' }, groundCol: { op: 'mix', in: ['groundIn', 'coverRgb', 'seen'] },
    // the legs' push and the wind, by the vertex's height in the model
    geo: { op: 'positionGeometry' }, geoY: { op: 'swizzle', in: ['geo'], mask: 'y' }, hgt: { op: 'max', in: ['geoY', 0] },
    player: { op: 'param', param: 'player' }, ioXz: { op: 'swizzle', in: ['io'], mask: 'xz' }, playerXz: { op: 'swizzle', in: ['player'], mask: 'xz' },
    away: { op: 'sub', in: ['ioXz', 'playerXz'] }, awayL: { op: 'length', in: ['away'] }, dl: { op: 'max', in: ['awayL', 0.001] }, awayN: { op: 'div', in: ['away', 'dl'] },
    nearLegs: { op: 'smoothstep', in: [0.35, 1.5, 'dl'] }, legsK: { op: 'oneMinus', in: ['nearLegs'] }, legs: { op: 'mul', in: ['legsK', 1.1] }, push: { op: 'mul', in: ['awayN', 'legs'] },
    ioX: { op: 'swizzle', in: ['io'], mask: 'x' }, ioZ: { op: 'swizzle', in: ['io'], mask: 'z' }, phX: { op: 'mul', in: ['ioX', 0.31] }, phZ: { op: 'mul', in: ['ioZ', 0.23] }, ph: { op: 'add', in: ['phX', 'phZ'] },
    t: { op: 'windTime' }, gust: { op: 'windGust' },
    t17: { op: 'mul', in: ['t', 1.7] }, wa: { op: 'add', in: ['t17', 'ph'] }, swa: { op: 'sin', in: ['wa'] },
    t31: { op: 'mul', in: ['t', 3.1] }, ph17: { op: 'mul', in: ['ph', 1.7] }, wb: { op: 'add', in: ['t31', 'ph17'] }, swb: { op: 'sin', in: ['wb'] }, swbH: { op: 'mul', in: ['swb', 0.5] }, windX: { op: 'add', in: ['swa', 'swbH'] },
    t13: { op: 'mul', in: ['t', 1.3] }, wc: { op: 'add', in: ['t13', 'ph'] }, cwc: { op: 'cos', in: ['wc'] }, windZ: { op: 'mul', in: ['cwc', 0.6] },
    gustK: { op: 'mul', in: ['gust', 0.18] }, windK: { op: 'add', in: ['gustK', 0.05] }, wind2: { op: 'combine', in: ['windX', 'windZ'] }, wind: { op: 'mul', in: ['wind2', 'windK'] },
    sway: { op: 'add', in: ['push', 'wind'] }, off: { op: 'mul', in: ['sway', 'hgt'] }, offX: { op: 'swizzle', in: ['off'], mask: 'x' }, offZ: { op: 'swizzle', in: ['off'], mask: 'y' },
    // the drop as it bends, in the model's units: × the instance's scale (its x axis's length)
    offL: { op: 'length', in: ['off'] }, scale: { op: 'length', in: ['axis'] }, dropA: { op: 'mul', in: ['offL', -0.4] }, dropB: { op: 'mul', in: ['dropA', 'hgt'] }, drop: { op: 'mul', in: ['dropB', 'scale'] },
    bend: { op: 'combine', in: ['offX', 'drop', 'offZ'] }, local: { op: 'positionLocal' }, rel: { op: 'sub', in: ['local', 'io'] }, bent: { op: 'add', in: ['rel', 'bend'] },
    shown: { op: 'mul', in: ['bent', 'vis'] }, position: { op: 'add', in: ['io', 'shown'] },
    // the fragment: the vertex colours fading into the ground, the facet's normal turning up with them
    vGround: { op: 'varying', in: ['groundCol'] }, vFar: { op: 'varying', in: ['groundK'] }, paint: { op: 'vertexColour' }, colour: { op: 'mix', in: ['paint', 'vGround', 'vFar'] },
    at: { op: 'positionWorld' }, dx: { op: 'dFdx', in: ['at'] }, dy: { op: 'dFdy', in: ['at'] }, faceX: { op: 'cross', in: ['dx', 'dy'] }, faceN: { op: 'normalize', in: ['faceX'] },
    upN: { op: 'mix', in: ['faceN', [0, 1, 0], 'vFar'] }, normal: { op: 'normalize', in: ['upN'] },
  };
  return { version: 1, kind: 'material', model: 'toon', flatShading: true, doubleSided: true,
    params: {
      player: { type: 'vec3', value: [0, 0, 0] }, reachUp: { type: 'float', value: 1, min: 0, max: 1 }, farIn: { type: 'float', value: 1, min: 0, max: 1 },
      reach: { type: 'vec3', value: [1, 2, 0.25] }, farReach: { type: 'vec3', value: [0, 0, 1] }, mode: { type: 'float', value: 0, min: 0, max: 2 }, keep: { type: 'float', value: 1, min: 0, max: 1 },
    },
    nodes: n,
    stages: { 'vertex.position': { position: 'position' }, surface: { colour: 'colour', normal: 'normal', roughness: 0.9, metalness: 0 } } };
}

/** The plants' graphs by look.materials id: one per kind's near model and one per far model, all the same program. */
export const COVER_GRAPHS: Readonly<Record<string, GraphIr>> = Object.fromEntries(GROUND_COVER.kinds.flatMap((k) =>
  (k.far === undefined ? [false] : [false, true]).map((far) => [coverLookId(k.name, far), coverGraph()])));

/** every cover look id (the hybrid runtime compiles them) */
export const COVER_LOOKS: readonly string[] = Object.keys(COVER_GRAPHS);
