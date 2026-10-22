import * as THREE from 'three';
import * as v from 'valibot';
import { unzlibSync } from 'fflate';
import type { SkyRig } from '@wildshard/engine/world/skyRig';
import { painterlyMaterial } from '@wildshard/engine/world/painterly';
import { isJsonData } from '@wildshard/format/json';
import { fetchLaneBake, readBakedGeometry, bakedGeometryBytes } from '../plugin/geometry';

const n = v.pipe(v.number(), v.finite()), id = v.pipe(v.string(), v.minLength(1));
const whole = v.pipe(n, v.integer(), v.minValue(0));
const geometry = v.strictObject({ attrs: v.array(v.tuple([id, v.picklist(['f32', 'f16', 'u16', 'i8', 'u8']), whole, v.boolean()])),
  count: whole, index: v.nullable(v.picklist(['u16', 'u32'])), indexCount: whole, box: v.boolean(), expand: v.boolean() });
const schema = v.pipe(v.unknown(), v.check(isJsonData), v.strictObject({
  binary: v.exactOptional(v.strictObject({ url: id, bytes: whole })),
  shapes: v.pipe(v.array(v.strictObject({ key: id, offset: whole, geometry })), v.maxLength(4096)),
  inline: v.pipe(v.array(v.strictObject({ key: id, data: id, geometry })), v.maxLength(4096)),
  labels: v.pipe(v.array(v.strictObject({ key: id, shape: id, name: id, width: whole, height: whole, data: id, rim: n })), v.maxLength(64)),
}));
const decode = (data: string): Uint8Array => unzlibSync(Uint8Array.from(atob(data), c => c.codePointAt(0) ?? 0));
const books = new WeakMap<object, ShapeBook>();

/** Client-only prepared shapes and atlas lettering; identities, addresses and
 * painterly label policy are rows shared by live actors and their specimens. */
class ShapeBook {
  private readonly rows: v.InferOutput<typeof schema>;
  private bytes: Uint8Array | null = null;
  private pending: Promise<void> | undefined;
  constructor(input: unknown) {
    this.rows = v.parse(schema, input);
    const keys = [...this.rows.shapes, ...this.rows.inline].map(row => row.key);
    if (new Set(keys).size !== keys.length) throw new Error('Duplicate prepared shape');
    for (const row of this.rows.shapes) if (row.offset + bakedGeometryBytes(row.geometry) > (this.rows.binary?.bytes ?? 0)) throw new Error('Shape exceeds its binary');
  }
  use(bytes: Uint8Array): void {
    if (bytes.length !== this.rows.binary?.bytes) throw new Error('Shape binary byte count differs');
    this.bytes = bytes; this.pending = Promise.resolve();
  }
  load(): Promise<void> {
    const binary = this.rows.binary;
    this.pending ??= binary === undefined || this.rows.shapes.length === 0 ? Promise.resolve() : fetchLaneBake(binary.url).then(bytes => {
      this.use(bytes); return undefined;
    });
    return this.pending;
  }
  geometry(key: string): THREE.BufferGeometry {
    const inline = this.rows.inline.find(row => row.key === key), packed = this.rows.shapes.find(row => row.key === key);
    if (inline === undefined && packed === undefined) throw new Error(`Missing prepared shape ${key}`);
    const row = inline ?? packed; if (row === undefined) throw new Error('Missing shape row');
    const bytes = inline === undefined ? this.bytes : decode(inline.data);
    if (bytes === null) throw new Error('Shape binary is not loaded');
    if (inline !== undefined && bytes.length !== bakedGeometryBytes(row.geometry)) throw new Error('Inline shape byte count differs');
    const made = readBakedGeometry(bytes, inline === undefined ? packed?.offset ?? 0 : 0, row.geometry);
    if (!row.geometry.expand) return made;
    const flat = made.toNonIndexed(); made.dispose(); flat.computeBoundingBox(); flat.computeBoundingSphere(); return flat;
  }
  geometries(keys: readonly string[]): readonly (readonly [string, THREE.BufferGeometry])[] { return keys.map(key => [key, this.geometry(key)] as const); }
  lettering(sky: SkyRig, key: string): THREE.Mesh {
    const row = this.rows.labels.find(candidate => candidate.key === key); if (row === undefined) throw new Error('Missing prepared label');
    const bytes = decode(row.data); if (bytes.length !== row.width * row.height * 4) throw new Error('Label atlas byte count differs');
    const atlas = new THREE.DataTexture(bytes, row.width, row.height);
    atlas.colorSpace = THREE.SRGBColorSpace; atlas.anisotropy = 4; atlas.flipY = true; atlas.generateMipmaps = true;
    atlas.minFilter = THREE.LinearMipmapLinearFilter; atlas.magFilter = THREE.LinearFilter; atlas.needsUpdate = true;
    const material = painterlyMaterial(sky, { rim: row.rim }); material.map = atlas;
    const mesh = new THREE.Mesh(this.geometry(row.shape), material); mesh.name = row.name; mesh.receiveShadow = true; return mesh;
  }
}

/** Borrow a per-declaration immutable geometry book. No import installs a service;
 * calling load fetches its binary and every shape request decodes a fresh copy. */
export function shapeBook(input: object): ShapeBook {
  let book = books.get(input); if (book === undefined) { book = new ShapeBook(input); books.set(input, book); } return book;
}

