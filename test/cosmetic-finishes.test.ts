import { expect, test } from 'vitest';
import { BoxGeometry, Color, Group, Mesh, MeshLambertMaterial, MeshStandardMaterial } from 'three';
import { CosmeticFinishLocker, CosmeticFinishPainter } from '../src/game/loadout/cosmeticFinishes';
import { parsePlatformDataSection } from '../src/format/platformDataSections';
import rows from '../src/shards/nalati-grasslands/data/skinFinishes.json';

const save = () => ({ read: () => ({ owned: [], worn: {} }), write: () => true });

test('an unrelated orchard fixture restores each material and projects current worn rows', () => {
  const profile = { cards: [{id:'pearl', name:'Pearl', blurb:'Light', lockedBlurb:'Win the race', icon:'sword'}],
    skins: [{id:'pearl',slot:'tool',name:'Pearl',blurb:'Light',effect:'effect.pearl',grant:'cosmetic.pearl'}],
    paints: [{target:'pruner',slot:'tool',material:'standard',choices:[{skin:'pearl',color:[.2,.4,.6],emissive:[.01,.02,.03]},{fact:'earned',color:[.7,.8,.9]}]}] };
  const locker = new CosmeticFinishLocker('orchard-fixture', profile, save()), painter = new CosmeticFinishPainter(locker);
  const a = new MeshStandardMaterial({ color: 0x302010 }), b = new MeshStandardMaterial({color:0x503020});
  const first = a.color.clone(), second = b.color.clone(), root = new Group();
  root.add(new Mesh(new BoxGeometry(),a),new Mesh(new BoxGeometry(),b));
  const targets = {objects:new Map([['pruner',[root]]]),launchers:new Map(),facts:new Set<string>()};
  locker.own('pearl'); painter.update(targets);
  expect(a.color).toEqual(new Color(.2,.4,.6)); expect(b.color).toEqual(a.color);
  expect(locker.cardRows(locker.finishes.cards)[0]?.worn).toBe(true);
  locker.wear('tool',null); targets.facts.add('earned'); painter.update(targets);
  expect(a.color).toEqual(new Color(.7,.8,.9));
  painter.dispose(); expect(a.color).toEqual(first); expect(b.color).toEqual(second);
});

test('Nalati grants stay exclusive and mount geometry returns after taking off its finish', () => {
  const locker = new CosmeticFinishLocker('nalati-grasslands',rows,save()), painter = new CosmeticFinishPainter(locker);
  const geometry = new BoxGeometry(); geometry.setAttribute('color', geometry.getAttribute('position').clone());
  const colors = geometry.getAttribute('color'); for(let i=0;i<colors.count;i++)colors.setXYZ(i,.3,.01,.01);
  const mesh = new Mesh(geometry,new MeshLambertMaterial({vertexColors:true}));
  const targets = {objects:new Map([['mounts',[mesh]]]),launchers:new Map(),facts:new Set<string>()};
  locker.own('night-rider-mount'); locker.own('sky-marked-saddle'); locker.wear('mount','sky-marked-saddle');
  painter.update(targets); expect(mesh.geometry).not.toBe(geometry);
  expect(locker.effects.has(locker.effectTarget,'cosmetic.skin.sky-marked-saddle')).toBe(true);
  expect(locker.effects.has(locker.effectTarget,'cosmetic.skin.night-rider-mount')).toBe(false);
  locker.wear('mount',null); painter.update(targets); expect(mesh.geometry).toBe(geometry);
});

test('invalid references and reflected/executable finish fields refuse at admission', () => {
  expect(() => new CosmeticFinishLocker('fixture',{...rows,paints:[{...rows.paints[0],owner:'page',path:'blade'}]},save())).toThrow();
  expect(() => new CosmeticFinishLocker('fixture',{...rows,paints:[{...rows.paints[0],choices:[{skin:'missing'}]}]},save())).toThrow();
  expect(() => parsePlatformDataSection('held/finishes',{order:[],rows:{},cards:[],extras:{},cosmetics:{...rows,paints:[{...rows.paints[0],choices:[()=>true]}]}})).toThrow();
});
