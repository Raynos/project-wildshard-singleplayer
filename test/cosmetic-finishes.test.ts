import { expect, test } from 'vitest';
import { BoxGeometry, Color, Group, Mesh, MeshLambertMaterial, MeshStandardMaterial } from 'three';
import { CosmeticFinishLocker, CosmeticFinishPainter, paintBoundFinishes } from '../src/game/loadout/cosmeticFinishes';
import type { CosmeticFinishBind } from '../src/format/heldFinishes';
import { parsePlatformDataSection } from '../src/format/platformDataSections';
import rows from '../src/shards/nalati-grasslands/data/skinFinishes.json';
import { patchShader, PATCH_ORDER } from '../src/engine/render/shaderPatches';

const save = () => ({ read: () => ({ owned: [], worn: {} }), write: () => true });

test('an unrelated orchard fixture restores each material and projects current worn rows', () => {
  const profile = { cards: [{id:'pearl', name:'Pearl', blurb:'Light', lockedBlurb:'Win the race', icon:'sword'}],
    skins: [{id:'pearl',slot:'tool',name:'Pearl',blurb:'Light',effect:'effect.pearl',grant:'cosmetic.pearl'}],
    paints: [{target:'pruner',slot:'tool',material:'standard',choices:[{skin:'pearl',color:[.2,.4,.6],emissive:[.01,.02,.03]},{fact:'earned',color:[.7,.8,.9]}]}] };
  const locker = new CosmeticFinishLocker('orchard-fixture', profile, save()), painter = new CosmeticFinishPainter(locker);
  const a = new MeshStandardMaterial({ color: 0x302010 }), b = new MeshStandardMaterial({color:0x503020});
  const first = a.color.clone(), second = b.color.clone(), root = new Group();
  const one=new Mesh(new BoxGeometry(),a),two=new Mesh(new BoxGeometry(),b);root.add(one,two);
  patchShader(a,'fixture.skin',PATCH_ORDER.material,shader=>{shader.fragmentShader+='\n// keep cosmetic lighting';});
  const programKey=a.customProgramCacheKey();
  const targets = {objects:new Map([['pruner',[root]]]),launchers:new Map(),facts:new Set<string>()};
  locker.own('pearl'); painter.update(targets);
  expect(one.material).not.toBe(a);expect(two.material).not.toBe(b);expect(one.material).not.toBe(two.material);
  expect(one.material.color).toEqual(new Color(.2,.4,.6));expect(two.material.color).toEqual(one.material.color);
  expect(a.color).toEqual(first);expect(b.color).toEqual(second);expect(one.material.customProgramCacheKey()).toBe(programKey);
  expect(locker.cardRows(locker.finishes.cards)[0]?.worn).toBe(true);
  locker.wear('tool',null); targets.facts.add('earned'); painter.update(targets);
  expect(one.material.color).toEqual(new Color(.7,.8,.9));
  painter.dispose();expect(one.material).toBe(a);expect(two.material).toBe(b);expect(a.color).toEqual(first);expect(b.color).toEqual(second);
});

test('Nalati grants stay exclusive and mount geometry returns after taking off its finish', () => {
  const locker = new CosmeticFinishLocker('nalati-grasslands',rows,save()), painter = new CosmeticFinishPainter(locker);
  const geometry = new BoxGeometry(); geometry.setAttribute('color', geometry.getAttribute('position').clone());
  const colors = geometry.getAttribute('color'); for(let i=0;i<colors.count;i++)colors.setXYZ(i,.3,.01,.01);
  const originalMaterial=new MeshLambertMaterial({vertexColors:true}),mesh=new Mesh(geometry,originalMaterial);
  const targets = {objects:new Map([['mounts',[mesh]]]),launchers:new Map(),facts:new Set<string>()};
  locker.own('night-rider-mount'); locker.own('sky-marked-saddle'); locker.wear('mount','sky-marked-saddle');
  painter.update(targets); expect(mesh.geometry).not.toBe(geometry);
  const painted=mesh.material;expect(painted).not.toBe(originalMaterial);
  let disposed=0;painted.addEventListener('dispose',()=>{disposed++;});
  expect(locker.effects.has(locker.effectTarget,'cosmetic.skin.sky-marked-saddle')).toBe(true);
  expect(locker.effects.has(locker.effectTarget,'cosmetic.skin.night-rider-mount')).toBe(false);
  locker.wear('mount',null); painter.update(targets); expect(mesh.geometry).toBe(geometry);
  expect(mesh.material).toBe(originalMaterial);expect(disposed).toBe(1);painter.dispose();expect(disposed).toBe(1);
});

test('invalid references and reflected/executable finish fields refuse at admission', () => {
  expect(() => new CosmeticFinishLocker('fixture',{...rows,paints:[{...rows.paints[0],owner:'page',path:'blade'}]},save())).toThrow();
  expect(() => new CosmeticFinishLocker('fixture',{...rows,paints:[{...rows.paints[0],choices:[{skin:'missing'}]}]},save())).toThrow();
  expect(() => parsePlatformDataSection('held/finishes',{order:[],rows:{},cards:[],extras:{},cosmetics:{...rows,paints:[{...rows.paints[0],choices:[()=>true]}]}})).toThrow();
});

test('bound finishes paint the current held parts, mounts and applied facts, then restyle the bound bow', () => {
  // an orchard fixture: a pruner blade, a sling's stones as 'arrows', one mule, a festival fact, and the sling restyled
  const bind: CosmeticFinishBind = { claims:'orchard.kit', held:[{target:'pruner',slot:'pruner',part:'blade'},{target:'stones',slot:'sling',part:'arrows'}],
    mounts:{target:'mules',taming:'mule'}, facts:[{fact:'festival',owner:'arena-room',id:'fair'}],
    restyle:{target:'sling',slot:'sling',styles:['plain','gilded']} };
  const profile = { cards: [{id:'pearl', name:'Pearl', blurb:'Light', lockedBlurb:'Win', icon:'sword'}],
    skins: [{id:'pearl',slot:'tool',name:'Pearl',blurb:'Light',effect:'effect.pearl',grant:'cosmetic.pearl'}],
    paints: [{target:'pruner',slot:'tool',material:'standard',choices:[{skin:'pearl',color:[.2,.4,.6]}]},
      {target:'stones',slot:'tool',material:'standard',choices:[{fact:'festival',color:[.9,.1,.1]}]},
      {target:'mules',slot:'tool',material:'standard',choices:[{fact:'festival',color:[.1,.9,.1]}]},
      {target:'sling',slot:'tool',material:'standard',choices:[{fact:'festival',finish:'gilded'}]}],
    bind };
  const locker = new CosmeticFinishLocker('orchard-fixture', profile, save()), painter = new CosmeticFinishPainter(locker);
  const part = () => new Mesh(new BoxGeometry(), new MeshStandardMaterial({ color: 0x302010 }));
  const blade = part(), stones = part(), mule = part(), styles: string[] = [];
  const sling = { arrows: { mesh: stones } };
  const kit = { blade: (slot: string) => { expect(slot).toBe('pruner'); return { model: blade }; }, bow: (slot: string) => { expect(slot).toBe('sling'); return sling; } };
  let fair = false;
  let worn = 'plain';
  const sources = { kit, mounts: [mule], applied: (owner: string, id: string) => owner === 'arena-room' && id === 'fair' && fair,
    restyle: (slot: string, style: string) => { expect(slot).toBe('sling'); if (worn !== style) { worn = style; styles.push(style); } } };
  locker.own('pearl'); paintBoundFinishes(painter, bind, sources);
  expect(blade.material.color).toEqual(new Color(.2,.4,.6)); expect(stones.material.color).toEqual(new Color(0x302010)); expect(styles).toEqual([]);
  fair = true; paintBoundFinishes(painter, bind, sources);
  expect(stones.material.color).toEqual(new Color(.9,.1,.1)); expect(mule.material.color).toEqual(new Color(.1,.9,.1)); expect(styles).toEqual(['gilded']);
  paintBoundFinishes(painter, bind, sources); expect(styles).toEqual(['gilded']);
  painter.dispose();
});

test('bound targets must name declared paints; unknown owners or parts refuse', () => {
  const bind = rows.bind;
  expect(bind.claims).toBe('nalati.arsenal');
  for (const broken of [{ ...bind, held: [{ target: 'missing', slot: 'blade', part: 'blade' }] }, { ...bind, held: [{ ...bind.held[0], part: 'scabbard' }] },
    { ...bind, facts: [{ fact: 'golden', owner: 'page', id: 'arena' }] }, { ...bind, restyle: { ...bind.restyle, target: 'missing' } }, { ...bind, callback: 'paint' }])
    expect(() => new CosmeticFinishLocker('fixture', { ...rows, bind: broken }, save())).toThrow();
});
