/**
 * Built-in graph presets (SHARD-PLATFORM SF59 step 3): today's hand-written families re-expressed as graph IR
 * (`graph/ir.ts`), so a graph and its family can be held to pixel parity on the bench (`scripts/tsl-spike/`, the `graph`
 * variants). The families stay the shipped path: no material in the game is built from a preset yet, and nothing on the
 * default render path imports this module.
 *
 * The first preset is the PBR family with SF56's measure layer (`families/measure.ts`): the role colours, the 1 m grid
 * and sub-grid (each line at least a pixel wide, faded by coverage) and the role colour's glow. **Not yet in the preset:
 * the size-label glyphs** ("4×3" on a face of at least 1 m × 1 m); they need the IR's integer and constant-loop glyph
 * maths, so a labelled face does not hold parity until they are added. Pure data: no three.js.
 */
import { MEASURE_SLOT, type MeasureLayerParams, type PbrMaterialParams } from '../families/params';
import { GRAPH_IR_VERSION, type GraphIr, type GraphNode, type GraphRef } from './ir';

/**
 * The coverage of lines every `pitch` metres across `c` (the measure layer's `famMGrid`): nodes named `<p>…`, the
 * result in `<p>out`.
 */
function gridNodes(p: string, c: GraphRef, pitch: GraphRef, hw: GraphRef): Record<string, GraphNode> {
  return {
    [`${p}fwc`]: { op: 'fwidth', in: [c] },
    [`${p}fw`]: { op: 'max', in: [`${p}fwc`, [1e-5, 1e-5]] },
    [`${p}cp`]: { op: 'div', in: [c, pitch] },
    [`${p}fr`]: { op: 'fract', in: [`${p}cph`] },
    [`${p}cph`]: { op: 'add', in: [`${p}cp`, 0.5] },
    [`${p}dc`]: { op: 'sub', in: [`${p}fr`, 0.5] },
    [`${p}da`]: { op: 'abs', in: [`${p}dc`] },
    [`${p}d`]: { op: 'mul', in: [`${p}da`, pitch] },
    [`${p}fw75`]: { op: 'mul', in: [`${p}fw`, 0.75] },
    [`${p}w`]: { op: 'max', in: [`${p}fw75`, hw] },
    [`${p}hf`]: { op: 'mul', in: [`${p}fw`, 0.5] },
    [`${p}lo`]: { op: 'sub', in: [`${p}w`, `${p}hf`] },
    [`${p}hi`]: { op: 'add', in: [`${p}w`, `${p}hf`] },
    [`${p}edge`]: { op: 'smoothstep', in: [`${p}lo`, `${p}hi`, `${p}d`] },
    [`${p}core`]: { op: 'oneMinus', in: [`${p}edge`] },
    [`${p}thin`]: { op: 'div', in: [hw, `${p}w`] },
    [`${p}thin16`]: { op: 'mul', in: [`${p}thin`, 1.6] },
    [`${p}dim`]: { op: 'min', in: [`${p}thin16`, 1] },
    [`${p}l0`]: { op: 'mul', in: [`${p}core`, `${p}dim`] },
    [`${p}f0`]: { op: 'mul', in: [pitch, 0.12] },
    [`${p}f1`]: { op: 'mul', in: [pitch, 0.35] },
    [`${p}fs`]: { op: 'smoothstep', in: [`${p}f0`, `${p}f1`, `${p}fw`] },
    [`${p}fade`]: { op: 'oneMinus', in: [`${p}fs`] },
    [`${p}l`]: { op: 'mul', in: [`${p}l0`, `${p}fade`] },
    [`${p}lx`]: { op: 'swizzle', in: [`${p}l`], mask: 'x' },
    [`${p}ly`]: { op: 'swizzle', in: [`${p}l`], mask: 'y' },
    [`${p}out`]: { op: 'max', in: [`${p}lx`, `${p}ly`] },
  };
}

/**
 * The PBR family with a measure layer as a graph preset: the same uniforms the family's patch declares (as params), the
 * same decode of the first UV set (role, face metres) and the same mix order. `params` is a parsed PBR surface.
 */
export function pbrMeasureGraph(params: PbrMaterialParams, measure: MeasureLayerParams): GraphIr {
  const S = MEASURE_SLOT;
  return {
    version: GRAPH_IR_VERSION,
    kind: 'material',
    model: 'standard',
    doubleSided: params.doubleSided,
    params: {
      structure: { type: 'colour', value: measure.structure },
      trim: { type: 'colour', value: measure.trim },
      floor: { type: 'colour', value: measure.floor },
      line: { type: 'colour', value: measure.line.colour },
      lineWidth: { type: 'float', value: measure.line.width, min: 0, max: 0.1 },
      lineAlpha: { type: 'float', value: measure.line.alpha, min: 0, max: 1 },
      floorAlpha: { type: 'float', value: measure.line.floorAlpha, min: 0, max: 1 },
      subStep: { type: 'float', value: measure.sub.step, min: 0.01, max: 0.5 },
      subAlpha: { type: 'float', value: measure.sub.alpha, min: 0, max: 1 },
      lift: { type: 'float', value: measure.lift, min: 0, max: 1 },
      roughness: { type: 'float', value: params.roughness, min: 0, max: 1 },
      metalness: { type: 'float', value: params.metalness, min: 0, max: 1 },
    },
    nodes: {
      uv: { op: 'uv' },
      u: { op: 'swizzle', in: ['uv'], mask: 'x' },
      v: { op: 'swizzle', in: ['uv'], mask: 'y' },
      // the role and the face's own metres, packed in UV0 (params.ts measureUv)
      codeF: { op: 'div', in: ['u', S] },
      code: { op: 'floor', in: ['codeF'] },
      code4: { op: 'div', in: ['code', 4] },
      code4f: { op: 'floor', in: ['code4'] },
      code4m: { op: 'mul', in: ['code4f', 4] },
      role: { op: 'sub', in: ['code', 'code4m'] },
      isStructure: { op: 'eq', in: ['role', 1] },
      isTrim: { op: 'eq', in: ['role', 2] },
      hasRole: { op: 'or', in: ['isStructure', 'isTrim'] },
      codeS: { op: 'mul', in: ['code', S] },
      faceU: { op: 'sub', in: ['u', 'codeS'] },
      vF: { op: 'div', in: ['v', S] },
      vQ: { op: 'floor', in: ['vF'] },
      vQS: { op: 'mul', in: ['vQ', S] },
      faceV: { op: 'sub', in: ['v', 'vQS'] },
      face1: { op: 'combine', in: ['faceU', 'faceV'] },
      face: { op: 'sub', in: ['face1', 1] },
      // the floor: world metres on the plane the surface faces
      pos: { op: 'positionWorld' },
      nw: { op: 'normalWorld' },
      na: { op: 'abs', in: ['nw'] },
      nax: { op: 'swizzle', in: ['na'], mask: 'x' },
      nay: { op: 'swizzle', in: ['na'], mask: 'y' },
      naz: { op: 'swizzle', in: ['na'], mask: 'z' },
      naxz: { op: 'max', in: ['nax', 'naz'] },
      up: { op: 'gte', in: ['nay', 'naxz'] },
      side: { op: 'gte', in: ['nax', 'naz'] },
      pxz: { op: 'swizzle', in: ['pos'], mask: 'xz' },
      pzy: { op: 'swizzle', in: ['pos'], mask: 'zy' },
      pxy: { op: 'swizzle', in: ['pos'], mask: 'xy' },
      wall: { op: 'select', in: ['side', 'pzy', 'pxy'] },
      world: { op: 'select', in: ['up', 'pxz', 'wall'] },
      c: { op: 'select', in: ['hasRole', 'face', 'world'] },
      // the 1 m grid and the sub-grid
      lineWidth: { op: 'param', param: 'lineWidth' },
      subStep: { op: 'param', param: 'subStep' },
      fineW: { op: 'mul', in: ['lineWidth', 0.6] },
      ...gridNodes('g', 'c', 1, 'lineWidth'),
      ...gridNodes('s', 'c', 'subStep', 'fineW'),
      // the role colour, the lines over it, the glow
      structure: { op: 'param', param: 'structure' },
      trim: { op: 'param', param: 'trim' },
      floor: { op: 'param', param: 'floor' },
      line: { op: 'param', param: 'line' },
      baseRest: { op: 'select', in: ['isTrim', 'trim', 'floor'] },
      base: { op: 'select', in: ['isStructure', 'structure', 'baseRest'] },
      lineA: { op: 'select', in: ['hasRole', 'lineAlphaP', 'floorAlphaP'] },
      lineAlphaP: { op: 'param', param: 'lineAlpha' },
      floorAlphaP: { op: 'param', param: 'floorAlpha' },
      subAlpha: { op: 'param', param: 'subAlpha' },
      fineA: { op: 'mul', in: ['sout', 'subAlpha'] },
      mainA: { op: 'mul', in: ['gout', 'lineA'] },
      withFine: { op: 'mix', in: ['base', 'line', 'fineA'] },
      out: { op: 'mix', in: ['withFine', 'line', 'mainA'] },
      liftP: { op: 'param', param: 'lift' },
      glow: { op: 'mul', in: ['out', 'liftP'] },
      roughness: { op: 'param', param: 'roughness' },
      metalness: { op: 'param', param: 'metalness' },
    },
    stages: {
      surface: { colour: 'out', emissive: 'glow', roughness: 'roughness', metalness: 'metalness' },
    },
  };
}
