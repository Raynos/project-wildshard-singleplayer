// RM4: the kit's Blender models (scripts/blender/open-plots/kit.py writes public/assets/open-plots/kit/<family>.glb).
// A family holds one to three variants; each node `<variant>.<Role>.<slot>` is lit `Kit` or emissive `Glow` geometry in
// model metres (front +z) with flat normals, metre UVs and a baked occlusion shade (COLOR_0). Placing a model colours
// each corner palette[slot] x shade (a slot the palette lacks takes the family's default colour), so every idea retints
// the same kit. The bytes arrive from the plot producer: nothing here reads a file, and no decoded buffer outlives the build.
import { normalizeWorldGlb } from '@wildshard/sdk/bake/world';

const ROLES = new Set(['Kit', 'Glow']);
/** sRGB hex to linear RGB */
const linear = (hex) => [1, 3, 5].map(at => { const c = Number.parseInt(hex.slice(at, at + 2), 16) / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
const rgb = (value) => Array.isArray(value) && value.length === 3 && value.every(c => Number.isFinite(c) && c >= 0 && c <= 1);

/** A GLB's root `extras` (the family record), read from its JSON chunk: the world reader keeps geometry, not extras. */
function glbExtras(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 20 || view.getUint32(0, true) !== 0x46546C67 || view.getUint32(16, true) !== 0x4E4F534A) throw new Error('open-plots kit: not a GLB');
  const length = view.getUint32(12, true), json = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + length)));
  const extras = typeof json === 'object' && json !== null ? json.extras : undefined;
  if (typeof extras !== 'object' || extras === null) throw new Error('open-plots kit: GLB has no family record');
  return extras;
}

/** Decode one family: its variants' rows (role, slot, corner arrays), emitters, default slot colours and stretch band. */
async function decodeFamily(family, bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length === 0) throw new Error(`open-plots kit ${family}: missing GLB bytes`);
  const extras = glbExtras(bytes);
  const count = extras.variants, emitters = extras.emitters, slots = extras.slots, stretch = extras.stretch, nominal = extras.nominal;
  if (extras.family !== family || !Number.isInteger(count) || count < 1 || count > 3 || !Array.isArray(emitters) || emitters.length !== count
    || typeof slots !== 'object' || slots === null) throw new Error(`open-plots kit ${family}: invalid family record`);
  const defaults = new Map(Object.entries(slots).map(([slot, hex]) => {
    if (typeof hex !== 'string' || !/^#[0-9a-f]{6}$/iu.test(hex)) throw new Error(`open-plots kit ${family}: invalid default ${slot}`);
    return [slot, linear(hex)];
  }));
  const band = stretch === undefined ? null : stretch;
  if (band !== null && (!Array.isArray(band) || band.length !== 2 || !(band[0] < band[1]) || !Number.isFinite(nominal))) throw new Error(`open-plots kit ${family}: invalid stretch`);
  const variants = Array.from({ length: count }, (_, i) => ({ rows: [], emitters: emitters[i].map(([x, y, z, slot]) => {
    if (![x, y, z].every(Number.isFinite) || typeof slot !== 'string') throw new Error(`open-plots kit ${family}: invalid emitter`);
    return { at: [x, y, z], slot };
  }) }));
  // the SDK's world reader applies node transforms and keeps each node's name with its corner channels (a kit model
  // never collides: its placer adds the collision boxes)
  const world = await normalizeWorldGlb(bytes, { glb: `${family}.glb`, colliders: 'mesh', materials: { kit: 'kit' } }, ['kit']);
  for (const primitive of world.static) {
    const match = /^(\d)\.(Kit|Glow)\.([a-z][A-Za-z0-9]{0,31})$/u.exec(primitive.node), variant = variants[Number(match?.[1])];
    const { positions, normals, uv, colours, indices } = primitive;
    if (match === null || variant === undefined || !ROLES.has(match[2] ?? '')) throw new Error(`open-plots kit ${family}: bad node ${primitive.node}`);
    if (normals === null || uv === null || colours === null || indices.length % 3 !== 0) throw new Error(`open-plots kit ${family}: ${primitive.node} lacks a channel`);
    const width = colours.length / (positions.length / 3), row = { role: match[2], slot: match[3], positions: [], normals: [], uvs: [], shades: [] };
    for (const at of indices) {
      row.positions.push(positions[at * 3] ?? 0, positions[at * 3 + 1] ?? 0, positions[at * 3 + 2] ?? 0);
      row.normals.push(normals[at * 3] ?? 0, normals[at * 3 + 1] ?? 1, normals[at * 3 + 2] ?? 0); row.uvs.push(uv[at * 2] ?? 0, uv[at * 2 + 1] ?? 0);
      row.shades.push(Math.min(1, Math.max(0, colours[at * width] ?? 1)));
    }
    variant.rows.push(row);
  }
  if (variants.some(variant => variant.rows.length === 0)) throw new Error(`open-plots kit ${family}: empty variant`);
  return { variants, defaults, band, nominal: band === null ? 0 : nominal };
}

/** Decode the kit's families once per build (`files`: family name to GLB bytes). `placeModel` writes a model's
 * triangles through a tile writer at tile-local (x, z) and `y` up, turned `yaw` radians (its front from +z toward +x), its stretch
 * band lengthened to `height` (a lantern post); its emitters feed the writer's lantern bake. */
export async function prepareModelKit(palette, files) {
  if (!(files instanceof Map) || files.size === 0) throw new Error('open-plots kit: no model families');
  const families = new Map();
  for (const [family, bytes] of files) families.set(family, await decodeFamily(family, bytes));
  const colours = new Map();
  const colourOf = (family, model, slot) => {
    const key = `${family}/${slot}`;
    let colour = colours.get(key);
    if (colour === undefined) {
      colour = palette[slot] ?? model.defaults.get(slot);
      if (!rgb(colour)) throw new Error(`open-plots kit ${family}: no colour for slot ${slot}`);
      colours.set(key, colour);
    }
    return colour;
  };
  return Object.freeze({
    /** @param {{ triChannels: Function, lanternEmitter?: Function }} w @param {string} family @param {number} variant */
    placeModel(w, family, variant, x, z, { yaw = 0, height, y = 0 } = {}) {
      const model = families.get(family), source = model?.variants[variant];
      if (model === undefined || source === undefined || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z) || !Number.isFinite(yaw)) throw new Error(`open-plots kit: invalid placement ${family}/${variant}`);
      const lift = height === undefined ? 0 : height - model.nominal;
      if (!Number.isFinite(lift) || (lift !== 0 && model.band === null)) throw new Error(`open-plots kit ${family}: cannot stretch`);
      const [a, b] = model.band ?? [0, 1], k = (b - a + lift) / (b - a);
      const lifted = (v) => (lift === 0 || v <= a ? v : v >= b ? v + lift : a + (v - a) * k);
      const c = Math.cos(yaw), s = Math.sin(yaw);
      const place = (px, py, pz) => [x + px * c + pz * s, y + lifted(py), z - px * s + pz * c];
      for (const row of source.rows) {
        const tint = colourOf(family, model, row.slot), { positions, normals, uvs, shades } = row;
        for (let at = 0; at < shades.length; at += 3) {
          const points = [], rgbs = [], ns = [], ts = [];
          for (let corner = at; corner < at + 3; corner++) {
            const i = corner * 3, shade = shades[corner] ?? 1;
            points.push(place(positions[i] ?? 0, positions[i + 1] ?? 0, positions[i + 2] ?? 0));
            rgbs.push([tint[0] * shade, tint[1] * shade, tint[2] * shade]);
            const nx = normals[i] ?? 0, nz = normals[i + 2] ?? 0;
            ns.push([nx * c + nz * s, normals[i + 1] ?? 0, -nx * s + nz * c]); ts.push([uvs[corner * 2] ?? 0, uvs[corner * 2 + 1] ?? 0]);
          }
          w.triChannels(row.role, points, rgbs, ns, ts);
        }
      }
      for (const { at, slot } of source.emitters) w.lanternEmitter?.(place(at[0], at[1], at[2]), [...colourOf(family, model, slot)]);
    },
    /** whether this kit has a family */
    has(family) { return families.has(family); },
    /** how many variants a family has */
    variants(family) { const model = families.get(family); if (model === undefined) throw new Error(`open-plots kit: no family ${family}`); return model.variants.length; },
  });
}
