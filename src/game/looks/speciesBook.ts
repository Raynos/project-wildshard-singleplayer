import { thinkCrowdGuard } from '../ambient/crowdPage';
import { eliteAct, eliteDamageMul, eliteThink } from '../quest/elitePage';
import { DirectedSpecies } from '../population/directedSpecies';
import { groupSpecies } from '../population/groupSpecies';
import { numericCreaturePose } from '../plugin/channelPrograms';
import { poseRidingEnvelopes, type RidingPresentationRows } from '../riding/presentation';
import { wildEnv } from '../population/pageGroups';
import type { AnimalRigContext } from '@wildshard/engine/entities/animalRig';
import * as v from 'valibot';
import { packedCreatureBodies,type BakedGeometryRow } from '../plugin/geometry';
import { productRiggedHulls } from './riggedHulls';
import { HullLookBookSchema, PackedCreatureLooksSchema, type CompactSpeciesBodiesRows } from '@wildshard/format/speciesLooks';
import type { NativeSpeciesLookBookRows } from '@wildshard/format/speciesBookRows';
import type { SpeciesLook } from '@wildshard/engine/entities/species/look';
import { painterlyMaterial } from '@wildshard/engine/world/painterly';
import { hasSpecies, registerSpecies, speciesDef, type BoneDef, type SpeciesDef, type VariantDef } from '@wildshard/engine/entities/species/registry';
import { roamingBossDamage } from '../boss/roamingProjection';
import { limbAnimation } from '../animation/limbView';
import { BOAR_LOOK } from '../systems/species/view/boar';
import { BEAR_LOOK } from '../systems/species/view/bear';

/** Client-only hull projection on shared fauna or declared skeletons. The data
 * book owns coats and post-poses; the existing hull cache owns every asset. */
export class HullLookBook {
  private readonly book;
  private readonly hulls;
  private readonly bodies;
  constructor(input: unknown) {
    this.book = v.parse(HullLookBookSchema, input);
    if (new Set(this.book.rows.map(row => row.kind)).size !== this.book.rows.length
      || new Set(this.book.rows.map(row => row.id)).size !== this.book.rows.length
      || this.book.rows.some(row => row.base === 'definition' && this.book.definitions[row.kind] === undefined)) throw new Error('Invalid hull look references');
    const packed = this.book.body ?? (this.book.compactBody === undefined ? undefined : expandCompactBodies(this.book.compactBody));
    this.hulls = packed === undefined ? productRiggedHulls(this.book.slug) : undefined;
    this.bodies = packed === undefined ? undefined : packedCreatureBodies(packed);
  }
  /** The same packed owner supplies custom rigs and ordinary fauna without retaining another bake. */
  get packed(): ReturnType<typeof packedCreatureBodies> { if (this.bodies === undefined) throw new Error('Look book has no packed bodies'); return this.bodies; }
  /** Gameplay fields retain their authored representation, with a fresh rest body per call. */
  definition(kind: string): SpeciesDef {
    const source = this.book.definitions[kind]; if (source === undefined) throw new Error('Missing hull species definition');
    const { body, id: _id, ...definition } = source;
    return { ...definition, build: () => structuredClone(body) };
  }
  /** G571: register each declared derived species once, on its own custom limb rig; its think is external (its owning
   *  fight drives it) and its damage the roaming boss's rule. */
  registerDerived(): void {
    for (const [kind, row] of Object.entries(this.book.derived)) {
      if (hasSpecies(kind)) continue;
      const rig = row.rig, coat: VariantDef = row.coat;
      registerSpecies({ ...this.definition(row.from), ...row.fields, kind, label: row.label, variants: [coat],
        think: () => undefined, damageMul: (actor, req) => roamingBossDamage(actor, req),
        rigContract: { skeleton: rig.skeleton, clips: [], sockets: rig.sockets }, rig: 'custom', animate: limbAnimation(rig.spec, rig.blend, rig.clips),
        build: () => ({ bones: structuredClone(rig.bones), furParts: [], hardParts: [], eyeParts: [], dims: structuredClone(rig.dims) }) });
    }
  }
  /** Resolve registered rigs only when requested, after their native owner installs them. */
  look(kind: string): SpeciesLook {
    const row = this.book.rows.find(entry => entry.kind === kind); if (row === undefined) throw new Error('Missing hull look');
    const base = row.base === 'boar' ? BOAR_LOOK : row.base === 'bear' ? BEAR_LOOK
      : row.base === 'definition' ? this.definition(kind) : speciesDef(kind);
    const variants = 'variants' in base && Array.isArray(base.variants)
      ? Object.fromEntries([...base.variants, ...('spawnOnly' in base ? base.spawnOnly ?? [] : [])].map((variant: VariantDef) => [variant.id, {
        ...(variant.tint === undefined ? {} : { tint: variant.tint }), ...(variant.fur === undefined ? {} : { fur: variant.fur }),
        ...(variant.traits === undefined ? {} : { traits: variant.traits }),
      }])) : base.variants;
    const look = { ...base, id: row.id, species: row.species, kind, variants: { ...variants, ...row.variants },
      ...(row.postPose === undefined ? {} : { postPose: numericCreaturePose(row.postPose) }) };
    const bodies = this.bodies;
    if (bodies !== undefined) return { ...look, preload: bodies.preload, build: variant => bodies.copy(kind, variant.id) };
    const hulls = this.hulls; if (hulls === undefined) throw new Error('Look book has no body source');
    return { ...look, preload: hulls.preload, skin: (variant, bones) => {
        const hull = hulls.skin(kind, variant.id, bones);
        if (hull === null && row.required) throw new Error(`Required hull is not loaded: ${kind}:${variant.id}`);
        return hull;
      } };
  }
  /** Authored order is shared by page installation and cold specimen preparation. */
  get looks(): readonly SpeciesLook[] { return this.book.rows.map(row => this.look(row.kind)); }
  /** G600 L8 / G602: the packed bodies' looks (`PackedCreatureLooksSchema` rows) with each row's optional coat tints and
   *  traits, painterly material, rigged hull skins (the book's slug), alive / dead post-pose programmes (riding envelopes
   *  on the alive one), stance and gait. `pose` runs one of the rows' programmes over a borrowed rig. Rows only. */
  packedLooks(input: unknown): { readonly all: readonly SpeciesLook[]; get: (kind: string) => SpeciesLook; pose: (id: string, context: AnimalRigContext) => void } {
    const book = v.parse(PackedCreatureLooksSchema, input), packed = this.packed, base = packed.looks(book);
    const programmes = new Map(Object.entries(book.poses).map(([id, row]) => [id, numericCreaturePose(row)] as const));
    const envelopes = new Map(book.rows.flatMap(row => row.postPose?.envelopes === undefined ? [] : [[row.postPose.alive, row.postPose.envelopes] as const]));
    const pose = (id: string, context: AnimalRigContext): void => {
      const programme = programmes.get(id); if (programme === undefined) throw new Error('Missing species pose programme');
      const envelope = envelopes.get(id); if (envelope !== undefined) poseRidingEnvelopes(context, envelope, wildEnv.wind);
      programme(context);
    };
    let hulls: ReturnType<typeof productRiggedHulls> | undefined;
    const skins = (): ReturnType<typeof productRiggedHulls> => { hulls ??= productRiggedHulls(this.book.slug); return hulls; };
    const all = book.rows.map((row): SpeciesLook => {
      const look = base.get(row.kind), kind = row.kind, post = row.postPose, material = row.material;
      if (post !== undefined && (!programmes.has(post.alive) || post.dead !== undefined && !programmes.has(post.dead))) throw new Error('Missing species pose programme');
      const coats = Object.entries(row.variants ?? {}).flatMap(([id, source]) => typeof source === 'string' ? [] : [[id, {
        ...(source.tint === undefined ? {} : { tint: source.tint }), ...(source.traits === undefined ? {} : { traits: source.traits }) }] as const]);
      return Object.assign<SpeciesLook, Partial<SpeciesLook>>(look, {
        ...(coats.length === 0 ? {} : { variants: Object.fromEntries(coats) }),
        ...(material === undefined ? {} : { material: (sky, glow, intensity = 1) => {
          const made = painterlyMaterial(sky, { rim: material.rim, bands: material.bands });
          if (glow !== undefined) { made.emissive.setRGB(...glow); made.emissiveIntensity = intensity; }
          return made;
        } }),
        ...(row.hulls !== true ? {} : {
          preload: async () => { await Promise.all([packed.preload(), skins().preload()]); },
          hasSkin: (variant: VariantDef) => skins().hullOf(kind, variant.id) !== null,
          loadSkin: async (variant: VariantDef) => { const name = skins().hullOf(kind, variant.id); if (name !== null) await skins().load(name); },
          skin: (variant: VariantDef, bones: readonly BoneDef[]) => { const hull = skins().skin(kind, variant.id, bones); return hull === null ? null : { ...hull, normalMap: null, overgrown: false }; },
        }),
        ...(post === undefined ? {} : { postPose: (context: AnimalRigContext) => { pose(context.alive ? post.alive : post.dead ?? post.alive, context); } }),
        ...(row.stance === undefined ? {} : { pose: row.stance }), ...(row.gait === undefined ? {} : { gait: row.gait }),
      });
    });
    return { all, pose, get: kind => { const look = all.find(row => row.kind === kind); if (look === undefined) throw new Error('Unknown packed creature look'); return look; } };
  }
}

const productBooks = new Map<string, HullLookBook>();
/** A product's declared hull look book (`look/hull-book`), admitted once per book slug: every entry, installer
 * and cold specimen of that product shares one book and one packed body owner. */
export function productHullBook(product: { readonly section: (name: 'look/hull-book') => { readonly slug: string } }): HullLookBook {
  const row = product.section('look/hull-book'), cached = productBooks.get(row.slug);
  if (cached !== undefined) return cached;
  const book = new HullLookBook(row); productBooks.set(row.slug, book); return book;
}

/** Expand compact byte addressing only; the native packed owner admits every
 * geometry block, skeleton and dimension before it copies a body. */
/** The compact packed body rows (`CompactSpeciesBodiesSchema`) as the packed body owner's rows. */
function expandCompactBodies(data:CompactSpeciesBodiesRows):unknown{
  const parts=(rows:CompactSpeciesBodiesRows['rows'][number]['fur'])=>rows.map(([count,indexCount,start,groups,index])=>{
    let at=start;const offsets=data.attrs.map(([,type,width])=>{const offset=at,length=count*width*(type==='u16'?2:4);at+=length+(4-length%4)%4;return offset;});
    offsets.push(at);const row:BakedGeometryRow={attrs:data.attrs,count,index,indexCount,box:false};return {offsets,groups,indexEncoding:'raw',row};
  });
  return {file:data.file,bytes:data.bytes,bodies:data.rows.map(body=>{const skeleton=data.skeletons[body.skeleton];if(skeleton===undefined)throw new Error('Missing packed skeleton');
    return {kind:body.kind,variant:body.variant,bones:skeleton.bones,dims:skeleton.dims,fur:parts(body.fur),hard:parts(body.hard),eye:parts(body.eye)};})};
}
/** Client-only look catalogue over native packed bodies and the single hull
 * cache. Data names all variants, resources and material measurements; local
 * gameplay/pose callbacks never enter this owner. */
export class SpeciesLookBook {
  private readonly poses = new Map<string, ReturnType<typeof numericCreaturePose>>();
  private readonly envelopes = new Map<string, RidingPresentationRows>();
  readonly rows;
  readonly looks:readonly SpeciesLook[];
  private readonly bodies;
  private readonly hulls;
  constructor(book:NativeSpeciesLookBookRows){
    this.bodies=packedCreatureBodies(expandCompactBodies(book.body));this.hulls=productRiggedHulls(book.slug);
    for (const [id, pose] of Object.entries(book.poses ?? {})) this.poses.set(id, numericCreaturePose(pose));
    for (const row of book.rows) if (row.postPose !== undefined) {
      if (!this.poses.has(row.postPose.alive) || row.postPose.dead !== undefined && !this.poses.has(row.postPose.dead)) throw new Error('Missing species pose programme');
      if (row.postPose.envelopes !== undefined) this.envelopes.set(row.postPose.alive, row.postPose.envelopes);
    }
    this.rows=book.rows.map(row=>({...row.metadata,...(row.group === undefined ? {} : groupSpecies(row.group)),...(row.directed === undefined ? {} : new DirectedSpecies(row.directed, book.program).binding),...(row.guard === true ? { think: thinkCrowdGuard } : {}),...(row.elite === true ? { think: eliteThink, act: eliteAct } : {})}));
    const base = this.bodies.looks({ poses: {}, rows: book.rows.map(row => ({ id: row.id, species: row.metadata.id, kind: row.metadata.kind,
      family: row.family, variants: Object.fromEntries(Object.entries(row.variants).map(([id, variant]) => [id, variant.body])),
      skeleton: row.rigContract.skeleton, sockets: row.rigContract.sockets, clips: row.rigContract.clips })) });
    this.looks=book.rows.map(row=>{const look=Object.assign<SpeciesLook,Partial<SpeciesLook>>(base.get(row.metadata.kind),{
      variants:Object.fromEntries(Object.entries(row.variants).map(([id,source])=>{
        const variant:Pick<VariantDef,'tint'|'traits'>={};if(source.tint!==undefined)variant.tint=source.tint;if(source.traits!==undefined)variant.traits=source.traits;return [id,variant];
      })),
      material:(sky,glow,intensity=1)=>{const material=painterlyMaterial(sky,row.material);if(glow!==undefined){material.emissive.setRGB(...glow);material.emissiveIntensity=intensity;}return material;},
      preload:()=>this.preload(),hasSkin:variant=>this.hulls.hullOf(row.metadata.kind,variant.id)!==null,
      loadSkin:async variant=>{const name=this.hulls.hullOf(row.metadata.kind,variant.id);if(name!==null)await this.hulls.load(name);},
      skin:(variant,bones)=>{const hull=this.hulls.skin(row.metadata.kind,variant.id,bones);return hull===null?null:{...hull,normalMap:null,overgrown:false};},
    });
    if (row.postPose !== undefined) { const pose = row.postPose; look.postPose = context => { this.pose(context.alive ? pose.alive : pose.dead ?? pose.alive, context); }; }
    if(row.rig!==undefined)look.rig=row.rig;if(row.pose!==undefined)look.pose=row.pose;if(row.gait!==undefined)look.gait=row.gait;
    if(row.elite===true)look.damageMul=eliteDamageMul;if(row.eyeGlow!==undefined)look.eyeGlow=row.eyeGlow;if(row.eyeGlowIntensity!==undefined)look.eyeGlowIntensity=row.eyeGlowIntensity;return look;});
  }
  /** Apply admitted numeric joints and optional mount envelopes over a borrowed rig. */
  pose(id: string, context: AnimalRigContext): void {
    const pose = this.poses.get(id); if (pose === undefined) throw new Error('Missing species pose programme');
    const envelopes = this.envelopes.get(id); if (envelopes !== undefined) poseRidingEnvelopes(context, envelopes, wildEnv.wind);
    pose(context);
  }
  /** Cold specimens and page factories share the same immutable sources. */
  async preload():Promise<void>{await Promise.all([this.bodies.preload(),this.hulls.preload()]);}
  /** Body-only intake for consumers that already own hull preparation. */
  async preloadBodies():Promise<void>{await this.bodies.preload();}
  /** Own a fresh body copy, selected only by its admitted data identity. */
  copy(family:string,key:string):ReturnType<typeof this.bodies.copy>{return this.bodies.copy(family,key);}
}
