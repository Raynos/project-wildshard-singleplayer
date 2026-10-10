import { describe, expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- The stale gate hashes the committed bake's bytes.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- The stale gate reads the committed bake the client loads.
import { readdirSync, readFileSync } from 'node:fs';
import { InstancedMesh, Matrix4, Mesh, Vector3, type Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { colliderRows } from '@wildshard/sdk/bake/kinds';
import { bakeSkyWinchHouse, buildWinchHouse } from '../../../src/shards/far-reach/generators/winchHouse';
import { bakeSkyRoost, roost } from '../../../src/shards/far-reach/generators/roost';
import { bakeSkyDocks, buildSkyDocks } from '../../../src/shards/far-reach/generators/skyDock';
import { bakeSkyCrown, buildCrownSet } from '../../../src/shards/far-reach/generators/crown';
import { bakeSkyMill, buildMillSet } from '../../../src/shards/far-reach/generators/mill';
import { bakeSkyBookStand, buildBookStandSet } from '../../../src/shards/far-reach/generators/bookStand';
import { bakeSkyKnolls, buildKnolls, knollHull } from '../../../src/shards/far-reach/generators/knoll';
import { bakeSkyGeometries, buildGeometries } from '../../../src/shards/far-reach/generators/geometries';
import { bakeSkySeaTexture } from '../../../src/shards/far-reach/generators/seaTexture';
import { seaTexture } from '../../../src/shards/far-reach/look/cloudSea';
import seaRows from '../../../src/shards/far-reach/data/seaTexture.json' with { type: 'json' };
import { bakeSkyCards } from '../../../src/shards/far-reach/generators/skyCards';
import skyCardRows from '../../../src/shards/far-reach/data/skyCards.json' with { type: 'json' };
import { SKY_CARD_FRAGMENTS, SKY_CARD_PROGRAMS } from '../../../src/shards/far-reach/data/skyCardsLook';
import { cardField, cardFieldRow, cardGroup, cardGroupRow } from '@wildshard/sdk/looks/cardField';
import { ShaderFamily } from '@wildshard/sdk/looks/shaderFamily';
import { skyBakedPiece, skyKnollHulls } from '../../../src/shards/far-reach/world/baked';
import { BAKED_PIECES } from '../../../src/shards/far-reach/boot/files';
import { ISLES, KNOLLS, STEP, WINCH_HOUSE } from '../../../src/shards/far-reach/data/layout';
import winchHouse from '../../../src/shards/far-reach/data/winchHouse.json' with { type: 'json' };
import roostRows from '../../../src/shards/far-reach/data/roost.json' with { type: 'json' };
import dockRows from '../../../src/shards/far-reach/data/docks.json' with { type: 'json' };
import crownRows from '../../../src/shards/far-reach/data/crown.json' with { type: 'json' };
import millRows from '../../../src/shards/far-reach/data/mill.json' with { type: 'json' };
import bookRows from '../../../src/shards/far-reach/data/bookStand.json' with { type: 'json' };
import knollRows from '../../../src/shards/far-reach/data/knolls.json' with { type: 'json' };
import geometryRows from '../../../src/shards/far-reach/data/geometries.json' with { type: 'json' };

const folder = new URL('../../../public/assets/far-reach/baked/', import.meta.url);
const instanced = (node: Object3D): node is InstancedMesh => node instanceof InstancedMesh;
const isMesh = (node: Object3D): node is Mesh => node instanceof Mesh;
const sha = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

async function nodesOf(piece: string, kinds: readonly { name: string }[]): Promise<Map<string, InstancedMesh>> {
  const bytes = readFileSync(new URL(`${piece}.glb`, folder)), gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const nodes: InstancedMesh[] = []; gltf.scene.traverse((node) => { if (instanced(node)) nodes.push(node); });
  return new Map(kinds.map((kind, i) => { const node = nodes[i]; if (node === undefined) throw new Error('missing node'); return [kind.name, node]; }));
}

describe('Sky Reach bakes its code-built world offline (SHARD-PLATFORM SF72)', () => {
  it('every committed piece is byte-exact against its generator (the stale gate: rerun scripts/bake-sky-world.mjs)', () => {
    const pieces = [['winch-house', bakeSkyWinchHouse(), winchHouse], ['roost', bakeSkyRoost(), roostRows], ['docks', bakeSkyDocks(), dockRows], ['crown', bakeSkyCrown(), crownRows], ['mill', bakeSkyMill(), millRows], ['book-stand', bakeSkyBookStand(), bookRows], ['knolls', bakeSkyKnolls(), knollRows], ['geometries', bakeSkyGeometries(), geometryRows]] as const;
    for (const [piece, { glb, ...rows }, committed] of pieces) {
      expect({ glb: sha(glb), ...rows }).toEqual(committed);
      expect(sha(new Uint8Array(readFileSync(new URL(`${piece}.glb`, folder))))).toBe(committed.glb);
    }
    // the folder holds exactly this bake: no orphan GLB from an older bake ships
    expect(readdirSync(folder).filter((name) => name.endsWith('.glb')).sort()).toEqual(BAKED_PIECES.map((piece) => `${piece}.glb`).sort());
  });

  it('the winch house draws every built mesh as one instance of a kind, its shack parts in their shaders with their `shk` channel', async () => {
    const drawn = skyBakedPiece('winch-house', await nodesOf('winch-house', winchHouse.kinds)), built = buildWinchHouse(), meshes: Mesh[] = [];
    // the client stands the piece on the step (world/build.ts); the parts keep the house's own frame
    drawn.root.position.set(WINCH_HOUSE.x, STEP.y, WINCH_HOUSE.z); drawn.root.updateMatrixWorld(true);
    // the builder's own box (its `-0` yaw is the rows' `0`)
    expect(drawn.colliders).toEqual(colliderRows(built.colliders));
    built.group.updateMatrixWorld(true); built.group.traverse((o) => { if (isMesh(o)) meshes.push(o); });
    const kinds = drawn.root.children.filter(instanced);
    expect(kinds.length).toBe(winchHouse.kinds.length);
    expect(kinds.reduce((n, m) => n + m.count, 0)).toBe(meshes.length);
    // fewer draws than meshes, never multi-draw: one instanced mesh per kind
    expect(kinds.length).toBeLessThan(meshes.length);
    for (const mesh of kinds) {
      const shack = mesh.geometry.hasAttribute('shk');
      expect(Array.isArray(mesh.material)).toBe(false);
      // a shack kind is drawn in its pattern shader, which reads `shk`
      const material = mesh.material, patched = !Array.isArray(material) && material.defines !== undefined && 'SHK_MODE' in material.defines;
      expect(patched).toBe(shack);
      // the soups draw unindexed, as built (the GLB's identity index dropped)
      if (shack) expect(mesh.geometry.getIndex()).toBe(null);
    }
    // every vertex of every built mesh lands where an instance of its kind puts it (≤ 1e-4 m after the TRS round trip)
    const all = kinds.flatMap((o) => Array.from({ length: o.count }, (_, i) => { const t = new Matrix4(); o.getMatrixAt(i, t); return { o, t: t.premultiply(drawn.root.matrixWorld) }; }));
    const want = new Vector3(), got = new Vector3();
    for (const mesh of meshes) {
      const p = mesh.geometry.getAttribute('position');
      const hit = all.find(({ o, t }) => {
        const q = o.geometry.getAttribute('position'); if (q.count !== p.count) return false;
        for (let v = 0; v < p.count; v += Math.max(1, Math.floor(p.count / 16))) {
          want.fromBufferAttribute(p, v).applyMatrix4(mesh.matrixWorld);
          if (got.fromBufferAttribute(q, v).applyMatrix4(t).distanceTo(want) >= 1e-4) return false; // a box's unit corner scales onto its own
        }
        return true;
      });
      expect(hit).toBeDefined();
    }
  });

  it('the Roost draws every built mesh and stick / feather instance as an instance of a kind, the tints restored', async () => {
    const drawn = skyBakedPiece('roost', await nodesOf('roost', roostRows.kinds)), built = roost();
    drawn.root.updateMatrixWorld(true); built.group.updateMatrixWorld(true);
    expect(drawn.colliders).toEqual(colliderRows(built.colliders));
    // the built pieces: each plain mesh once, each instance of an instanced mesh with its colour
    const want: { geometry: Mesh['geometry']; matrix: Matrix4; color?: number[] }[] = [];
    built.group.traverse((o) => {
      if (instanced(o)) for (let i = 0; i < o.count; i++) { const m = new Matrix4(); o.getMatrixAt(i, m); want.push({ geometry: o.geometry, matrix: m.premultiply(o.matrixWorld), ...(o.instanceColor === null ? {} : { color: [o.instanceColor.getX(i), o.instanceColor.getY(i), o.instanceColor.getZ(i)] }) }); }
      else if (isMesh(o)) want.push({ geometry: o.geometry, matrix: o.matrixWorld });
    });
    const kinds = drawn.root.children.filter(instanced);
    expect(kinds.length).toBe(roostRows.kinds.length);
    expect(kinds.reduce((n, m) => n + m.count, 0)).toBe(want.length);
    const all = kinds.flatMap((o) => Array.from({ length: o.count }, (_, i) => { const t = new Matrix4(); o.getMatrixAt(i, t); return { o, i, t: t.premultiply(drawn.root.matrixWorld) }; }));
    const a = new Vector3(), b = new Vector3();
    for (const w of want) {
      const p = w.geometry.getAttribute('position');
      const hit = all.find(({ o, t }) => {
        const q = o.geometry.getAttribute('position'); if (q.count !== p.count) return false;
        for (let v = 0; v < p.count; v += Math.max(1, Math.floor(p.count / 16))) if (b.fromBufferAttribute(q, v).applyMatrix4(t).distanceTo(a.fromBufferAttribute(p, v).applyMatrix4(w.matrix)) >= 1e-4) return false;
        return true;
      });
      expect(hit).toBeDefined();
      if (hit !== undefined && w.color !== undefined) {
        const c = hit.o.instanceColor;
        expect(c === null ? null : [c.getX(hit.i), c.getY(hit.i), c.getZ(hit.i)]).toEqual(w.color);
      }
    }
  });

  it('the docks draw every built timber box and beacon as an instance of their kind, the timber tints restored', async () => {
    const drawn = skyBakedPiece('docks', await nodesOf('docks', dockRows.kinds)), built = buildSkyDocks();
    drawn.root.updateMatrixWorld(true);
    expect(drawn.colliders).toEqual(colliderRows(built.colliders));
    const kinds = drawn.root.children.filter(instanced);
    expect(kinds.map((k) => k.count)).toEqual([built.timber.count, built.beacon.count]);
    const a = new Matrix4(), b = new Matrix4(), corner = new Vector3(), want = new Vector3(), got = new Vector3();
    for (const [kind, from] of [[kinds[0], built.timber], [kinds[1], built.beacon]] as const) {
      if (kind === undefined) throw new Error('missing kind');
      const p = from.geometry.getAttribute('position'), q = kind.geometry.getAttribute('position');
      expect(q.count).toBe(p.count);
      for (let i = 0; i < from.count; i++) {
        // every vertex where the builder put it (≤ 1e-4 m after the TRS round trip)
        from.getMatrixAt(i, a); kind.getMatrixAt(i, b); b.premultiply(drawn.root.matrixWorld);
        for (let v = 0; v < p.count; v++) expect(got.fromBufferAttribute(q, v).applyMatrix4(b).distanceTo(want.copy(corner.fromBufferAttribute(p, v)).applyMatrix4(a))).toBeLessThan(1e-4);
        // the timber's colour is the builder's own, exactly; the beacon has none
        const c = from.instanceColor, d = kind.instanceColor;
        expect(d === null ? null : [d.getX(i), d.getY(i), d.getZ(i)]).toEqual(c === null ? null : [c.getX(i), c.getY(i), c.getZ(i)]);
      }
    }
  });
  it('the crown arena, the mill, the book stand, the knolls and the instanced shapes draw every built kind exactly: each instance where the builder put it, every channel equal', async () => {
    const pieces = [['crown', crownRows.kinds, buildCrownSet().kinds], ['mill', millRows.kinds, buildMillSet()], ['book-stand', bookRows.kinds, buildBookStandSet()], ['knolls', knollRows.kinds, buildKnolls().kinds], ['geometries', geometryRows.kinds, buildGeometries()]] as const;
    for (const [piece, rows, built] of pieces) {
      const drawn = skyBakedPiece(piece, await nodesOf(piece, rows));
      expect([...drawn.kinds.keys()]).toEqual(built.map(([name]) => name));
      const a = new Matrix4(), b = new Matrix4();
      for (const [name, from] of built) {
        const kind = drawn.kinds.get(name); if (kind === undefined) throw new Error(`${piece}: missing kind ${name}`);
        expect(kind.count).toBe(from.count);
        // every vertex channel the builder made (positions, normals, uvs, colours, the canvas's `farCloth`), bit for bit as float32
        for (const [channel, attribute] of Object.entries(from.geometry.attributes)) {
          const got = kind.geometry.getAttribute(channel);
          expect(kind.geometry.hasAttribute(channel), `${piece}.${name}.${channel}`).toBe(true);
          expect(Array.from(got.array)).toEqual(Array.from(new Float32Array(attribute.array)));
        }
        // the triangles as built (a soup draws unindexed, an indexed one keeps its index)
        expect(kind.geometry.getIndex() === null ? null : Array.from(kind.geometry.getIndex()?.array ?? [])).toEqual(from.geometry.getIndex() === null ? null : Array.from(from.geometry.getIndex()?.array ?? []));
        for (let i = 0; i < from.count; i++) {
          from.getMatrixAt(i, a); kind.getMatrixAt(i, b);
          b.elements.forEach((n, k) => { expect(Math.abs(n - (a.elements[k] ?? Number.NaN))).toBeLessThan(1e-6); });
        }
      }
    }
    expect(skyBakedPiece('crown', await nodesOf('crown', crownRows.kinds)).colliders).toEqual(colliderRows(buildCrownSet().colliders));
    // each knoll's hull is the builder's own points (float32), on its island's deck
    const hulls = skyKnollHulls();
    for (const k of KNOLLS) {
      const isle = ISLES.find((i) => i.id === k.isle);
      expect(hulls.get(k.id)).toEqual({ kind: 'hull', x: k.x, y: isle?.y, z: k.z, points: knollHull(k), surface: 'grass' });
    }
  });
  it('the cloud sea texture is its generator\'s bytes (the stale gate) and the client uploads exactly them', () => {
    const rows = bakeSkySeaTexture();
    expect(rows).toEqual(seaRows);
    const tex = seaTexture(), data: unknown = tex.image.data;
    expect(data instanceof Uint8Array ? Array.from(data) : null).toEqual(Array.from(atob(rows.rgba), (c) => c.codePointAt(0)));
    expect([tex.image.width, tex.image.height]).toEqual([rows.size, rows.size]);
    tex.dispose();
  });
  it('the sky cards (cumulus field, sun glow) are the generator rows (the stale gate) and build from the SDK card field', () => {
    const rows = bakeSkyCards();
    expect(rows).toEqual(skyCardRows);
    const cards = new ShaderFamily(SKY_CARD_FRAGMENTS, SKY_CARD_PROGRAMS), sun = { uSun: { value: new Vector3(0, 0.1, -1).normalize() } };
    const glow = cardGroup(cards, cardGroupRow(cards, skyCardRows.sunGlow), sun);
    expect([glow.group.name, glow.group.children.length, glow.materials.length]).toEqual(['far.sun-glow', 13, 13]);
    const puffs = cardField(cards, cardFieldRow(cards, skyCardRows.cumulus), sun);
    expect([puffs.name, puffs.renderOrder, puffs.geometry.instanceCount]).toEqual(['far.cumulus', -5, puffs.geometry.getAttribute('aAt').count]);
    glow.geometry.dispose(); for (const m of glow.materials) m.dispose(); puffs.geometry.dispose(); puffs.material.dispose();
  });
});
