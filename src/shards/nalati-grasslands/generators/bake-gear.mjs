// Gear is constructed once offline; runtime cards and reward orbs decode rows.
import { readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { parse } from 'valibot';
import { BowVariantSchema, BowSourceMultipliersSchema } from '@wildshard/format/bowVariantRows';
import { heldSlotRows } from './heldSlots.ts';
import { resolve } from 'node:path';
import { deflateSync } from 'node:zlib';
import * as THREE from 'three';
import { installBakeEnvironment } from '../../../../scripts/bake/environment.mjs';
import { byteWriter, jsonBytes } from '../../../../scripts/bake-output.mjs';
import { installPortableMath } from '@wildshard/commons/bake/portableMath';
import { modelContext, paramsOf, specimenReady } from '@wildshard/engine/models/model';
import { pageScope } from '@wildshard/engine/app/resources';
import { genStarterEffects } from '../../../../scripts/gen-starter-effects.mjs';
import { genStarterBag } from '../../../../scripts/gen-starter-bag.mjs';
import { Rng } from '@wildshard/engine/core/rng';
import { specimenKey } from '@wildshard/game/models/specimenCatalogue';
import { writeGeometry, join } from './geometryWriter.ts';

const root = resolve(import.meta.dirname, '../../../..');
genStarterEffects(root); genStarterBag(root);
const environment = installBakeEnvironment(root);
installPortableMath();
document.dispatchEvent = () => true;
const sky = { setupMaterial: () => undefined, sunDir: new THREE.Vector3(0, 1, 0),
  hemi: new THREE.HemisphereLight(), csm: { lights: [new THREE.DirectionalLight()], update: () => undefined } };
try {
  const models = await import('./gear.ts');
  const GEAR = ['bow','arrow','sabre','spear','javelin','goldenBow','naizagai','ar15'].map(key => ({ key, model: models[key], copies: key === 'arrow' ? 24 : key === 'javelin' ? 3 : 1, drawnAs: key === 'arrow' || key === 'javelin' ? 'instanced' : 'single' }));
  const context = modelContext(sky), blocks = [], rows = [], catalogue = [], materials = {};
  for (const entry of GEAR) {
    const def = entry.model;
    const key = entry.key;
    // Keep author identities as public keys for rewards; the rifle's key is inert.
    const metadata = { id: def.id, name: def.name, file: def.file, category: def.category,
      pipeline: def.pipeline, defaults: def.defaults,
      ...(def.variants === undefined ? {} : { variants: def.variants }),
      ...(def.surface === undefined ? {} : { surface: def.surface }),
      ...(def.specimenYaw === undefined ? {} : { specimenYaw: def.specimenYaw }) };
    catalogue.push({ key, model: metadata, source: { kind: 'packed' }, copies: entry.copies,
      drawnAs: entry.drawnAs });
    for (const variant of [undefined, ...(def.variants ?? []).map(row => row.id)]) {
      const params = paramsOf(def, variant, undefined), built = def.build(context, params, new Rng(0));
      const group = built instanceof THREE.Object3D ? built : new THREE.Group().add(...built.map(part => new THREE.Mesh(part.geometry, part.material)));
      await specimenReady(group); group.updateMatrixWorld(true);
      const parts = [];
      group.traverse(mesh => {
        if (!(mesh instanceof THREE.Mesh)) return;
        if (Array.isArray(mesh.material)) throw new Error('Gear bake requires split materials');
        const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld), material = mesh.material;
        geometry.clearGroups();
        // Pack portable plain float channels, including loader-interleaved attributes.
        for (const [name, source] of Object.entries(geometry.attributes)) {
          const data = Float32Array.from({ length: source.count * source.itemSize }, (_, i) => source.getComponent(Math.floor(i / source.itemSize), i % source.itemSize));
          geometry.setAttribute(name, new THREE.BufferAttribute(data, source.itemSize));
        }
        const tint = material.color ?? new THREE.Color(1, 1, 1), color = geometry.getAttribute('color');
        if (color === undefined) geometry.setAttribute('color', new THREE.BufferAttribute(Float32Array.from({ length: geometry.getAttribute('position').count * 3 }, (_, i) => [tint.r, tint.g, tint.b][i % 3]), 3));
        else for (let i = 0; i < color.count; i++) color.setXYZ(i, color.getX(i) * tint.r, color.getY(i) * tint.g, color.getZ(i) * tint.b);
        const id = 'gear', row = { id: 'nalati-gear-specimen', family: 'painterly', rim: 0.55, bands: 0.7 };
        materials[id] = row;
        parts.push({ material: id, geometry: writeGeometry(geometry, blocks, def.id) }); geometry.dispose();
      });
      if (parts.length === 0) throw new Error(`Empty gear specimen ${def.id}`);
      rows.push({ key: specimenKey(def.id, params), parts });
    }
  }
  const bytes = join(blocks), lanes = new Uint8Array(bytes.length), words = bytes.length / 4;
  for (let b = 0; b < 4; b++) for (let i = 0; i < words; i++) lanes[b * words + i] = bytes[i * 4 + b];
  const writer = byteWriter(process.argv.includes('--check'), 'nalati-gear');
  const effects = JSON.parse(readFileSync(resolve(import.meta.dirname, '../data/weaponEffects.json'), 'utf8'));
  writer.put(resolve(root, 'public/assets/nalati/baked/gear-specimens.bin'), deflateSync(lanes, { level: 9 }));
  const loadout=JSON.parse(readFileSync(resolve(import.meta.dirname,'../data/loadout.json'),'utf8')),variants=JSON.parse(readFileSync(resolve(import.meta.dirname,'../data/legendaryWeapons.json'),'utf8'));
  loadout.variants=Object.fromEntries([['bow','goldenBow'],['blade','naizagai']].map(([name,key])=>[name,{id:`weapon.${variants[key].id}`,name:variants[key].name}]));
  // build-time data (generators read it; play code reads the product's models/gear-book.json); the loadout is its own file
  writer.put(resolve(import.meta.dirname, '../data/gear.generated.json'), jsonBytes({ catalogue, materials, variants: JSON.parse(readFileSync(resolve(import.meta.dirname, '../data/legendaryWeapons.json'), 'utf8')),
    packed: { bin: '/assets/nalati/baked/gear-specimens.bin', bytes: bytes.length, rows } }));
  writer.put(resolve(import.meta.dirname,'../boot/bowTrail.generated.json'),jsonBytes(JSON.parse(readFileSync(resolve(import.meta.dirname,'../data/bowTrail.json'),'utf8'))));
  const variant=JSON.parse(readFileSync(resolve(import.meta.dirname,'../data/bowVariant.json'),'utf8'));
  variant.program=JSON.parse(readFileSync(resolve(import.meta.dirname,'../data/kokpar.generated.json'),'utf8')).program;
  const multipliers=parse(BowSourceMultipliersSchema,effects.multipliers);
  const kinds=new Set(multipliers.flatMap(row=>row.when.targetTags??[]).filter(tag=>tag.startsWith('creature.')).map(tag=>{
    if(tag.endsWith('.*'))throw new Error('Bow damage bake requires explicit creature identities');
    return tag.slice('creature.'.length);
  }));
  /** @param {readonly string[]} tags @param {readonly string[] | undefined} patterns */
  const matches=(tags,patterns)=>patterns===undefined||patterns.some(pattern=>pattern.endsWith('.*')
    ?tags.some(tag=>tag.startsWith(pattern.slice(0,-1))):tags.includes(pattern));
  /** Original source law, evaluated only while baking these damage columns.
   * @param {string} kind */
  const scales=kind=>[false,true].map(sun=>{
    let scale=1;
    for(const row of multipliers)if(matches(sun?[variant.sourceTag]:[],row.when.sourceTags)
      &&matches(kind===''?[]:[`creature.${kind}`],row.when.targetTags)
      &&matches([variant.id],row.when.weaponTags)&&matches([],row.when.targetState))scale*=row.mul;
    return scale;
  });
  variant.damageScale={base:scales(''),kinds:Object.fromEntries([...kinds].map(kind=>[kind,scales(kind)]))};
  variant.trail=JSON.parse(readFileSync(resolve(import.meta.dirname,'../data/bowTrail.json'),'utf8'));
  const admittedVariant=parse(BowVariantSchema,variant);
  writer.put(resolve(import.meta.dirname,'../boot/mountedLoadout.generated.json'),jsonBytes(heldSlotRows(loadout,admittedVariant)));
  if(!isDeepStrictEqual(admittedVariant,variant))throw new Error('Bow variant must include its admitted defaults');
  writer.put(resolve(import.meta.dirname,'../boot/bowVariant.generated.json'),jsonBytes(variant));
  writer.put(resolve(import.meta.dirname,'../boot/bowVariant.generated.d.json.ts'),"declare const variant: import('@wildshard/format/bowVariantRows').BowVariantRows;\nexport default variant;\n");
  writer.finish();
} finally { environment.dispose(); }

pageScope.dispose();
