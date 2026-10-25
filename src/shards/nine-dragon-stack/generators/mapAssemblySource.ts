// Resting world assembly from the same author geometry and admitted placement
// records as boot. No renderer, live model, physics or shard runtime is loaded.
import { BufferGeometry, Float32BufferAttribute, Matrix4, PlaneGeometry, Quaternion, TorusGeometry, Vector3 } from 'three';
import { withPortableMath } from '@wildshard/commons/bake/portableMath';
import { MapAssembly, mapModelBytes } from '@wildshard/sdk/bake/mapAssembly';
import type { NineNativeAtlasSource } from './nativeSignAtlas';
import type { NineNativeGlyphSource } from './nativeGlyphs';
import type { NineNativeAtlas } from './nativeSignMetadata';
import type { WorldRows } from './sections';
import canopy from '../data/canopy.json' with { type: 'json' };
import lantern from '../data/lantern.json' with { type: 'json' };
import layoutPlan from '../data/layoutPlan.json' with { type: 'json' };
import sign from '../data/signView.json' with { type: 'json' };
import { nineLayoutSource } from './layout';
import { specimenRecipes } from './specimens';
import { banyanOut } from './banyanPlan';
import { worldRows } from './worldRows';
import { portalPlanRows } from './portalEntries';
import { MOVER_REST, MOVER_STAGES } from './moversView';
import { fixedKitRows, readFixedSlots } from './casts';
import { tintAbove } from './lods';
import { NeonText } from './neonGeometry';

/** Admitted native metadata and exact raw casts from the same source invocation. */
export interface NineMapAssemblyInputs {
  readonly casts: ReadonlyMap<string, Uint8Array>;
  readonly native: NineNativeAtlasSource;
  readonly glyphs: NineNativeGlyphSource;
  readonly read: (url: string) => Uint8Array;
}
export interface NineMapAssembly {
  readonly assembly: MapAssembly;
  readonly facade: WorldRows['facade']['drawn'];
}
const castModel = async (name: string, files: ReadonlyMap<string, Uint8Array>): Promise<BufferGeometry> => {
  const dyes: Readonly<Record<string, readonly [string, number]>> = { 'walker-oxblood': ['walker-dark', 0x9a2e1c], 'walker-blue': ['walker-dark', 0x34507e], 'walker-paper': ['walker-light', 0xb07a34] };
  const dye = dyes[name];
  const bytes = files.get(dye?.[0] ?? name);
  if (bytes === undefined) throw new Error(`Missing map cast ${name}`);
  const geometry = await mapModelBytes(bytes);
  if (dye === undefined) return geometry;
  const tinted = tintAbove(geometry, dye[1]); geometry.dispose(); return tinted;
};
const frame = (values: readonly number[], at: number): Matrix4 => new Matrix4().fromArray(values, at);
function atlasGeometry(source: NineNativeAtlas['desktop']['geometries'][string] | undefined, bytes: Uint8Array): BufferGeometry {
  if (source === undefined) throw new Error('Missing native map atlas geometry');
  const geometry = new BufferGeometry();
  for (const [key, name] of [['position', 'position'], ['aTint', 'color']] as const) {
    const attribute = source.attributes[key]; if (attribute === undefined) continue;
    geometry.setAttribute(name, new Float32BufferAttribute(new Float32Array(bytes.slice(attribute.data.byteOffset, attribute.data.byteOffset + attribute.data.byteLength).buffer), attribute.width));
  }
  geometry.setIndex(Array.from(new Uint32Array(bytes.slice(source.index.byteOffset, source.index.byteOffset + source.index.byteLength).buffer)));
  return geometry;
}

/** Assemble the original map from explicit owned bytes; no file handoff or ambient reader. */
export async function nineMapAssemblyFrom(inputs: NineMapAssemblyInputs, assembly = new MapAssembly()): Promise<NineMapAssembly> {
  const cast = (name: string): Promise<BufferGeometry> => castModel(name, inputs.casts);
  const atlas = inputs.native.atlas.desktop, atlasBytes = inputs.native.files.get(atlas.buffer);
  if (atlasBytes === undefined) throw new Error('Missing native map atlas geometry');
  const layout = withPortableMath(() => nineLayoutSource()), { rows, records } = layout;
  const world = await worldRows(rows, records, inputs.read);
  const recipes = new Map(specimenRecipes(banyanOut.plan?.lumps ?? []));
  const specimen = (key: string): BufferGeometry => { const build = recipes.get(key); if (build === undefined) throw new Error(`Missing map specimen ${key}`); return build(); };
  const local = (index: number): BufferGeometry => { const geometry = layout.geometries.at(index); if (geometry === undefined) throw new Error(`Missing map layout ${index}`); return geometry; };
  for (const row of [...rows.kits, ...rows.alphaKits]) if (row.geo !== null) assembly.add(`kit:${row.name}`, local(row.geo).clone());
  for (const row of canopy.draws) if (recipes.has(`canopy:${row.geometry}`) && !('transparent' in row.state && row.state.transparent === true && row.state.depthWrite === false))
    assembly.add(`canopy:${row.geometry}`, specimen(`canopy:${row.geometry}`));
  if (rows.shell !== null) assembly.add('facade-shell', local(rows.shell).clone());
  assembly.add('entries', await cast('entries-capped'));
  assembly.add('facade-signs', await cast('facade-signs'));
  for (const row of world.rows.sets) assembly.add(`set:${row.name}`, local(row.geo).clone(), row.frames.map(at => frame(world.records, at)));
  assembly.add('lions', await cast('lion'), world.rows.lions.map(at => frame(world.records, at)));
  for (const row of world.rows.facade.drawn) assembly.add(`facade:${row.id}`, specimen(`facade:${row.id}`),
    Array.from({ length: row.count }, (_, i) => frame(world.records, row.poses + i * 19)));

  const c = rows.counts;
  let at = (c.walkers + c.sitters) * 16;
  const matrices = (n: number): Matrix4[] => Array.from({ length: n }, () => { const matrix = frame(records, at); at += 16; return matrix; });
  const lanterns = matrices(c.lanterns), acs = matrices(c.acs);
  at += c.hooks * 3;
  const mounts = Array.from({ length: c.hookMounts }, () => {
    const ring = new Vector3().fromArray(records, at), out = new Vector3().fromArray(records, at + 3); at += 6; return { ring, out };
  });
  at += c.steam * 3 + c.pieces * 19;
  const windows = Array.from({ length: c.windows }, () => { const matrix = frame(records, at); at += 26; return matrix; });
  const quad = new PlaneGeometry(1, 1); quad.translate(0, .5, 0); assembly.add('facade-windows', quad, windows);
  for (const [key, count] of rows.inst) {
    const poses = Array.from({ length: count }, () => { const matrix = frame(records, at); at += 19; return matrix; });
    assembly.add(`wall:${key}`, specimen(`kit:${key.slice(0, key.indexOf('@'))}`), poses);
  }
  assembly.add('air-conditioners', specimen('kit:ac'), acs);
  const fixed = fixedKitRows(readFixedSlots({ rows }));
  const hanging = [...lanterns, ...fixed.lanterns.map(row => frame(row, 0)), ...world.rows.portalLanterns.map(offset => frame(world.records, offset))];
  assembly.add('lanterns', specimen('lantern:near'), hanging.map(matrix => {
    const position = new Vector3(), scale = new Vector3(); matrix.decompose(position, new Quaternion(), scale);
    return new Matrix4().makeScale(scale.x, scale.x, scale.x).setPosition(position.add(new Vector3(0, -lantern.drop * scale.x, 0)));
  }));
  for (const { kind, crowd } of [{ kind: 'walker', crowd: world.rows.crowd.walkers }, { kind: 'sitter', crowd: world.rows.crowd.sitters }]) {
    for (const variant of new Set(crowd.map(row => row.variant))) assembly.add(`crowd:${kind}:${variant}`, await cast(`${kind}-${variant}`),
      crowd.filter(row => row.variant === variant).map(row => frame(world.records, row.matrix)));
  }
  const hook = await mapModelBytes(inputs.read('/assets/nine-dragon/lab/grapple/dragon-hook.glb'), 0, true), y = layoutPlan.Y0;
  const nearest = mounts.filter(m => m.ring.y > y - 23 && m.ring.y < y + 14)
    .sort((a, b) => a.ring.distanceToSquared(new Vector3(-16, y - 2, -24)) - b.ring.distanceToSquared(new Vector3(-16, y - 2, -24))).slice(0, 3);
  assembly.add('dragon-hooks', hook, nearest.map(m => new Matrix4().makeTranslation(m.ring.x, m.ring.y, m.ring.z)
    .multiply(new Matrix4().makeRotationY(Math.atan2(m.out.x, m.out.z))).multiply(new Matrix4().makeScale(.62, .62, .62)).multiply(new Matrix4().makeTranslation(.02, -.26, -.73))));
  // the movers where their view module poses them at its first frame (generators/moversView.ts)
  for (const [i, p] of MOVER_REST.entries()) {
    const id = MOVER_STAGES[i], matrix = new Matrix4().makeRotationY(p.yaw).setPosition(p.x, p.y, p.z);
    assembly.add(`mover:${id}`, specimen(i === 0 ? 'mover:train' : i === 1 ? 'mover:gondola' : 'mover:drone'), [matrix]);
    if (i > 1) assembly.add(`mover-signs:${id}`, atlasGeometry(atlas.geometries['drone'], atlasBytes), [matrix]);
  }
  const portals = portalPlanRows();
  assembly.add('portal-rings', new TorusGeometry(portals.ring.r, portals.ring.tube, 8, 48), [...portals.decks, portals.square].map(p =>
    new Matrix4().makeRotationY(Math.atan2(p.nx, p.nz)).setPosition(p.x, p.y + portals.ring.lift, p.z)));
  // The ordinary atlas's world geometry includes lightboxes and lamps. The
  // depth-off tubes, mist, steam, streaks and portal swirls are omitted by
  // the browser height pass as well; the sky and screen are above the cut.
  assembly.add('signs', atlasGeometry(atlas.geometries['world'], atlasBytes));
  const glyphs = inputs.glyphs.glyphs.desktop;
  const field = { layout: glyphs.layout, rect: (ch: string) => { const rect = glyphs.rects[ch]; if (rect === undefined) throw new Error(`Missing map glyph ${ch}`); return rect; } };
  const neon = new NeonText(sign.model.tubeGain, field);
  for (const { p, neon: calligraphy } of atlas.placed) if (calligraphy) neon.add({ text: p.spec.text, color: p.spec.color, vertical: p.spec.vertical, em: p.size,
    at: new Vector3(Number(p.at[0]), Number(p.at[1]), Number(p.at[2])), facing: new Vector3(Number(p.normal[0]), Number(p.normal[1]), Number(p.normal[2])), twoSided: p.blade === true,
    gain: ((p.gain ?? sign.model.calligraphyGain) / sign.model.calligraphyGain) * sign.model.tubeGain, flicker: p.flicker ?? 0, clear: p.clear ?? 0 });
  const calligraphy = neon.build(); assembly.add('neon-boards', calligraphy.boards); calligraphy.tubes.dispose();
  for (const geometry of layout.geometries) geometry.dispose();
  return { assembly, facade: world.rows.facade.drawn };
}

