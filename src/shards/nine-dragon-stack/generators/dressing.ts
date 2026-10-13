// The instanced kit pieces that cover every bay of every facade (the Kowloon density): balconies with ruled railings,
// window cages, potted plants, striped awnings, laundry poles, rooftop shacks and water tanks, lit sign boxes, drain
// pipes, roll shutters. Each is built once at the origin (local +z = out of the wall, y up) in the same Jiehua program,
// then drawn as one InstancedMesh per piece and region (ctx.put).
import { IcosahedronGeometry, Vector3 } from 'three';
import type { Piece } from './ctx';
import { E, K, Kit, type Look } from './kit';

export interface PieceKits { opaque: Kit | null; alpha: Kit | null }

const up = new Vector3(0, 1, 0), X = new Vector3(1, 0, 0), Z = new Vector3(0, 0, 1);
const RAIL: Look = { wash: 0x26282e, kind: K.bars, row: 1, col: 0.12, line: 1 };

function balcony(): PieceKits {
  // a unit balcony: 1 m wide, 1 m deep (scaled per instance), slab + fascia, a ruled railing on three sides
  const o = new Kit(), a = new Kit();
  o.box(0, 0, 0.5, 1, 0.12, 1, { wash: 0x9a9fa6, line: 1.4 });
  o.box(0, -0.12, 1.0, 1.02, 0.24, 0.05, { wash: 0x8a8f96, line: 1.2 });
  o.box(0, 1.1, 1.0, 1.02, 0.05, 0.05, { wash: 0x3a3d44, line: 0.8 });
  a.quad(new Vector3(-0.5, 0.12, 1), X, up, 1, 1.0, RAIL);
  a.quad(new Vector3(-0.5, 0.12, 0), Z, up, 1, 1.0, RAIL);
  a.quad(new Vector3(0.5, 0.12, 1), Z.clone().negate(), up, 1, 1.0, RAIL);
  return { opaque: o, alpha: a };
}

function cage(): PieceKits {
  // a window cage: 1 m wide, 1.9 m tall, 0.55 m deep, bars on three sides, a tray and a lid
  const o = new Kit(), a = new Kit();
  const bars: Look = { wash: 0x2e3036, kind: K.bars, row: 1, col: 0.1, line: 1 };
  o.box(0, 0, 0.28, 1.04, 0.07, 0.58, { wash: 0x565a61, line: 1 });
  o.box(0, 1.9, 0.28, 1.08, 0.06, 0.62, { wash: 0x565a61, line: 1 });
  a.quad(new Vector3(-0.5, 0.07, 0.56), X, up, 1, 1.83, bars);
  a.quad(new Vector3(-0.5, 0.07, 0), Z, up, 0.56, 1.83, bars);
  a.quad(new Vector3(0.5, 0.07, 0.56), Z.clone().negate(), up, 0.56, 1.83, bars);
  // junk inside: a box, a bucket
  o.box(-0.2, 0.07, 0.25, 0.3, 0.3, 0.3, { wash: 0x8a6a3a, line: 0.8, accent: true });
  o.cyl(0.25, 0.07, 0.3, 0.12, 0.14, 0.26, 7, { wash: 0x2e5fa3, line: 0.8, accent: true });
  return { opaque: o, alpha: a };
}

function plant(): PieceKits {
  const o = new Kit();
  o.cyl(0, 0, 0, 0.17, 0.21, 0.3, 6, { wash: 0xa4532e, line: 1, accent: true }, { caps: false });
  const ico = new IcosahedronGeometry(1, 0).getAttribute('position').array;
  const leaf: Look = { wash: 0x3d7d4c, kind: K.leaf, line: 0, accent: true };
  o.blob(ico, null, 0, 0.5, 0, 0.32, 0.3, 0.32, leaf, true);
  o.blob(ico, null, 0.1, 0.74, 0.04, 0.22, 0.24, 0.22, { ...leaf, wash: 0x4f9158 }, true);
  return { opaque: o, alpha: null };
}

function awning(): PieceKits {
  // a striped cloth awning over a window: 1 m wide, sloping out 0.8 m; the instance colour dyes it
  const o = new Kit();
  const cloth: Look = { wash: 0xf0f0f0, kind: K.cloth, row: 1, col: 0.22, line: 1, accent: true };
  const a0 = new Vector3(-0.5, 0, 0), a1 = new Vector3(0.5, 0, 0), b1 = new Vector3(0.5, -0.45, 0.8), b0 = new Vector3(-0.5, -0.45, 0.8);
  o.quad4(b0, b1, a1, a0, 1, 0.92, cloth);
  o.quad4(a0, a1, b1, b0, 1, 0.92, cloth);
  o.quad(new Vector3(-0.5, -0.65, 0.8), X, up, 1, 0.2, cloth);
  o.quad(new Vector3(0.5, -0.65, 0.8), X.clone().negate(), up, 1, 0.2, cloth);
  return { opaque: o, alpha: null };
}

function laundry(): PieceKits {
  // a bamboo pole out from the wall with the wash pegged along it (seen edge-on from the street, face-on across the Well)
  const o = new Kit();
  o.beam(new Vector3(0, 0, 0), new Vector3(0, 0.05, 1.7), 0.035, 0.035, { wash: 0x8a7a55, line: 0.7 });
  const cols = [0xeceae2, 0x6f9ccf, 0xc23b22, 0xd9a441, 0xe8dfc9] as const;
  let z = 0.25;
  cols.forEach((c, i) => {
    if (z > 1.6) return;
    const w = 0.28 + (i % 3) * 0.1, h = 0.45 + ((i * 7) % 4) * 0.12;
    const look: Look = { wash: c, kind: K.cloth, row: i % 2, col: 0.1, line: 0.7, accent: true };
    o.quad(new Vector3(0, 0.02 - h, z), Z, up, w, h, look);
    o.quad(new Vector3(0, 0.02 - h, z + w), Z.clone().negate(), up, w, h, look);
    z += w + 0.06;
  });
  return { opaque: o, alpha: null };
}

function shack(): PieceKits {
  // a rooftop shack: tin walls, a lit window, a door, a lean-to roof
  const o = new Kit();
  o.box(0, 0, 0, 2.6, 2.3, 2.2, { wash: 0x9a9690, kind: K.panel, line: 1 });
  o.box(0.5, 0.9, 1.11, 0.9, 0.7, 0.02, { wash: 0xffc070, emit: 0.8, line: 1, accent: true });
  o.box(-0.7, 0, 1.11, 0.7, 1.8, 0.02, { wash: 0x4a3a2c, kind: K.panel, line: 1 });
  const r0 = new Vector3(-1.5, 2.2, -1.3), r1 = new Vector3(1.5, 2.2, -1.3), r2 = new Vector3(1.5, 2.6, 1.4), r3 = new Vector3(-1.5, 2.6, 1.4);
  o.quad4(r3, r2, r1, r0, 3, 2.7, { wash: 0x6f7780, kind: K.tiles, line: 1 });
  o.quad4(r0, r1, r2, r3, 3, 2.7, { wash: 0x5a6068, line: 1 });
  o.beam(new Vector3(0.9, 2.4, 0.3), new Vector3(0.9, 5.5, 0.3), 0.06, 0.06, { wash: 0x2a2c31, line: 0.8 });
  o.beam(new Vector3(0.3, 4.6, 0.3), new Vector3(1.5, 4.6, 0.3), 0.04, 0.04, { wash: 0x2a2c31, line: 0.6 });
  return { opaque: o, alpha: null };
}

function tank(): PieceKits {
  const o = new Kit();
  for (const [dx, dz] of [[-0.6, -0.6], [0.6, -0.6], [0.6, 0.6], [-0.6, 0.6]] as const) o.box(dx, 0, dz, 0.1, 1.0, 0.1, { wash: 0x3a3d44, line: 0.8 });
  o.box(0, 1.0, 0, 1.6, 0.1, 1.6, { wash: 0x3a3d44, line: 1 });
  o.cyl(0, 1.1, 0, 0.85, 0.85, 1.7, 12, { wash: 0x8e969e, line: 1 }, { edges: E.rims });
  o.cyl(0, 2.8, 0, 0.85, 0.2, 0.3, 12, { wash: 0x7c848c, line: 1 });
  return { opaque: o, alpha: null };
}

function lightbox(): PieceKits {
  // a small lit sign box on a bracket (the instance colour is its glow); ruled frame
  const o = new Kit();
  o.box(0, 0, 0.35, 0.55, 1.1, 0.16, { wash: 0xffffff, emit: 1.6, line: 1.1, accent: true, edges: E.all });
  o.beam(new Vector3(0, 1.05, 0), new Vector3(0, 1.05, 0.35), 0.05, 0.05, { wash: 0x2a2c31, line: 0.6 });
  return { opaque: o, alpha: null };
}

function pipe(): PieceKits {
  // a unit length of drain pipe with a bracket (scaled in y per instance)
  const o = new Kit();
  o.cyl(0, 0, 0.12, 0.07, 0.07, 1, 6, { wash: 0x6d7178, line: 0.8 }, { caps: false, edges: E.sides });
  return { opaque: o, alpha: null };
}

function shutter(): PieceKits {
  // a rolled-down steel shutter (a closed shop), ruled slats
  const o = new Kit();
  o.quad(new Vector3(-0.5, 0, 0.02), X, up, 1, 1, { wash: 0x8d9298, kind: K.tiles, line: 1 });
  o.box(0, 1.0, 0.1, 1.04, 0.22, 0.22, { wash: 0x6d7178, line: 1 });
  return { opaque: o, alpha: null };
}

export const PIECES: Readonly<Record<Piece, () => PieceKits>> = { balcony, cage, plant, awning, laundry, shack, tank, lightbox, pipe, shutter };
