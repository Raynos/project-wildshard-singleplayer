import { BufferAttribute, Vector3 } from 'three';
import { SignAtlas, SignBuilder, type SignPlace } from './signAtlas';
import type { SignModelParams, SignStyle } from '../data/signTypes';
import { SIGN_COLOUR, SIGN_LAYOUT, SIGN_STYLES } from './signs';
import signRows from '../data/signView.json' with { type: 'json' };
import { neonSize } from './signMath';
import type { SignCallRow } from './contracts/signPlacement';

interface PackedGeometry { readonly attributes: Record<string, { width: number; data: string }>; readonly index: string; readonly sphere: number[] | null }
interface BakedSignAtlas extends ReturnType<SignAtlas['snapshot']> {
  readonly keys: Record<string, string>; readonly geometries: Record<string, PackedGeometry>;
  readonly placed: { p: Omit<SignPlace<SignStyle>, 'at' | 'normal'> & { at: number[]; normal: number[] }; w: number; h: number; neon: boolean }[];
  readonly lights: { at: number[]; color: number[]; w: number; h: number; power: number; spill: number }[];
}

/** Same cache key the Explorer has always used, now resolving a prepared primitive. */
export function specimenKey(p: SignModelParams): string {
  return `${signRows.model.key}:${p.style}:${p.text}:${p.color}:${p.ink ?? ''}:${String(p.vertical)}:${p.size}:${String(p.blade)}`;
}

/** Original call order: layout, then the seeded facade slots. No extra cells are allocated for specimens. */
export function bakeSignAtlasPage(tier: 'phone' | 'desktop', calls: readonly SignCallRow[]): BakedSignAtlas {
  const atlas = new SignAtlas<SignStyle>(SIGN_STYLES, { ...SIGN_LAYOUT[tier], ...SIGN_COLOUR[tier] });
  const builder = new SignBuilder(atlas);
  builder.calligraphy = { gain: signRows.model.tubeGain, add: p => neonSize(p.text, p.em, p.vertical) };
  const vec = (v: readonly number[]): Vector3 => new Vector3(v[0], v[1], v[2]);
  for (const call of calls) {
    if (call.k === 'place') builder.place({ ...call.p, at: vec(call.p.at), normal: vec(call.p.normal) }, null);
    else if (call.k === 'light') builder.light(vec(call.c), vec(call.r), vec(call.u), call.w, call.h, call.color, call.gain, call.mode, call.seed);
    else builder.tube(vec(call.a), vec(call.b), vec(call.f), call.width, call.color, call.gain, call.flicker);
  }
  const snapshot = atlas.snapshot();
  const base64 = (array: ArrayBufferView): string => {
    const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
    let raw = ''; for (let i = 0; i < bytes.length; i += 32768) raw += String.fromCodePoint(...bytes.subarray(i, i + 32768));
    return btoa(raw);
  };
  const serialize = (geometry: ReturnType<SignBuilder['build']>): PackedGeometry => {
    const attributes = Object.fromEntries(Object.entries(geometry.attributes).map(([name, attribute]) => {
      if (!(attribute instanceof BufferAttribute)) throw new Error('Nine sign has an interleaved attribute');
      return [name, { width: attribute.itemSize, data: base64(attribute.array) }];
    }));
    if (geometry.index === null) throw new Error('Nine sign has no original index');
    return { attributes, index: base64(geometry.index.array), sphere: geometry.boundingSphere === null ? null : [...geometry.boundingSphere.center, geometry.boundingSphere.radius] };
  };
  const geometries: Record<string, ReturnType<typeof serialize>> = { world: serialize(builder.build()) };
  const params: SignModelParams<SignStyle>[] = [];
  for (const { p, neon } of builder.placed) if (!neon) params.push({ ...p.spec, size: p.size, blade: p.blade === true,
    ...(p.board === undefined ? {} : { board: p.board }), ...(p.gain === undefined ? {} : { gain: p.gain }) });
  for (const variant of signRows.variants) {
    if (variant.params.style !== 'tube') params.push({ ...variant.params, blade: 'blade' in variant.params && variant.params.blade });
  }
  const keys: Record<string, string> = {};
  for (const p of params) {
    const key = specimenKey(p);
    if (keys[key] !== undefined) continue;
    const b = new SignBuilder(atlas), name = `specimen-${Object.keys(keys).length}`;
    b.place({ at: new Vector3(), normal: new Vector3(0, 0, 1), size: p.size, spec: p, blade: p.blade,
      ...('board' in p ? { board: p.board } : {}), ...('gain' in p ? { gain: p.gain } : {}) }, null);
    keys[key] = name; geometries[name] = serialize(b.build());
  }
  if (JSON.stringify(atlas.snapshot().cells) !== JSON.stringify(snapshot.cells)) throw new Error('Explorer sign requested an unpainted runtime cell');
  const drone = new SignBuilder(atlas);
  drone.light(new Vector3(1.3, 0.6, 1.3), new Vector3(1, 0, 0), new Vector3(0, 1, 0), 0.35, 0.35, 0xff3b30, 10, 2, 0.1);
  drone.light(new Vector3(-1.3, 0.6, -1.3), new Vector3(1, 0, 0), new Vector3(0, 1, 0), 0.35, 0.35, 0xffffff, 10, 2, 0.6);
  drone.light(new Vector3(0, -0.3, 0.82), new Vector3(1, 0, 0), new Vector3(0, 1, 0), 0.3, 0.2, 0x3fe6ff, 6, 1);
  geometries['drone'] = serialize(drone.build());
  const placed: BakedSignAtlas['placed'] = [], lights: BakedSignAtlas['lights'] = [];
  for (const { p, ...rest } of builder.placed) placed.push({ ...rest, p: { ...p, at: p.at.toArray(), normal: p.normal.toArray() } });
  for (const { at, color, ...rest } of builder.lights) lights.push({ ...rest, at: at.toArray(), color: color.toArray() });
  return { ...snapshot, keys, geometries, placed, lights };
}
declare global { interface Window { bakeNineSigns: typeof bakeSignAtlasPage } }
window.bakeNineSigns = bakeSignAtlasPage;
