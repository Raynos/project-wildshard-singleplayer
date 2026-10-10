import { type BufferGeometry, CapsuleGeometry, CatmullRomCurve3, CylinderGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry, TubeGeometry, Vector3 } from 'three';
import { smoothColors } from '../looks/modelLibrary';
import { braidColours, coilPoints, LashCord, plaitedCord, type CoilPath, type CordRgb, type CordStyle, type PlaitStyle } from './lashView';

/**
 * The lash item's held view (SHARD-PLATFORM M3; ex a dune shard's whip model): a braided handle in a gloved fist with a
 * coil hanging from it, and the thrown cord, built from rows. Three layers, each replacing the one before when its
 * model loaded: a code fist (palm, knuckles, thumb and cuff of capsules round a braided cylinder, a knob at the butt,
 * a code coil of `turns` shrinking loops and a fall), a generated glove (fitted so its handle stands on the grip's +Y),
 * and a textured hero glove with a plaited coil in its own frame. Nothing here knows a shard: the models arrive as
 * loaders, the coil's surface as a callback.
 */

type V3 = readonly [number, number, number];

/** A code coil: `turns` loops of radius `loopR` shrinking by `shrink` along it, its cord's radius, and its pose. */
export interface LashCodeCoil { readonly turns: number; readonly loopR: number; readonly cord: number; readonly pos: V3; readonly rot: V3 }

/** The held lash as rows. */
export interface LashHoldRow {
  /** the tubes' sides */
  readonly radial: number;
  /** the code fist's leathers (hex), their roughness and warm self-light (hex) */
  readonly leathers: { readonly glove: number; readonly cuff: number; readonly knob: number; readonly roughness: number; readonly emissive: number };
  /** the braid: the handle's two strands, the popper, and the braided materials' roughness */
  readonly braid: { readonly a: CordRgb; readonly b: CordRgb; readonly popper: CordRgb; readonly roughness: number };
  /** the plain wrap material's colour (hex) and roughness */
  readonly wrap: { readonly colour: number; readonly roughness: number };
  /** the handle: a braided open cylinder, its top and bottom radii, length, height segments and its height on the grip */
  readonly handle: { readonly top: number; readonly bottom: number; readonly length: number; readonly segments: number; readonly y: number };
  /** the knob: a squashed sphere at the butt */
  readonly knob: { readonly r: number; readonly widthSegments: number; readonly heightSegments: number; readonly y: number; readonly squash: number };
  /** the palm: a capsule, its position and scale */
  readonly palm: { readonly r: number; readonly length: number; readonly cap: number; readonly radial: number; readonly pos: V3; readonly scale: V3 };
  /** the fingers: `count` capsules lying along X, the first at `pos`, each next one `step` lower */
  readonly fingers: { readonly count: number; readonly r: number; readonly length: number; readonly cap: number; readonly radial: number; readonly pos: V3; readonly step: number };
  /** the thumb: a capsule, its position and turn */
  readonly thumb: { readonly r: number; readonly length: number; readonly cap: number; readonly radial: number; readonly pos: V3; readonly rot: V3 };
  /** the cuff: an open flared cylinder */
  readonly cuff: { readonly top: number; readonly bottom: number; readonly h: number; readonly radial: number; readonly pos: V3 };
  /**
   * The generated glove's fit: its handle runs along +X from the butt; the handle's axis is the mean of the vertices
   * between `collar[0]` and `collar[1]` short of the far end, the fist `fist` of the way along; stood on +Y, turned by
   * `turn` about it and scaled; the lash leaves `keeper` short of the far end. Normals averaged per position, the
   * painted colours `smooth` of the way; a matte material of `colour` (linear) and `roughness`.
   */
  readonly glove: { readonly collar: readonly [number, number]; readonly fist: number; readonly turn: number; readonly scale: number; readonly keeper: number; readonly smooth: number; readonly colour: V3; readonly roughness: number };
  /** the poses: the grip's turn and the coil, with the code fist (`code`, its keeper's height `tip`) or the generated glove (`made`) */
  readonly code: { readonly grip: V3; readonly tip: number; readonly coil: LashCodeCoil };
  readonly made: { readonly grip: V3; readonly coil: LashCodeCoil };
  /** the code coil's path: points round the loops, the loops' horizontal squash, their start, their drift per unit along, then the fall's points */
  readonly coil: { readonly points: number; readonly tubular: number; readonly shrink: number; readonly squash: number; readonly origin: V3; readonly drift: readonly [number, number]; readonly fall: readonly V3[]; readonly a: CordRgb; readonly b: CordRgb; readonly roughness: number };
  /** user data set on both coils' materials (e.g. a flag a shard's light pass reads) */
  readonly coilUserData: Readonly<Record<string, boolean>>;
  /** the hero glove's pose in the hold's frame */
  readonly hd: { readonly pos: V3; readonly rot: V3 };
  /** the hero coil's path in the hero glove's own frame, and its plait */
  readonly loop: CoilPath;
  readonly plait: PlaitStyle;
  /** the thrown cord */
  readonly lash: CordStyle;
}

/** The held lash's models: the generated glove's geometry (a copy) and the fitted hero glove, each null when not loaded, and the hero coil's surface. */
export interface LashHoldModels {
  readonly glove: () => BufferGeometry | null;
  readonly hd: () => Group | null;
  readonly coilSurface: (m: MeshStandardMaterial) => void;
}

/** A built held lash: the root, the grip, the code coil, the thrown cord, where the lash leaves the hand, and the loaded gloves. */
export interface LashHoldParts { root: Group; grip: Group; coil: Mesh; lash: LashCord; tip: Vector3; glove: Mesh | null; hd: Group | null }

/** The lash's matte braid as a plain material (no vertex colours), for a pull's wrap coil. */
export function lashWrapMaterial(row: LashHoldRow): MeshStandardMaterial {
  return new MeshStandardMaterial({ color: row.wrap.colour, roughness: row.wrap.roughness, metalness: 0, emissive: row.leathers.emissive });
}

/** Averages the normals of every vertex at one position, then the painted colours `amount` of the way. */
function smoothNormals(g: BufferGeometry, amount: number): void {
  const p = g.getAttribute('position'), n = g.getAttribute('normal'), sum = new Map<string, [number, number, number]>();
  const key = (i: number): string => `${p.getX(i).toFixed(4)},${p.getY(i).toFixed(4)},${p.getZ(i).toFixed(4)}`;
  for (let i = 0; i < p.count; i++) { const k = key(i), v = sum.get(k) ?? [0, 0, 0]; v[0] += n.getX(i); v[1] += n.getY(i); v[2] += n.getZ(i); sum.set(k, v); }
  for (let i = 0; i < p.count; i++) { const v = sum.get(key(i)) ?? [0, 1, 0], l = Math.hypot(v[0], v[1], v[2]) || 1; n.setXYZ(i, v[0] / l, v[1] / l, v[2] / l); }
  n.needsUpdate = true;
  smoothColors(g, amount);
}

function gloveMesh(row: LashHoldRow, g: BufferGeometry | null): { mesh: Mesh; top: number } | null {
  if (g === null) return null;
  const fit = row.glove;
  g.computeBoundingBox(); const b = g.boundingBox; if (b === null) return null;
  const p = g.getAttribute('position'), x1 = b.max.x - fit.collar[0], x2 = b.max.x - fit.collar[1]; let n = 0, y = 0, z = 0;
  for (let i = 0; i < p.count; i++) if (p.getX(i) > x1 && p.getX(i) < x2) { y += p.getY(i); z += p.getZ(i); n++; }
  const fist = b.min.x + (b.max.x - b.min.x) * fit.fist;
  g.translate(-fist, n > 0 ? -y / n : -(b.min.y + b.max.y) / 2, n > 0 ? -z / n : -(b.min.z + b.max.z) / 2);
  g.rotateZ(Math.PI / 2); g.rotateY(fit.turn); g.scale(fit.scale, fit.scale, fit.scale);
  g.computeVertexNormals(); smoothNormals(g, fit.smooth); g.computeBoundingSphere();
  const top = (b.max.x - fist - fit.keeper) * fit.scale;
  const material = new MeshStandardMaterial({ vertexColors: true, roughness: fit.roughness, metalness: 0, emissive: row.leathers.emissive });
  material.color.setRGB(...fit.colour);
  return { mesh: new Mesh(g, material), top };
}

/** Builds the held lash from its rows: the code fist, replaced by the generated glove and then the hero glove as each loaded. */
export function buildLashHold(row: LashHoldRow, models: LashHoldModels): LashHoldParts {
  const L = row.leathers, sides = row.radial + 1;
  const leather = (color: number): MeshStandardMaterial => new MeshStandardMaterial({ color, roughness: L.roughness, metalness: 0, emissive: L.emissive });
  const braided = (): MeshStandardMaterial => new MeshStandardMaterial({ vertexColors: true, roughness: row.braid.roughness, metalness: 0, emissive: L.emissive });
  const root = new Group(), grip = new Group(), glove = leather(L.glove), cuffLeather = leather(L.cuff);
  const H = row.handle, handleGeometry = new CylinderGeometry(H.top, H.bottom, H.length, row.radial, H.segments, true);
  braidColours(handleGeometry, H.segments + 1, sides, 0, row.braid.a, row.braid.b, row.braid.popper);
  const handle = new Mesh(handleGeometry, braided()); handle.position.y = H.y;
  const K = row.knob, knob = new Mesh(new SphereGeometry(K.r, K.widthSegments, K.heightSegments), leather(L.knob)); knob.position.y = K.y; knob.scale.set(1, K.squash, 1);
  const P = row.palm, palm = new Mesh(new CapsuleGeometry(P.r, P.length, P.cap, P.radial), glove); palm.position.set(...P.pos); palm.scale.set(...P.scale);
  const fist = new Group(); fist.add(palm);
  const F = row.fingers;
  for (let k = 0; k < F.count; k++) {
    const finger = new Mesh(new CapsuleGeometry(F.r, F.length, F.cap, F.radial), glove);
    finger.rotation.z = Math.PI / 2; finger.position.set(F.pos[0], F.pos[1] - k * F.step, F.pos[2]); fist.add(finger);
  }
  const T = row.thumb, thumb = new Mesh(new CapsuleGeometry(T.r, T.length, T.cap, T.radial), glove); thumb.position.set(...T.pos); thumb.rotation.set(...T.rot);
  const C = row.cuff, cuff = new Mesh(new CylinderGeometry(C.top, C.bottom, C.h, C.radial, 1, true), cuffLeather); cuff.position.set(...C.pos);
  fist.add(thumb, cuff);
  grip.add(handle, knob, fist);
  const made = gloveMesh(row, models.glove());
  if (made !== null) { handle.visible = false; knob.visible = false; fist.visible = false; grip.add(made.mesh); }
  const pose = made === null ? row.code : row.made, c = pose.coil, W = row.coil;
  grip.rotation.set(...pose.grip);
  const points: Vector3[] = [];
  for (let i = 0; i <= W.points; i++) {
    const s = i / W.points, a = -Math.PI / 2 + s * Math.PI * 2 * c.turns / 2, r = c.loopR * (1 - W.shrink * s);
    points.push(new Vector3(W.origin[0] + Math.cos(a) * r * W.squash - s * W.drift[0], W.origin[1] + (Math.sin(a) + 1) * r, W.origin[2] - s * W.drift[1]));
  }
  points.push(...W.fall.map(([x, y, z]) => new Vector3(x, y, z)));
  const coilGeometry = new TubeGeometry(new CatmullRomCurve3(points), W.tubular, c.cord, row.radial, false);
  braidColours(coilGeometry, W.tubular + 1, sides, 0, W.a, W.b, row.braid.popper);
  const coilMaterial = braided(); coilMaterial.roughness = W.roughness; Object.assign(coilMaterial.userData, row.coilUserData);
  const coil = new Mesh(coilGeometry, coilMaterial);
  coil.position.set(...c.pos); coil.rotation.set(...c.rot);
  root.add(grip, coil);
  const lash = new LashCord(row.lash); root.add(lash.mesh);
  const tip = new Vector3(0, made === null ? row.code.tip : made.top, 0).applyEuler(grip.rotation);
  const hd = models.hd();
  if (hd !== null) {
    hd.position.set(...row.hd.pos); hd.rotation.set(...row.hd.rot); root.add(hd);
    // the hero coil in the hero glove's own frame (the fitted model: out → holder (scaled) → turn (centred))
    const turn = hd.children[0]?.children[0];
    const coilMesh = plaitedCord(coilPoints(row.loop), row.loop.cord, row.plait);
    Object.assign(coilMesh.material.userData, row.coilUserData); models.coilSurface(coilMesh.material);
    turn?.add(coilMesh);
    grip.visible = false; coil.visible = false;
  }
  return { root, grip, coil, lash, tip, glove: made?.mesh ?? null, hd };
}
