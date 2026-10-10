import { Group, InstancedBufferAttribute, InstancedBufferGeometry, Mesh, PlaneGeometry, type ShaderMaterial } from 'three';
import { uniformsFrom, type ShaderFamily, type UniformMap, type UniformRows } from './shaderFamily';

/**
 * Camera-facing cards drawn by a shard's own programs, as declared rows (SHARD-PLATFORM M3, look-family rows): a sun's
 * bloom and its fan of light shafts, a field of painted cloud puffs, any billboard the vertex program turns to face the
 * camera. Nothing here knows a shard: the programs are rows of the shard's `ShaderFamily`, and every card's numbers (its
 * uniforms, its pulse, a field's per-instance attributes) are data, usually an offline bake of the shard's placement.
 *
 * - `cardGroup` builds a group of unit cards (one shared 1 × 1 plane), one mesh and material per card, unculled (the
 *   program places the card), all at the row's render order, in the row's order.
 * - `cardField` builds one instanced draw over a `plane`-sized quad: the per-instance attributes are baked float32 bytes
 *   (base64, the platform's byte order), the instance count the first attribute's.
 * - `cardGroupRow` / `cardFieldRow` read a bake's JSON rows, checked against the family: a JSON import widens tuples and
 *   program names to plain arrays and strings, so a row is parsed, never cast.
 */

/** A card uniform's pulse as data: each `update(t)` writes `base + amp · sin(t · rate + phase)`. */
export interface CardPulseRow {
  readonly uniform: string;
  readonly base: number;
  readonly amp: number;
  readonly rate: number;
  readonly phase: number;
}

/** One card: a program of the family, its own uniforms (over the program row's), and an optional pulse. */
export interface CardRow<P extends string = string> {
  readonly program: P;
  readonly uniforms?: UniformRows;
  readonly pulse?: CardPulseRow;
}

/** A group of unit cards: its name, the render order every card draws at, and the cards in draw order. */
export interface CardGroupRow<P extends string = string> {
  readonly name: string;
  readonly order: number;
  readonly cards: readonly CardRow<P>[];
}

/** What `cardGroup` builds: the group, the shared plane, every card's material and the pulse update. */
export interface CardGroup {
  readonly group: Group;
  readonly geometry: PlaneGeometry;
  readonly materials: readonly ShaderMaterial[];
  /** writes every card's pulse for look time `t` (seconds) */
  update: (t: number) => void;
}

/** A group of camera-facing unit cards from a row: one mesh per card on one shared 1 × 1 plane. */
export function cardGroup<P extends string>(family: ShaderFamily<P>, row: CardGroupRow<P>, shared: UniformMap): CardGroup {
  const group = new Group(); group.name = row.name;
  const plane = new PlaneGeometry(1, 1), materials: ShaderMaterial[] = [];
  const pulses: { readonly material: ShaderMaterial; readonly pulse: CardPulseRow }[] = [];
  for (const card of row.cards) {
    const material = family.material(card.program, shared, card.uniforms === undefined ? {} : { uniforms: uniformsFrom(card.uniforms) });
    const mesh = new Mesh(plane, material); mesh.frustumCulled = false; mesh.renderOrder = row.order; group.add(mesh);
    materials.push(material);
    if (card.pulse !== undefined) pulses.push({ material, pulse: card.pulse });
  }
  return { group, geometry: plane, materials, update: (t) => {
    for (const { material, pulse } of pulses) { const u = material.uniforms[pulse.uniform]; if (u) u.value = pulse.base + pulse.amp * Math.sin(t * pulse.rate + pulse.phase); }
  } };
}

/** One per-instance attribute: its item size and its float32 bytes, base64. */
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

function floats(base64: string): Float32Array {
  const bytes = Uint8Array.from(atob(base64), (c) => c.codePointAt(0) ?? 0);
  return new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
}

/** The float32 bytes of `values`, base64 (a bake writes a field's attributes with it). */
export function cardFloats(values: ArrayLike<number>): string {
  const bytes = new Uint8Array(Float32Array.from(values).buffer);
  let out = '';
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCodePoint(...bytes.subarray(i, i + 0x8000));
  return btoa(out);
}

/** An instanced card field from a row, one draw: `uniforms` adds the caller's (a texture) over the program's. */
export function cardField<P extends string>(family: ShaderFamily<P>, row: CardFieldRow<P>, shared: UniformMap, uniforms?: UniformMap): Mesh<InstancedBufferGeometry, ShaderMaterial> {
  const base = new PlaneGeometry(row.plane[0], row.plane[1]), g = new InstancedBufferGeometry();
  g.index = base.index; g.setAttribute('position', base.getAttribute('position')); g.setAttribute('uv', base.getAttribute('uv'));
  let count = -1;
  for (const [name, attribute] of Object.entries(row.attributes)) {
    const values = floats(attribute.float32);
    if (count < 0) count = values.length / attribute.size;
    g.setAttribute(name, new InstancedBufferAttribute(values, attribute.size));
  }
  g.instanceCount = Math.max(count, 0);
  const material = family.material(row.program, shared, uniforms === undefined ? {} : { uniforms });
  const mesh = new Mesh(g, material); mesh.frustumCulled = false; mesh.renderOrder = row.order; mesh.name = row.name;
  return mesh;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
function fail(at: string, what: string): never { throw new Error(`cardField: ${at} ${what}`); }
function num(value: unknown, at: string): number { return typeof value === 'number' && Number.isFinite(value) ? value : fail(at, 'is not a number'); }
function str(value: unknown, at: string): string { return typeof value === 'string' ? value : fail(at, 'is not a string'); }
function obj(value: unknown, at: string): Record<string, unknown> { return isRecord(value) ? value : fail(at, 'is not an object'); }
function nums(value: unknown, at: string, length: number): number[] {
  if (!Array.isArray(value) || value.length !== length) fail(at, `is not ${String(length)} numbers`);
  return value.map((item: unknown, i) => num(item, `${at}[${String(i)}]`));
}
function program<P extends string>(family: ShaderFamily<P>, value: unknown, at: string): P {
  const name = str(value, at);
  return family.has(name) ? name : fail(at, `names no program of the family (${name})`);
}
/** A uniform row read from JSON: a number, a hex colour (`rgb`) or a `v2` / `v3` / `v4` vector. */
function uniformRows(value: unknown, at: string): UniformRows {
  const out: Record<string, UniformRows[string]> = {};
  for (const [name, row] of Object.entries(obj(value, at))) {
    const here = `${at}.${name}`;
    if (typeof row === 'number') { out[name] = num(row, here); continue; }
    const o = obj(row, here);
    if ('rgb' in o) out[name] = { rgb: num(o['rgb'], `${here}.rgb`) };
    else if ('v2' in o) { const [x = 0, y = 0] = nums(o['v2'], `${here}.v2`, 2); out[name] = { v2: [x, y] }; }
    else if ('v3' in o) { const [x = 0, y = 0, z = 0] = nums(o['v3'], `${here}.v3`, 3); out[name] = { v3: [x, y, z] }; }
    else if ('v4' in o) { const [x = 0, y = 0, z = 0, w = 0] = nums(o['v4'], `${here}.v4`, 4); out[name] = { v4: [x, y, z, w] }; }
    else fail(here, 'is not a uniform row');
  }
  return out;
}

/** A card group row read from a bake's JSON, checked against the family (a malformed row or unknown program throws). */
export function cardGroupRow<P extends string>(family: ShaderFamily<P>, json: unknown): CardGroupRow<P> {
  const row = obj(json, 'group');
  const cards = Array.isArray(row['cards']) ? row['cards'] : fail('group.cards', 'is not a list');
  return { name: str(row['name'], 'group.name'), order: num(row['order'], 'group.order'), cards: cards.map((value: unknown, i): CardRow<P> => {
    const at = `group.cards[${String(i)}]`, card = obj(value, at);
    const out: { program: P; uniforms?: UniformRows; pulse?: CardPulseRow } = { program: program(family, card['program'], `${at}.program`) };
    if (card['uniforms'] !== undefined) out.uniforms = uniformRows(card['uniforms'], `${at}.uniforms`);
    if (card['pulse'] !== undefined) {
      const p = obj(card['pulse'], `${at}.pulse`);
      out.pulse = { uniform: str(p['uniform'], `${at}.pulse.uniform`), base: num(p['base'], `${at}.pulse.base`), amp: num(p['amp'], `${at}.pulse.amp`), rate: num(p['rate'], `${at}.pulse.rate`), phase: num(p['phase'], `${at}.pulse.phase`) };
    }
    return out;
  }) };
}

/** A card field row read from a bake's JSON, checked against the family (a malformed row or unknown program throws). */
export function cardFieldRow<P extends string>(family: ShaderFamily<P>, json: unknown): CardFieldRow<P> {
  const row = obj(json, 'field'), [w = 1, h = 1] = nums(row['plane'], 'field.plane', 2), attributes: Record<string, CardAttributeRow> = {};
  for (const [name, value] of Object.entries(obj(row['attributes'], 'field.attributes'))) {
    const a = obj(value, `field.attributes.${name}`);
    attributes[name] = { size: num(a['size'], `field.attributes.${name}.size`), float32: str(a['float32'], `field.attributes.${name}.float32`) };
  }
  return { name: str(row['name'], 'field.name'), order: num(row['order'], 'field.order'), plane: [w, h], program: program(family, row['program'], 'field.program'), attributes };
}
