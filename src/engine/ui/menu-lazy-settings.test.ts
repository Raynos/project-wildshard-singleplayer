// @vitest-environment happy-dom
import { afterEach, expect, test, vi } from 'vitest';
import { Scope } from '../app/scope';
import { withOwner } from '../app/ownership';
import { legacyDouble } from '../test/FakeGame';
import { app } from '../app/runtime';
import { GameMenu } from './Menu';
import type { FullMap } from './Map';

const owners: Scope[]=[];
afterEach(()=>{for(const owner of owners.splice(0))owner.dispose();vi.restoreAllMocks();});

function fixture(){
  const owner=new Scope('lazy-settings');owners.push(owner);
  const map=legacyDouble<FullMap>({mount:()=>undefined,setZoom:()=>undefined,fit:()=>undefined,
    show:()=>undefined,hide:()=>undefined,hasRoom:false,zoom:1,quest:null});
  const menu=withOwner(owner,()=>new GameMenu({fullMap:map,settings:()=>({weapons:new Set(),melee:false,tracers:false,huntersEye:false})}));
  return {owner,menu};
}

test('first settings open keeps early sections in order and omits removed registrations',async()=>{
  const {menu}=fixture(), first=document.createElement('div'), last=document.createElement('div'), removed=document.createElement('div');
  first.textContent='Early first';last.textContent='Early last';removed.textContent='Removed early';
  const refresh=vi.fn<()=>void>();
  menu.addSettingsSection('save',[first],{first:true,refresh});
  const removeLast=menu.addSettingsSection('save',[last]);
  menu.addSettingsSection('save',[removed])();
  expect(menu.root.querySelector('.ws-gmenu-pane')).toBeNull();expect(refresh).not.toHaveBeenCalled();
  menu.open('settings');await vi.dynamicImportSettled();
  await vi.waitFor(()=>{expect(first.isConnected).toBe(true);});
  expect(last.isConnected).toBe(true);expect(removed.isConnected).toBe(false);
  expect(first.compareDocumentPosition(last)&Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
  expect(refresh).toHaveBeenCalled();
  removeLast();expect(last.isConnected).toBe(false);
  menu.close();const count=refresh.mock.calls.length;menu.open('settings');
  expect(refresh.mock.calls.length).toBeGreaterThan(count);
  expect(menu.root.textContent?.match(/Early first/gu)).toHaveLength(1);
});

test('closing during preparation never reopens the menu or changes the resumed app state',async()=>{
  const {menu}=fixture();app.setState('play');
  menu.open('settings');menu.close();
  expect(document.querySelector('.ws-x-load')).toBeNull();
  await vi.dynamicImportSettled();
  expect(menu.isOpen).toBe(false);expect(app.state).toBe('play');
});

test('retiring during preparation cannot mount a late settings pane',async()=>{
  const {owner,menu}=fixture();menu.open('settings');owner.dispose();
  await vi.dynamicImportSettled();
  expect(menu.root.isConnected).toBe(false);expect(menu.root.querySelector('.ws-gmenu-pane')).toBeNull();
});
