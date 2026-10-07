// SF59 step 6, G169: Jake's two art-style stress cases (art/grid/round-19-art-styles/board.jpg, B + C) as material graphs
// for the bench (spike.js variants graph-pastel, graph-ink). They are expressiveness cases for the graph format: no family
// exists to hold them to parity, so the bench checks they admit, compile, render without GL errors at the frame floor,
// and records the IR ops each needed (`opsOf`). A MEASUREMENT FIXTURE, NOT GAME CODE: nothing in src/ imports it.

const INV_PI = 1 / Math.PI;
const N = (op, ...ins) => (ins.length === 0 ? { op } : { op, in: ins });
const SW = (src, mask) => ({ op: 'swizzle', in: [src], mask });

/**
 * B, the pastel alien plain: candy gradients and a soft glow, no hard shadow. The albedo is a height gradient (rose at
 * the foot, peach at the top) broken by slow noise; the sun is a wrapped (half-Lambert) light through a two-colour
 * pastel ramp, shadow softened to a tint instead of dark; a wide soft rim in mint; the ambient a sky / ground pastel
 * gradient on the world normal; the grade lifts toward white and pulls saturation down.
 */
export function pastelGraph(nonce = 0) {
  return {
    version: 1, kind: 'material', model: 'standard',
    params: {
      foot: { type: 'colour', value: [0.98, 0.72, 0.82] }, top: { type: 'colour', value: [1, 0.88, 0.7] },
      warm: { type: 'colour', value: [1, 0.93, 0.86] }, cool: { type: 'colour', value: [0.72, 0.7, 0.98] },
      rim: { type: 'colour', value: [0.62, 1, 0.86] }, sky: { type: 'colour', value: [0.8, 0.78, 1] }, ground: { type: 'colour', value: [0.75, 0.95, 0.85] },
      rimStrength: { type: 'float', value: 0.45, min: 0, max: 2 }, shadowTint: { type: 'float', value: 0.55, min: 0, max: 1 },
      lift: { type: 'float', value: 0.18, min: 0, max: 1 }, saturation: { type: 'float', value: 0.8, min: 0, max: 2 },
    },
    nodes: {
      // the surface: a height gradient, a little slow noise so the plain is not flat
      wp: N('positionWorld'), wy: SW('wp', 'y'), h0: N('mul', 'wy', 0.3), h: N('saturate', 'h0'),
      wxz: SW('wp', 'xz'), nzp: N('mul', 'wxz', 0.08), nz: N('noise', 'nzp'), nzk: N('mul', 'nz', 0.15), hk0: N('add', 'h', 'nzk'), hk: N('saturate', 'hk0'),
      footP: { op: 'param', param: 'foot' }, topP: { op: 'param', param: 'top' }, base: N('mix', 'footP', 'topP', 'hk'),
      glow: { op: 'const', value: nonce },
      // the sun: half-Lambert through the pastel ramp, the cast shadow a cool tint, not a dark
      n: N('normalView'), l: N('sunDirection'), v: N('viewDirection'), c: N('sunColour'), sh: N('sunShadow'), alb: N('albedo'),
      ndl: N('dot', 'n', 'l'), wrap0: N('mul', 'ndl', 0.5), wrap1: N('add', 'wrap0', 0.5), wrap: N('mul', 'wrap1', 'wrap1'),
      stP: { op: 'param', param: 'shadowTint' }, shK0: N('oneMinus', 'sh'), shK1: N('mul', 'shK0', 'stP'), lightK: N('oneMinus', 'shK1'),
      rampK: N('mul', 'wrap', 'lightK'), warmP: { op: 'param', param: 'warm' }, coolP: { op: 'param', param: 'cool' }, ramp: N('mix', 'coolP', 'warmP', 'rampK'),
      d0: N('mul', 'alb', 'ramp'), d1: N('mul', 'd0', 'c'), d2: N('mul', 'd1', 'rampK'), diffuse: N('mul', 'd2', INV_PI),
      // a wide soft rim, strongest against the sun
      ndv: N('dot', 'n', 'v'), ndvS: N('saturate', 'ndv'), fr0: N('oneMinus', 'ndvS'), fr: N('smoothstep', 0.2, 1, 'fr0'),
      rimP: { op: 'param', param: 'rim' }, rsP: { op: 'param', param: 'rimStrength' }, r0: N('mul', 'rimP', 'fr'), r1: N('mul', 'r0', 'rsP'), r2: N('mul', 'r1', 'c'), rimC: N('mul', 'r2', 0.25),
      sun: N('add', 'diffuse', 'rimC'),
      // the ambient: a pastel sky / ground gradient on the world normal
      nw: N('normalWorld'), nwy: SW('nw', 'y'), sk0: N('mul', 'nwy', 0.5), sk: N('add', 'sk0', 0.5),
      skyP: { op: 'param', param: 'sky' }, groundP: { op: 'param', param: 'ground' }, hemi: N('mix', 'groundP', 'skyP', 'sk'),
      irr: N('irradiance'), a0: N('add', 'irr', 'hemi'), a1: N('mul', 'a0', 'alb'), ambient: N('mul', 'a1', INV_PI),
      // the grade: lift toward white, a softer saturation
      lc: N('litColour'), liftP: { op: 'param', param: 'lift' }, satP: { op: 'param', param: 'saturation' },
      lum: N('dot', 'lc', [0.2126, 0.7152, 0.0722]), sat: N('mix', 'lum', 'lc', 'satP'), lifted: N('mix', 'sat', [1, 1, 1], 'liftP'),
    },
    stages: {
      surface: { colour: 'base', roughness: 0.9, metalness: 0, emissive: 'glow' },
      lighting: { sun: 'sun', ambient: 'ambient', grade: 'lifted' },
    },
  };
}

/**
 * C, the ink / cel valley: hard cel bands and drawn lines. The sun is quantised to three bands on N·L × the shadow
 * ratio (floor of a scaled value, so the steps are exact); the shade band takes a flat ink-wash tint; ink lines come from
 * the silhouette (N·V under a threshold) and from each face's border in UV, drawn a constant width on screen with
 * `fwidth`; the grade posterises lightly and crushes the lines to ink. SF59 step 7: true outlines from the outline stage
 * (an inverted hull, back faces pushed out along the normal at a near-constant screen width, drawn in the ink colour).
 */
export function inkGraph(nonce = 0) {
  return {
    version: 1, kind: 'material', model: 'standard', flatShading: true,
    params: {
      paper: { type: 'colour', value: [0.93, 0.89, 0.78] }, wash: { type: 'colour', value: [0.42, 0.5, 0.62] },
      ink: { type: 'colour', value: [0.06, 0.05, 0.08] }, lineWidth: { type: 'float', value: 1.4, min: 0, max: 8 },
      outlineWidth: { type: 'float', value: 0.004, min: 0, max: 0.05 },
      silhouette: { type: 'float', value: 0.28, min: 0, max: 1 }, bands: { type: 'float', value: 3, min: 1, max: 8 },
    },
    nodes: {
      // the surface: paper albedo; the face-border ink (a constant screen width from fwidth on the face UV)
      paperP: { op: 'param', param: 'paper' }, uv: N('uv'), fw: N('fwidth', 'uv'), lwP: { op: 'param', param: 'lineWidth' }, w: N('mul', 'fw', 'lwP'),
      e0: N('smoothstep', [0, 0], 'w', 'uv'), uv1: N('oneMinus', 'uv'), e1: N('smoothstep', [0, 0], 'w', 'uv1'), e: N('min', 'e0', 'e1'),
      ex: SW('e', 'x'), ey: SW('e', 'y'), border: N('min', 'ex', 'ey'), line: N('oneMinus', 'border'),
      inkP: { op: 'param', param: 'ink' }, base: N('mix', 'paperP', 'inkP', 'line'),
      glow: { op: 'const', value: nonce },
      // the sun in hard bands: floor(N·L × shadow × bands) / bands
      n: N('normalView'), l: N('sunDirection'), v: N('viewDirection'), c: N('sunColour'), sh: N('sunShadow'), alb: N('albedo'),
      ndl: N('dot', 'n', 'l'), ndlS: N('saturate', 'ndl'), k0: N('mul', 'ndlS', 'sh'), bandsP: { op: 'param', param: 'bands' },
      k1: N('mul', 'k0', 'bandsP'), k2: N('add', 'k1', 0.5), k3: N('floor', 'k2'), cel: N('div', 'k3', 'bandsP'),
      washP: { op: 'param', param: 'wash' }, lit: N('gt', 'cel', 0.01), tone: N('select', 'lit', [1, 1, 1], 'washP'),
      d0: N('mul', 'alb', 'c'), d1: N('mul', 'd0', 'cel'), d2: N('mul', 'd1', 'tone'), diffuse: N('mul', 'd2', INV_PI),
      // the silhouette ink: N·V below the threshold draws black, whatever the light
      ndv: N('dot', 'n', 'v'), silP: { op: 'param', param: 'silhouette' }, rimLine: N('step', 'ndv', 'silP'),
      keep: N('oneMinus', 'rimLine'), sun: N('mul', 'diffuse', 'keep'),
      // the ambient: a flat wash, so the shade band is one tone
      irr: N('irradiance'), irrL: N('dot', 'irr', [0.333, 0.333, 0.333]), a0: N('mul', 'washP', 'irrL'), a1: N('mul', 'a0', 'alb'), a2: N('mul', 'a1', INV_PI), ambient: N('mul', 'a2', 'keep'),
      // the grade: a light posterise (8 levels a channel), the near-black crushed to the ink colour
      lc: N('litColour'), p0: N('mul', 'lc', 8), p1: N('floor', 'p0'), p2: N('div', 'p1', 8), post: N('mix', 'lc', 'p2', 0.5),
      pl: N('dot', 'post', [0.2126, 0.7152, 0.0722]), dark: N('smoothstep', 0.03, 0.01, 'pl'), graded: N('mix', 'post', 'inkP', 'dark'),
      // the outline (SF59 step 7): the inverted hull pushed out along the normal by a width that grows with the distance
      // to the camera, so the line keeps about the same width on screen (≈ 5 px at 2× here)
      oN: N('normalLocal'), oNn: N('normalize', 'oN'), oP: N('positionWorld'), oC: N('cameraPosition'), oV: N('sub', 'oP', 'oC'),
      oD: N('length', 'oV'), owP: { op: 'param', param: 'outlineWidth' }, oW: N('mul', 'oD', 'owP'), oOff: N('mul', 'oNn', 'oW'),
    },
    stages: {
      surface: { colour: 'base', roughness: 1, metalness: 0, emissive: 'glow' },
      lighting: { sun: 'sun', ambient: 'ambient', grade: 'graded' },
      outline: { offset: 'oOff', colour: 'inkP' },
    },
  };
}

/** the IR ops a graph uses (the record G169 asks for), sorted */
export function opsOf(graph) {
  const ops = new Set();
  const walk = (nodes) => { for (const n of Object.values(nodes)) { ops.add(n.op); if (n.body) walk(n.body.nodes); } };
  walk(graph.nodes);
  return [...ops].sort((a, b) => a.localeCompare(b));
}
