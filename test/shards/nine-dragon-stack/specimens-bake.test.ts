// G285: Nine Dragon's specimens bake (generators/specimens.ts → world/specimens.ts). The stale gate (the generator's bytes =
// the committed stamps = the shipped bins), live-vs-baked byte parity for every key, and every code model building its
// every variant from the bakes as the live builders drew it.
import { describe, expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- The stale gate hashes the committed bakes' bytes.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- The stale gate reads the committed bakes the page loads.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- The committed bakes are zlib streams the page inflates.
import { inflateSync } from 'node:zlib';
// oxlint-disable-next-line import/no-nodejs-modules -- The bake-vs-live cases run on the platform the bakes were recorded on (Linux libm differs in the last ulp).
import { platform } from 'node:process';
import { BufferAttribute, BufferGeometry, type Group, Mesh, MeshBasicMaterial, ShaderMaterial, Vector3 } from 'three';
import { bakeNineSpecimens, bootSpecimen, specimenRecipes } from '../../../src/shards/nine-dragon-stack/generators/specimens';
import { SpecimenBake, specimensStamp } from '../../../src/shards/nine-dragon-stack/world/specimens';
import { LayoutBake } from '../../../src/shards/nine-dragon-stack/world/layoutBake';
import type { CanopyLump } from '../../../src/shards/nine-dragon-stack/world/banyanPlan';
import { ndModelContext } from '../../../src/shards/nine-dragon-stack/world/modelLook';
import { paramsOf, type ModelDef, type ModelPart } from '../../../src/engine/models/model';
import { Rng } from '../../../src/engine/core/rng';
import { hawkerStallModel, noodleStallModel } from '../../../src/shards/nine-dragon-stack/models/stalls';
import { diningPavilion, marketBooth, parasolTable } from '../../../src/shards/nine-dragon-stack/models/market';
import { paifang } from '../../../src/shards/nine-dragon-stack/models/paifang';
import { banyan, earthGodShrine, kowloonSteleModel } from '../../../src/shards/nine-dragon-stack/models/banyan';
import { brassDragonHook, drumStool, inkFigure, mahjongTableModel, parkedScooter } from '../../../src/shards/nine-dragon-stack/models/inKit';
import { laundryLineModel } from '../../../src/shards/nine-dragon-stack/models/laundry';
import { lampPostModel, lotusPostModel } from '../../../src/shards/nine-dragon-stack/models/bridgePosts';
import { landingPlanterModel } from '../../../src/shards/nine-dragon-stack/models/landingPlanter';
import { lotusFinial } from '../../../src/shards/nine-dragon-stack/models/lotusFinial';
import { wellBalustrade } from '../../../src/shards/nine-dragon-stack/models/wellBalustrade';
import { balustradePanel } from '../../../src/shards/nine-dragon-stack/models/balustradePanel';
import { airConBox, galleryPlant } from '../../../src/shards/nine-dragon-stack/models/wallKit';
import { cableGondola, monorailTrain } from '../../../src/shards/nine-dragon-stack/models/movers';
import { FACADE_BAKED, FACADE_MODELS } from '../../../src/shards/nine-dragon-stack/models/facade';

const sha = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
const shipped = (file: string): Uint8Array => new Uint8Array(inflateSync(readFileSync(new URL(`../../../public/assets/nine-dragon/baked/${file}`, import.meta.url))));

/** the world's banyan plan as the committed layout bake holds it (its own stale gate keeps it current) */
function lumps(): CanopyLump[] {
  const plan = new LayoutBake(shipped('layout.bin')).rows.banyan;
  const vec = (a: readonly [number, number, number]): Vector3 => new Vector3(a[0], a[1], a[2]);
  return plan === null ? [] : plan.lumps.map((l) => ({ c: vec(l.c), r: vec(l.r), up: l.up, seed: l.seed, wash: l.wash }));
}

/** a geometry's every attribute and its index as raw bytes (hashed), with the attribute kinds and bounds */
function fingerprint(g: BufferGeometry): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, a] of Object.entries(g.attributes)) {
    if (!(a instanceof BufferAttribute)) throw new Error(name);
    out[name] = `${a.array.constructor.name}/${String(a.itemSize)}/${String(a.normalized)}/${String('isFloat16BufferAttribute' in a)}/${sha(new Uint8Array(a.array.buffer, a.array.byteOffset, a.array.byteLength))}`;
  }
  const i = g.index;
  if (i !== null) out['index'] = `${i.array.constructor.name}/${sha(new Uint8Array(i.array.buffer, i.array.byteOffset, i.array.byteLength))}`;
  if (g.boundingSphere === null) g.computeBoundingSphere();
  out['sphere'] = JSON.stringify(g.boundingSphere);
  out['box'] = JSON.stringify(g.boundingBox);
  return out;
}

describe('Nine Dragon specimens bake (G285)', () => {
  const plan = lumps();
  const boot = shipped('specimens.bin'), explorer = shipped('specimens-explorer.bin');

  it.runIf(platform === 'darwin')('is current: the generator rebakes the shipped bins byte for byte, and the stamps name them', () => {
    const bins = bakeNineSpecimens(plan);
    const stamp = specimensStamp();
    expect(sha(bins.boot)).toBe(stamp.boot.bin);
    expect(sha(bins.explorer)).toBe(stamp.explorer.bin);
    expect(sha(boot)).toBe(stamp.boot.bin);
    expect(sha(explorer)).toBe(stamp.explorer.bin);
    expect(boot.length).toBe(stamp.boot.bytes);
    expect(explorer.length).toBe(stamp.explorer.bytes);
  });

  it.runIf(platform === 'darwin')('reads back every key as the live builders build it: attribute types and bytes, index, bounds', () => {
    const bakes = { boot: new SpecimenBake(boot, 'boot'), explorer: new SpecimenBake(explorer, 'explorer') };
    const recipes = specimenRecipes(plan);
    expect(recipes.length).toBeGreaterThan(40);
    for (const [key, build] of recipes) {
      const bake = bootSpecimen(key) ? bakes.boot : bakes.explorer;
      expect(fingerprint(bake.geometry(key)), key).toEqual(fingerprint(build()));
    }
    // the world's crown is there (the plan has lumps), and the page's take drops it after its one read
    expect(bakes.boot.has('canopy:cards')).toBe(true);
    bakes.boot.take('canopy:cards');
    expect(bakes.boot.has('canopy:cards')).toBe(false);
  });

  it('every code model builds every variant from the bakes, as the bake holds it', () => {
    const nd = ndModelContext(null);
    const mat = new ShaderMaterial();
    nd.look.mat = mat;
    nd.look.canopy = { core: new MeshBasicMaterial(), cards: new MeshBasicMaterial(), depth: new MeshBasicMaterial() };
    nd.look.facade = { mat, small: new ShaderMaterial() };
    nd.look.specimens = new SpecimenBake(boot, 'boot');
    nd.look.explorer = new SpecimenBake(explorer, 'explorer');
    let parts = 0;
    const check = <P extends object>(model: ModelDef<P>): void => {
      for (const variant of [undefined, ...(model.variants ?? []).map((v) => v.id)]) {
        const built = model.build(nd.ctx, paramsOf(model, variant, undefined), new Rng(0));
        if (!Array.isArray(built)) throw new Error(`${model.id} ${String(variant)}: not its parts`);
        for (const part of built as readonly ModelPart[]) { expect(part.geometry.getAttribute('position').count).toBeGreaterThan(0); parts++; }
      }
    };
    check(hawkerStallModel); check(noodleStallModel); check(diningPavilion); check(marketBooth); check(parasolTable); check(paifang); check(banyan);
    check(earthGodShrine); check(kowloonSteleModel); check(brassDragonHook); check(drumStool); check(inkFigure); check(mahjongTableModel); check(parkedScooter);
    check(laundryLineModel); check(lampPostModel); check(lotusPostModel); check(landingPlanterModel); check(lotusFinial); check(wellBalustrade);
    check(balustradePanel); check(airConBox); check(galleryPlant); check(cableGondola); check(monorailTrain);
    for (const model of [...Object.values(FACADE_MODELS), ...Object.values(FACADE_BAKED)]) {
      check(model);
      for (const lod of model.lods ?? []) { const far = lod.build(nd.ctx, model.defaults, new Rng(0)); if (Array.isArray(far)) parts += far.length; }
    }
    expect(parts).toBeGreaterThan(40);
  });

  it('an Explorer specimen asked before its bake is in is a group that fills when it lands', async () => {
    const nd = ndModelContext(null);
    nd.look.mat = new ShaderMaterial();
    nd.look.specimens = new SpecimenBake(boot, 'boot');
    let land: (b: SpecimenBake) => void = () => undefined;
    nd.look.explorer = new Promise<SpecimenBake>((resolve) => { land = resolve; });
    const built = noodleStallModel.build(nd.ctx, noodleStallModel.defaults, new Rng(0));
    expect(Array.isArray(built)).toBe(false);
    land(new SpecimenBake(explorer, 'explorer'));
    await nd.look.explorer;
    await new Promise((resolve) => { setTimeout(resolve, 0); });
    if (Array.isArray(built)) throw new Error('not a group');
    const mesh = (built as Group).children[0]?.children[0];
    expect(mesh).toBeInstanceOf(Mesh);
    const geometry: unknown = mesh instanceof Mesh ? mesh.geometry : null;
    expect(geometry instanceof BufferGeometry ? geometry.boundingSphere?.radius ?? 0 : 0).toBeGreaterThan(1);
  });
});
