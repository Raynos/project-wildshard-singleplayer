import { skyMapGraph } from '../look/mapGraph';

/**
 * The windmill's looks (SHARD-PLATFORM W1 C2: SF59 material graphs in the shardfile's `look.materials`, bound to the
 * tower's map and the painted canvas by world/looks.ts `skyMappedLook` in world/mill.ts): the modelled tower's paint pulled
 * toward a pale weathered whitewash with the painted stone's courses multiplied in, and the worn canvas of the sails
 * (frayed edges, a torn corner on two sails, the painted cloth's sun-bleached cream).
 */

/** The tower's whitewash and stone courses (the courses: the bump map's green, on the second UV set). */
export const MILL_TOWER_GRAPH = skyMapGraph({ l: { op: 'dot', in: ['c', [0.2126, 0.7152, 0.0722]] }, white: { op: 'mix', in: ['l', 'c', 0.2] },
  bump: { op: 'meshMap', name: 'bump' }, bg: { op: 'swizzle', in: ['bump'], mask: 'y' }, bg1: { op: 'mul', in: ['bg', 1.45] }, course: { op: 'mix', in: [1, 'bg1', 0.35] },
  colour: { op: 'mul', in: ['white', 'course'] } }, { colour: 'colour' });

/** A 0 … 1 noise node over `at` (the canvas's cloth coordinates scaled by `scale`, offset by its seed × `seed`). */
const cloth = (id: string, scale: readonly [number, number], seed: number): Record<string, { op: string; in: readonly (string | number | readonly number[])[] }> => ({
  [`${id}q`]: { op: 'mul', in: ['q', scale] }, [`${id}s`]: { op: 'mul', in: ['seed', seed] }, [`${id}p`]: { op: 'add', in: [`${id}q`, `${id}s`] },
  [`${id}r`]: { op: 'noise', in: [`${id}p`] }, [`${id}h`]: { op: 'mul', in: [`${id}r`, 0.5] }, [id]: { op: 'add', in: [`${id}h`, 0.5] } });

/** The canvas: frayed at its edges and torn (a ragged corner at the outer rail's hub end on two sails), the painted cloth toward the targets' sun-bleached cream, a faint warm glow through it. */
export const MILL_CANVAS_GRAPH = { ...skyMapGraph({ cl: { op: 'attribute', name: 'aFarCloth', type: 'vec3' }, q: { op: 'swizzle', in: ['cl'], mask: 'xy' }, seed: { op: 'swizzle', in: ['cl'], mask: 'z' },
  qx: { op: 'swizzle', in: ['q'], mask: 'x' }, qy: { op: 'swizzle', in: ['q'], mask: 'y' },
  ...cloth('na', [14, 40], 17), ...cloth('nb', [5, 13], 5), ...cloth('nc', [6, 15], 31), na6: { op: 'mul', in: ['na', 0.65] }, nb3: { op: 'mul', in: ['nb', 0.35] }, n: { op: 'add', in: ['na6', 'nb3'] },
  qx1: { op: 'oneMinus', in: ['qx'] }, qy1: { op: 'oneMinus', in: ['qy'] }, ey0: { op: 'mul', in: ['qy', 2.5] }, ey1: { op: 'mul', in: ['qy1', 2.5] },
  ex: { op: 'min', in: ['qx', 'qx1'] }, ey: { op: 'min', in: ['ey0', 'ey1'] }, edge: { op: 'min', in: ['ex', 'ey'] }, fray: { op: 'mul', in: ['n', 0.05] }, t1: { op: 'step', in: ['edge', 'fray'] },
  cq: { op: 'sub', in: ['q', [1, 0]] }, cs: { op: 'mul', in: ['cq', [1, 1.6]] }, cd: { op: 'length', in: ['cs'] }, cn: { op: 'mul', in: ['n', 0.22] }, cr0: { op: 'add', in: ['cn', 0.22] },
  cin: { op: 'step', in: ['cd', 'cr0'] }, two: { op: 'step', in: [0.45, 'seed'] }, t2: { op: 'mul', in: ['two', 'cin'] }, t3: { op: 'step', in: [0.94, 'nc'] },
  t12: { op: 'max', in: ['t1', 't2'] }, torn: { op: 'max', in: ['t12', 't3'] }, cut: { op: 'gt', in: ['torn', 0.5] },
  l: { op: 'dot', in: ['c', [0.3, 0.59, 0.11]] }, pale: { op: 'mix', in: ['c', 'l', 0.25] }, warm: { op: 'mul', in: ['pale', [1.12, 1.06, 0.96]] }, colour: { op: 'min', in: ['warm', 1] },
  glow: { op: 'mul', in: ['c', [0.0296, 0.0212, 0.0144]] } }, { colour: 'colour', emissive: 'glow', discard: 'cut', roughness: 0.95 }), doubleSided: true } as const;
