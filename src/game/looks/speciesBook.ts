import { thinkCrowdGuard } from '../ambient/crowdPage';
import { eliteAct, eliteDamageMul, eliteThink } from '../quest/elitePage';
import { DirectedSpecies } from '../population/directedSpecies';
import { groupSpecies } from '../population/groupSpecies';
import { installChannelPrograms, numericCreaturePose } from '../plugin/channelPrograms';
import { lookAngles } from '@wildshard/engine/entities/species/rigs';
import { terrainHeight } from '@wildshard/engine/world/terrainHeight';
import { poseRidingEnvelopes } from '../riding/presentation';
import { wildEnv } from '../population/pageGroups';
import type { AnimalRigContext } from '@wildshard/engine/entities/animalRig';
import * as v from 'valibot';
import { packedCreatureBodies,readBakedGeometry,type BakedGeometryRow } from '../plugin/geometry';
import { Color, MeshBasicMaterial, SkinnedMesh, type BufferGeometry } from 'three';
import { productRiggedHulls } from './riggedHulls';
import { HullLookBookSchema, PackedCreatureLooksSchema, type CompactSpeciesBodiesRows, type LookFrameSchema } from '@wildshard/format/speciesLooks';
import type { NativeSpeciesLookBookRows } from '@wildshard/format/speciesBookRows';
import type { SpeciesLook } from '@wildshard/engine/entities/species/look';
import type { SpeciesRow } from '@wildshard/engine/ai/species';
import { painterlyMaterial } from '@wildshard/engine/world/painterly';
import { hasSpecies, registerSpecies, speciesDef, type BoneDef, type SpeciesDef, type VariantDef } from '@wildshard/engine/entities/species/registry';
import { roamingBossDamage } from '../boss/roamingProjection';
import { limbAnimation } from '../animation/limbView';

/** Client-only hull projection on shared fauna or declared skeletons. The data
 * book owns coats and post-poses; the existing hull cache owns every asset. */
export class HullLookBook {
  private readonly book;
  private readonly hulls;
  private readonly bodies;
  /** `files` reads the book's product files (the packed looks' attachments); absent, a look with attachments refuses */
  constructor(input: unknown, private readonly files: { readonly file: (name: string) => Promise<Uint8Array> } | null = null) {
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
  /** Resolve registered rigs only when requested, after their native owner installs them. A registered base lends its look
   *  fields only: its think, act and damage stay the species row's (G602: never a look's). */
  look(kind: string): SpeciesLook {
    const row = this.book.rows.find(entry => entry.kind === kind); if (row === undefined) throw new Error('Missing hull look');
    const base = row.base === 'definition' ? this.definition(kind) : speciesDef(kind);
    // every base is a species definition now (its variants a list): each variant's coat, spawn-only ones too
    const variants = Object.fromEntries([...base.variants, ...(base.spawnOnly ?? [])].map((variant: VariantDef) => [variant.id, {
      ...(variant.tint === undefined ? {} : { tint: variant.tint }), ...(variant.fur === undefined ? {} : { fur: variant.fur }),
      ...(variant.traits === undefined ? {} : { traits: variant.traits }),
    }]));
    const look = { ...(row.base === 'definition' ? base : registeredLook(base)), id: row.id, species: row.species, kind, variants: { ...variants, ...row.variants },
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
   *  on the alive one), stance, gait, and its own frame: an animate programme or a channel frame (`frames`, see
   *  LookFrameSchema) wearing the row's attachments (each a baked
   *  geometry of the book's product, read once as the look preloads or on its first frame, one self-lit skinned mesh per
   *  animal, put on once read). `pose` runs one of the rows' programmes over a borrowed rig. Rows only. */
  packedLooks(input: unknown): { readonly all: readonly SpeciesLook[]; get: (kind: string) => SpeciesLook; pose: (id: string, context: AnimalRigContext) => void } {
    const book = v.parse(PackedCreatureLooksSchema, input), packed = this.packed, base = packed.looks(book);
    const programmes = new Map(Object.entries(book.poses).map(([id, row]) => [id, numericCreaturePose(row)] as const));
    const frames = new Map(Object.entries(book.frames).map(([id, row]) => [id, channelFrame(row)] as const));
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
      const programme = row.animate, own = row.frame === undefined ? undefined : frames.get(row.frame), worn = row.attachments ?? [], files = this.files;
      if (programme !== undefined && !programmes.has(programme)) throw new Error('Missing species pose programme');
      if (row.frame !== undefined && (own === undefined || programme !== undefined)) throw new Error('A packed look runs one known frame');
      const frame = programme === undefined ? own : (context: AnimalRigContext): void => { pose(programme, context); };
      if (worn.length > 0 && frame === undefined) throw new Error('Packed look attachments need an animate programme');
      if (worn.length > 0 && files === null) throw new Error('Packed look attachments need the product files');
      const coats = Object.entries(row.variants ?? {}).flatMap(([id, source]) => typeof source === 'string' ? [] : [[id, {
        ...(source.tint === undefined ? {} : { tint: source.tint }), ...(source.traits === undefined ? {} : { traits: source.traits }) }] as const]);
      const dressed = Object.assign<SpeciesLook, Partial<SpeciesLook>>(look, {
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
      if (frame === undefined) return dressed;
      // the attachments' geometries are read once and shared by every animal's own mesh
      let parts: readonly { readonly name: string; readonly colour: readonly [number, number, number]; readonly geometry: BufferGeometry }[] | null = worn.length === 0 ? [] : null;
      let reading: Promise<void> | null = null, failure: unknown = null;
      const read = (): Promise<void> => {
        reading ??= Promise.all(worn.map(async part => ({ name: part.name, colour: part.colour,
          geometry: readBakedGeometry(Uint8Array.from(await (files?.file(part.file) ?? Promise.reject(new Error('Missing product files')))), 0, part.geometry) })))
          .then(rows => { parts = rows; return undefined; }, (cause: unknown) => { failure = cause; throw cause; });
        return reading;
      };
      const wearing = new WeakSet(), preload = dressed.preload;
      if (worn.length > 0) dressed.preload = async (): Promise<void> => { await preload?.(); await read(); };
      dressed.animate = (context): void => {
        if (failure !== null) throw new Error('Packed look attachments failed to load', { cause: failure });
        const animal = context.animal;
        if (parts === null) void read().catch(() => undefined);
        else if (!wearing.has(animal)) {
          for (const part of parts) {
            const paint = new MeshBasicMaterial({ color: new Color(...part.colour), toneMapped: false }); paint.name = part.name;
            const mesh = new SkinnedMesh(part.geometry, paint); mesh.name = part.name; mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = false;
            animal.mesh.add(mesh); mesh.bind(animal.mesh.skeleton, animal.mesh.bindMatrix);
          }
          wearing.add(animal);
        }
        frame(context);
      };
      return dressed;
    });
    return { all, pose, get: kind => { const look = all.find(row => row.kind === kind); if (look === undefined) throw new Error('Unknown packed creature look'); return look; } };
  }
}

type LookFrameRow = v.InferOutput<typeof LookFrameSchema>;
interface FrameRig { frame: AnimalRigContext; look: { yaw: number; pitch: number }; surface: { ground: number; alive: number }; visual: { yOffset: number };
  draw: ReturnType<typeof installChannelPrograms>; observe: ReturnType<typeof installChannelPrograms> }
/** A packed look's channel frame (`LookFrameSchema`): each animal's rig copy is made on its first frame; the surface group
 *  reads the ground under it and publishes the smoothed fields, the death floor and the body's lift, then the observe group
 *  and the pose group run over the copy. */
function channelFrame(row: LookFrameRow): (context: AnimalRigContext) => void {
  const { programs, smooth, floor, look: [eye, maxYaw, maxPitch] } = row;
  if (programs.filter(program => program.numeric?.group === row.observe).length > 32) throw new Error('Excess look frame observation programmes');
  for (const program of programs) {
    const numeric = program.numeric; if (numeric?.group !== row.observe && numeric?.group !== row.surface) continue;
    if (numeric.outputs.some(out => out.path.length !== 1 || out.target !== 'mem' && !(numeric.group === row.surface && out.target === 'visual' && out.path[0] === 'yOffset'))) throw new Error('Look frame programmes must target private visual fields');
  }
  const pose = numericCreaturePose({ group: row.pose, programs: programs.filter(program => program.numeric?.group === row.pose) });
  const rigs = new WeakMap<AnimalRigContext['bones'], FrameRig>();
  return (c): void => {
    let rig = rigs.get(c.bones);
    if (rig === undefined) {
      const frame: AnimalRigContext = { ...c, mem: { ...row.memory } }, look = { yaw: 0, pitch: 0 }, surface = { ground: 0, alive: 1 }, visual = { yOffset: 0 };
      for (const program of programs) for (const output of program.numeric?.outputs ?? []) if (output.target === 'mem') {
        const key = output.path[0]; if (typeof key !== 'string') throw new Error('Missing look frame field'); frame.mem[key] = 0;
      }
      for (const field of smooth) frame.mem[field.input] = 0;
      frame.mem[floor.lift] = 0;
      const owners = new Map<string, unknown>([['frame', frame], ['mem', frame.mem], ['look', look], ['surface', surface], ['visual', visual]]);
      rig = { frame, look, surface, visual, draw: installChannelPrograms(programs, row.surface, owners), observe: installChannelPrograms(programs, row.observe, owners) };
      rigs.set(c.bones, rig);
    }
    const { frame, look, surface, visual, draw, observe } = rig, memory = frame.mem;
    Object.assign(frame, c); frame.mem = memory; Object.assign(memory, c.mem);
    for (const field of smooth) { const value = c.mem[field.input] ?? 0; memory[field.input] = value; memory[field.output] = c.mem[field.output] ?? field.initial ?? value; }
    memory[floor.death] = c.mem[floor.death] ?? 0; memory[floor.lift] = c.mem[floor.lift] ?? 0;
    surface.ground = terrainHeight(c.animal.position.x, c.animal.position.z); surface.alive = Number(c.alive); Object.assign(look, lookAngles(c, eye, maxYaw, maxPitch));
    draw.evaluate({ time: c.t, delta: c.dt, values: {} });
    for (const field of smooth) c.mem[field.output] = memory[field.output] ?? 0;
    if (!c.alive) c.mem[floor.death] = memory[floor.death] ?? 0;
    c.animal.yOffset = visual.yOffset;
    observe.evaluate({ time: c.t, delta: c.dt, values: {} }); pose(frame);
  };
}

/** A registered species' look fields: its rig contract, fur, build, pose, gait, post-pose, rig, animation, eye glow and
 *  (its variants are mapped by the caller), never its gameplay (think, act, damage). */
function registeredLook(def: SpeciesDef): Pick<SpeciesLook, 'rigContract' | 'fur' | 'build' | 'pose' | 'gait' | 'postPose' | 'rig' | 'animate' | 'eyeGlow' | 'eyeGlowIntensity'> {
  const { rigContract, fur, build, pose, gait, postPose, rig, animate, eyeGlow, eyeGlowIntensity } = def;
  return { rigContract, fur, build, ...(pose === undefined ? {} : { pose }),
    ...(gait === undefined ? {} : { gait }), ...(postPose === undefined ? {} : { postPose }), ...(rig === undefined ? {} : { rig }),
    ...(animate === undefined ? {} : { animate }), ...(eyeGlow === undefined ? {} : { eyeGlow }), ...(eyeGlowIntensity === undefined ? {} : { eyeGlowIntensity }) };
}

const productBooks = new Map<string, HullLookBook>();
/** A product's declared hull look book (`look/hull-book`), admitted once per book slug: every entry, installer
 * and cold specimen of that product shares one book and one packed body owner. */
export function productHullBook(product: { readonly section: (name: 'look/hull-book') => { readonly slug: string }; readonly file: (name: string) => Promise<Uint8Array> }): HullLookBook {
  const row = product.section('look/hull-book'), cached = productBooks.get(row.slug);
  if (cached !== undefined) return cached;
  const book = new HullLookBook(row, product); productBooks.set(row.slug, book); return book;
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
/** G600 L8: the species rows' behaviour hooks (group, directed, crowd guard and the elites' think / act / damage), kept
 *  outside the look book until L4 (the engine elite feature) and L5 (the wildlife group sims) absorb them; the looks are
 *  the hull book's packed looks. */
export function speciesBehaviour(book: Pick<NativeSpeciesLookBookRows, 'rows' | 'program'>): { readonly rows: readonly SpeciesRow[]; look: (look: SpeciesLook) => SpeciesLook } {
  const rows = book.rows.map(row => ({ ...row.metadata, ...(row.group === undefined ? {} : groupSpecies(row.group)), ...(row.directed === undefined ? {} : new DirectedSpecies(row.directed, book.program).binding),
    ...(row.guard === true ? { think: thinkCrowdGuard } : {}), ...(row.elite === true ? { think: eliteThink, act: eliteAct } : {}) }));
  const elites = new Set(book.rows.flatMap(row => row.elite === true ? [row.metadata.kind] : []));
  return { rows, look: look => elites.has(look.kind) ? { ...look, damageMul: eliteDamageMul } : look };
}
