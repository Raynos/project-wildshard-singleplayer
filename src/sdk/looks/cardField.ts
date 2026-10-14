import { Group, InstancedBufferAttribute, InstancedBufferGeometry, Mesh, PlaneGeometry, type BufferGeometry, ShaderMaterial, type Material } from 'three';
import { uniformsFrom, type ShaderMaterialOptions, type UniformMap, type UniformRows } from '@wildshard/game/plugin/shaderFamily';

/**
 * Camera-facing cards drawn by a shard's own programs, from rows (SHARD-PLATFORM M3, look-family rows; G395 paired it): a
 * sun's bloom and its fan of light shafts, a field of painted cloud puffs, a fire's flame tongues, glow and smoke, any
 * billboard the vertex program turns to face the camera. Nothing here knows a shard: the rows are data, the programs the
 * shard's.
 *
 * - `cardGroup` builds a group of cards from a row: one unculled mesh per card (the program places the card), on one
 *   shared 1 × 1 plane or a quad the caller names, at the card's scale and offset, at the row's render order (or the
 *   card's own), in the row's order, with optional uniform pulses. The materials come from the caller's programs (a
 *   shader family, or any source of materials by program name); `into` puts the cards straight under a group of the
 *   caller's.
 * - `cardField` builds one instanced draw over a `plane`-sized quad: the per-instance attributes are baked float32 bytes
 *   (base64, the platform's byte order), the instance count the first attribute's.
 */

/** A card uniform's pulse as data: each `update(t)` writes `base + amp · sin(t · rate + phase)`. */
export interface CardPulseRow {
  readonly uniform: string;
  readonly base: number;
  readonly amp: number;
  readonly rate: number;
  readonly phase: number;
}

/**
 * One card: a program, its own uniforms (over the program row's), an optional pulse, and where it stands: the caller's
 * named `quad` (else the unit plane), its `scale` (x, y, z, or one number for all three; default 1), its offset `at` and
 * its own render `order` (else the row's).
 */
export interface CardRow<P extends string = string> {
  readonly program: P;
  readonly uniforms?: UniformRows;
  readonly pulse?: CardPulseRow;
  readonly quad?: string;
  readonly scale?: readonly [number, number, number] | number;
  readonly at?: readonly [number, number, number];
  readonly order?: number;
}

/** A group of cards: its name, the render order its cards draw at, and the cards in draw order. */
export interface CardGroupRow<P extends string = string> {
  readonly name: string;
  readonly order: number;
  readonly cards: readonly CardRow<P>[];
}

/** One per-instance attribute: its item size and its float32 bytes, base64 (the platform's byte order). */
export interface CardAttributeRow {
  readonly size: number;
  readonly float32: string;
}

/** An instanced card field: its mesh name, render order, the base quad's size, its program and per-instance attributes. */
export interface CardFieldRow<P extends string = string> {
  readonly name: string;
  readonly order: number;
  readonly plane: readonly [number, number];
  readonly program: P;
  readonly attributes: Readonly<Record<string, CardAttributeRow>>;
}

/** Where a card's material comes from: a shader family, or any source of a material by program name. */
export interface CardPrograms<P extends string, M extends Material = ShaderMaterial> {
  material: (program: P, shared: UniformMap, options?: ShaderMaterialOptions) => M;
}

/** What a card group adds: the caller's named quads, and the caller's group to put the cards under. */
export interface CardGroupOptions {
  readonly quads?: Readonly<Record<string, BufferGeometry>>;
  readonly into?: Group;
}

/** What `cardGroup` builds: the group, the shared plane, every card's material and mesh, and the pulse update. */
export interface CardGroup<M extends Material = ShaderMaterial> {
  readonly group: Group;
  readonly geometry: PlaneGeometry;
  readonly materials: readonly M[];
  /** every card's mesh, in the row's order */
  readonly meshes: readonly Mesh[];
  /** writes every card's pulse for look time `t` (seconds) */
  update: (t: number) => void;
}

/** A group of camera-facing cards from a row: one mesh per card, on one shared 1 × 1 plane or the caller's named quads. */
export function cardGroup<P extends string, M extends Material = ShaderMaterial>(programs: CardPrograms<P, M>, row: CardGroupRow<P>, shared: UniformMap, options: CardGroupOptions = {}): CardGroup<M> {
  const group = options.into ?? new Group();
  if (options.into === undefined) group.name = row.name;
  const plane = new PlaneGeometry(1, 1), materials: M[] = [], meshes: Mesh[] = [];
  const pulses: { readonly material: ShaderMaterial; readonly pulse: CardPulseRow }[] = [];
  for (const card of row.cards) {
    const material = programs.material(card.program, shared, card.uniforms === undefined ? {} : { uniforms: uniformsFrom(card.uniforms) });
    const quad = card.quad === undefined ? plane : options.quads?.[card.quad];
    if (quad === undefined) throw new Error(`[cardGroup] ${row.name}: no quad named ${card.quad ?? ''}`);
    const mesh = new Mesh(quad, material); mesh.frustumCulled = false; mesh.renderOrder = card.order ?? row.order;
    if (typeof card.scale === 'number') mesh.scale.setScalar(card.scale); else if (card.scale !== undefined) mesh.scale.set(...card.scale);
    if (card.at !== undefined) mesh.position.set(...card.at);
    group.add(mesh); materials.push(material); meshes.push(mesh);
    if (card.pulse !== undefined) {
      if (!(material instanceof ShaderMaterial)) throw new Error('[cardGroup] uniform pulses require a shader material');
      pulses.push({ material, pulse: card.pulse });
    }
  }
  return { group, geometry: plane, materials, meshes, update: (t) => {
    for (const { material, pulse } of pulses) { const u = material.uniforms[pulse.uniform]; if (u) u.value = pulse.base + pulse.amp * Math.sin(t * pulse.rate + pulse.phase); }
  } };
}

function floats(base64: string): Float32Array {
  const bytes = Uint8Array.from(atob(base64), (c) => c.codePointAt(0) ?? 0);
  return new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
}

/**
 * An instanced card field from a row, one draw: `uniforms` adds the caller's (a texture) over the program's. The programs
 * may be any source of materials by program name (a shader family, or a compiled SF59 graph that reads the attributes).
 */
export function cardField<P extends string, M extends Material = ShaderMaterial>(programs: CardPrograms<P, M>, row: CardFieldRow<P>, shared: UniformMap, uniforms?: UniformMap): Mesh<InstancedBufferGeometry, M> {
  const base = new PlaneGeometry(row.plane[0], row.plane[1]), g = new InstancedBufferGeometry();
  g.index = base.index; g.setAttribute('position', base.getAttribute('position')); g.setAttribute('uv', base.getAttribute('uv'));
  let count = -1;
  for (const [name, attribute] of Object.entries(row.attributes)) {
    const values = floats(attribute.float32);
    if (count < 0) count = values.length / attribute.size;
    g.setAttribute(name, new InstancedBufferAttribute(values, attribute.size));
  }
  g.instanceCount = Math.max(count, 0);
  const material = programs.material(row.program, shared, uniforms === undefined ? {} : { uniforms });
  const mesh = new Mesh(g, material); mesh.frustumCulled = false; mesh.renderOrder = row.order; mesh.name = row.name;
  return mesh;
}
