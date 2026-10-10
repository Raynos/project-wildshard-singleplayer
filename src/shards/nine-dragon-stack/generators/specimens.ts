/**
 * Nine Dragon's specimens bake (G285, SF72 "bake the code-built worlds"): every code-built model's geometry, built here at
 * build time in its own space exactly as the model's `build` drew it live (each variant and the defaults), the facade
 * kit's pieces, the movers,
 * the wall kit's pieces, the balustrade panel's far copy, and the world's banyan crown over the layout's plan. Written
 * as one binary (a JSON head of keyed geometry rows, then each geometry's typed arrays, ./bakeWrite.ts);
 * `src/shards/nine-dragon-stack/generators/bake-nine-layout.mjs` deflates them to public/assets/nine-dragon/baked/specimens.bin (what the page builds
 * at load) and specimens-explorer.bin (what only the Explorer's specimens draw) and stamps ../data/specimens.json; the page reads it by key (../world/specimens.ts). The stale gate and the live-vs-baked parity:
 * test/shards/nine-dragon-stack/specimens-bake.test.ts.
 */
import { type BufferGeometry, Vector3 } from 'three';
import { type ModelDef, paramsOf } from '@wildshard/engine/models/model';
import { Rng } from '@wildshard/engine/core/rng';
import { HAWKER, STALL } from '../layout';
import { Ctx } from '../world/ctx';
import { Kit } from '../world/kit';
import { KitX, merge } from '../world/hero/kitx';
import type { SignSink } from '../look/signs';
import { PLANTER, WELL_BALUSTRADE_AT as O, centred } from '../world/specimenDims';
import type { CanopyLump } from '../world/banyanPlan';
import { boothSet, hawkerStall, noodleStall, parasolSet, pavilionSet } from './stalls';
import { buildGate } from './gate';
import { BANYAN_TREE, buildBanyanTree, kowloonStele, shrine } from './banyan';
import { canopyGeometries } from './canopyGeometry';
import { acKit, dragonHook, laundry, person, scooter, stool } from './props';
import { WELL_RUNS, balustrade, carvedPanel, lotusBud, mahjongTable } from './squareParts';
import { lampPostStone, laundryLine as lowerLine, laundryPole, lotusPost } from './wellParts';
import { landingPlanter } from './landingPlanter';
import { PIECES } from './dressing';
import { droneKit, gondolaCabin, trainKit } from './moverKits';
import { geometryWriter } from './bakeWrite';
import { PIECES as FACADE_PIECES, PIECE_FAR } from './facadePieces';
import { PIECE_IDS } from '../world/facade/pieceIds';
import { PAIFANG, paifang } from '../models/paifang';
import { brassDragonHook, drumStool, inkFigure, parkedScooter } from '../models/inKit';
import { laundryLineModel } from '../models/laundry';
import { lotusPostModel } from '../models/bridgePosts';

/** the signs a specimen's builder would hang (a plaque, couplets, menu strips, eave neon): counted, not drawn — signs are
 *  their own models, drawn by the page's sign builder (the specimens' old `NoSigns`) */
class NoSigns implements SignSink {
  skipped = 0;
  place(): { w: number; h: number } { this.skipped++; return { w: 0, h: 0 }; }
  light(): void { this.skipped++; }
  tube(): void { this.skipped++; }
}

/** one Kit built at the origin */
const kit = (draw: (k: Kit) => void): BufferGeometry => { const k = new Kit(); draw(k); return k.build(); };

/** the params a model is built with in the Model Explorer: its defaults and every variant's */
function each<P extends object>(model: ModelDef<P>): P[] {
  return [model.defaults, ...(model.variants ?? []).map((v) => paramsOf(model, v.id, undefined))];
}

/** every specimen as [key, build], in bake order (`lumps`: the world's banyan plan, from the layout) */
export function specimenRecipes(lumps: readonly CanopyLump[]): [string, () => BufferGeometry][] {
  const out = new Map<string, () => BufferGeometry>();
  const add = (key: string, build: () => BufferGeometry): void => { if (!out.has(key)) out.set(key, build); };
  // the stalls (models/stalls.ts): each drawn alone at the origin into its own context's square kit
  const stall = (draw: (c: Ctx) => void): BufferGeometry => {
    const c = new Ctx(new NoSigns());
    draw(c);
    const k = c.kits.get('paifang'), x = c.kitxs.get('paifang');
    if (k === undefined || x === undefined) throw new Error('bake-nine-specimens: a stall drew nothing');
    return merge([k.build(), x.build()]);
  };
  add('stall:noodle', () => stall((c) => { noodleStall(c, new Rng(301), centred(STALL), 0); }));
  add('stall:hawker', () => stall((c) => { hawkerStall(c, new Rng(302), centred(HAWKER), 0); }));
  // the market sets' own (models/market.ts: the square's copies draw the layout's sets)
  add('set:booth', () => boothSet(new Rng(4101)));
  add('set:parasol', parasolSet);
  add('set:pavilion', pavilionSet);
  // the paifang's three gates (models/paifang.ts)
  for (const p of each(paifang)) add(`paifang:${p.kind}`, () => {
    const k = new Kit(), x = new KitX();
    buildGate(k, x, new NoSigns(), () => undefined, { x: 0, y: 0, z: 0, ...PAIFANG[p.kind] });
    return merge([k.build(), x.build()]);
  });
  // the banyan, its crown over its own plan, the shrine and the stele (models/banyan.ts)
  let tree: { geometry: BufferGeometry; crown: { cards: BufferGeometry; core: BufferGeometry } } | null = null;
  const banyan = (): NonNullable<typeof tree> => {
    if (tree === null) {
      const k = new Kit(), x = new KitX();
      const plan = buildBanyanTree(k, x, { x: 0, y: 0, z: 0, ...BANYAN_TREE });
      tree = { geometry: merge([k.build(), x.build()]), crown: canopyGeometries(plan.lumps) };
    }
    return tree;
  };
  add('banyan:tree', () => banyan().geometry);
  add('banyan:crown:cards', () => banyan().crown.cards);
  add('banyan:crown:core', () => banyan().crown.core);
  const built = (key: string, draw: (c: Ctx, k: Kit, x: KitX) => void): BufferGeometry => {
    const c = new Ctx(new NoSigns());
    const k = c.kit(key), x = c.kitx(key);
    draw(c, k, x);
    return merge([k.build(), x.build()]);
  };
  add('banyan:shrine', () => built('shrine', (c, k, x) => { shrine(c, k, x, 0, 0, 0); }));
  add('banyan:stele', () => built('stele', (c, k) => { kowloonStele(c, k, 0, 0, 0); }));
  // the models drawn into the kits (models/inKit.ts)
  for (const p of each(brassDragonHook)) add(`inkit:hook:${p.reach}`, () => kit((k) => { dragonHook(k, { hooks: [], hookMounts: [], inKit: [] }, new Vector3(0, 0, 0), new Vector3(0, 0, 1), p.reach); }));
  for (const p of each(drumStool)) add(`inkit:stool:${p.wash}`, () => kit((k) => { stool(k, 0, 0, 0, p.wash); }));
  for (const p of each(parkedScooter)) add(`inkit:scooter:${p.wash}`, () => kit((k) => { scooter(k, 0, 0, 0, 0, p.wash); }));
  add('inkit:mahjong', () => kit((k) => { mahjongTable(k, new Rng(5), 0, 0, 0, 0); }));
  for (const p of each(inkFigure)) add(`inkit:figure:${p.pose}:${String(p.umbrella)}`, () => kit((k) => { person(k, new Rng(11), 0, 0, 0, 0, p.pose, p.umbrella); }));
  // the laundry line's variants (models/laundry.ts)
  for (const p of each(laundryLineModel)) add(`laundry:${p.kind}:${p.span}:${p.rise}`, () => kit((k) => {
    const rng = new Rng(17), a = new Vector3(0, 0, 0), b = new Vector3(p.span, p.rise, 0);
    if (p.kind === 'gallery') laundry(k, rng, a, b);
    else if (p.kind === 'lower') lowerLine(k, rng, a, b);
    else laundryPole(k, rng, a, b, new Vector3(1, 0, 0));
  }));
  // the crossings' posts (models/bridgePosts.ts), the landing planter, the lotus finial, the Well's balustrade
  for (const p of each(lotusPostModel)) add(`bridge-post:lotus:${String(p.capped)}`, () => kit((k) => { lotusPost(k, 0, 0, 0, p.capped); }));
  add('bridge-post:lamp', () => kit((k) => { lampPostStone(k, 0, 0, 0, 1); }));
  add('landing-planter', () => kit((k) => { landingPlanter(k, new Rng(23), { x: 0, y: 0, z: 0, ...PLANTER }); }));
  add('lotus-finial', () => kit((k) => { lotusBud(k, 0, 0, 0); }));
  add('well-balustrade', () => kit((k) => { for (const r of WELL_RUNS) balustrade(k, r.at - O.x, r.a0 - O.z, r.a1 - O.z, 0, false, false, undefined, undefined, false); }));
  // the balustrade panel (models/balustradePanel.ts: the square's copies draw the layout's set) and its far copy
  add('panel', () => carvedPanel(false));
  add('panel:far', () => carvedPanel(true));
  // the wall kit's pieces (models/wallKit.ts)
  add('kit:plant', () => {
    const k = PIECES.plant().opaque;
    if (k === null) throw new Error('bake-nine-specimens: dressing.ts plant: no opaque kit');
    return k.build();
  });
  add('kit:ac', () => acKit().build());
  // the movers (models/movers.ts; the drone's lights are signs, drawn by the page)
  add('mover:train', () => trainKit().build());
  add('mover:gondola', () => gondolaCabin().build());
  add('mover:drone', () => droneKit().build());
  // the facade kit's pieces and their distance LODs (models/facade.ts; world/facade/batch.ts places them)
  for (const id of PIECE_IDS) add(`facade:${id}`, () => FACADE_PIECES[id]().build());
  for (const id of PIECE_IDS) { const far = PIECE_FAR[id]; if (far !== undefined) add(`facade:${id}:far`, () => far().build()); }
  // the world's banyan crown over the layout's plan (world/build.ts `buildCanopy`; none when the plan has no lumps)
  if (lumps.length > 0) {
    let crown: ReturnType<typeof canopyGeometries> | null = null;
    const world = (): ReturnType<typeof canopyGeometries> => { crown ??= canopyGeometries(lumps); return crown; };
    add('canopy:cards', () => world().cards);
    add('canopy:core', () => world().core);
  }
  return [...out];
}

/** what the page itself builds at load (world/specimens.ts `boot`); everything else only an Explorer specimen draws */
export const bootSpecimen = (key: string): boolean => /^(?:inkit:|mover:|canopy:|facade:)/u.test(key) || key === 'kit:plant' || key === 'kit:ac' || key === 'panel:far';

/** the specimens, built and written as the two bakes' binaries (inflated): the page's own and the Explorer's */
export function bakeNineSpecimens(lumps: readonly CanopyLump[]): { boot: Uint8Array; explorer: Uint8Array } {
  const recipes = specimenRecipes(lumps);
  return { boot: write(recipes.filter(([key]) => bootSpecimen(key))), explorer: write(recipes.filter(([key]) => !bootSpecimen(key))) };
}

function write(recipes: readonly (readonly [string, () => BufferGeometry])[]): Uint8Array {
  const writer = geometryWriter('bake-nine-specimens');
  const entries = recipes.map(([key, build]) => ({ key, geo: writer.add(build()) }));
  const json = new TextEncoder().encode(JSON.stringify({ version: 1, entries }));
  const head = Math.ceil((4 + json.length) / 4) * 4;
  const out = new Uint8Array(head + writer.blocks.reduce((n, b) => n + b.length, 0));
  new DataView(out.buffer).setUint32(0, json.length, true);
  out.set(json, 4);
  let at = head;
  for (const b of writer.blocks) { out.set(b, at); at += b.length; }
  return out;
}
