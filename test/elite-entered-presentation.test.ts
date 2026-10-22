// @vitest-environment happy-dom
import { beforeEach, expect, test, vi } from 'vitest';
import * as v from 'valibot';
import { Group, PerspectiveCamera, Scene, Vector3 } from 'three';
import { Scope } from '../src/engine/app/scope';
import { withOwner } from '../src/engine/app/ownership';
import { EliteBar } from '../src/engine/ui/EliteBar';
import type { Interactable } from '../src/engine/world/interact/types';
import type { Animal } from '../src/engine/entities/AnimalView';
import { setTerrainHeight } from '../src/engine/world/terrainHeight';
import { Elites, type EliteScript, type EliteEnteredOwners } from '../src/game/Elite';
import { EliteEnteredPresentationSchema } from '../src/format/eliteFeature';
import { legacyDouble } from './fake/FakeGame';
import { mockCanvas, portraitHeldFrame } from './fake/weaponParity';

const def = { id: 'reed.guard', name: 'Reed Guardian', epithet: 'Nest watcher', lair: { x: 0, z: 0, r: 4 },
  awareR: 12, engageR: 8, leashR: 16, rule: 'always' as const, respawnMin: 1, signature: 'BEAK', phase2: 'NEST',
  drop: { skin: 'reed', skinName: 'REED', weapon: 'sword', blurb: 'woven reed grip' } };
const rows = v.parse(EliteEnteredPresentationSchema, { [def.id]: { prompt: 'Take the REED sword skin',
  toast: 'REED sword skin — woven reed grip', hum: true, sting: { banner: .8, phase2: 1, kill: 'chunk' } } });

beforeEach(() => { setTerrainHeight(() => 0); mockCanvas(); vi.spyOn(Math, 'random').mockReturnValue(.25); });

function trace(entered: boolean): { events: unknown[][]; labels: string[]; view: string; bar: string; saved: string } {
  const scope = new Scope('entered.elites'), scene = new Scene(), camera = new PerspectiveCamera(), events: unknown[][] = [], interactables: Interactable[] = [];
  const body = legacyDouble<Animal>({ position: new Vector3(), alive: true, hp: 10, maxHp: 10, lastHitT: -Infinity, scale: 1,
    headWorld: out => out.set(0, 1, 0) });
  const script: EliteScript = { def, animal: body, spawn: () => undefined, despawn: () => undefined, tick: () => undefined,
    enterPhase2: () => undefined, reset: () => undefined, trophy: () => { events.push(['trophy']); }, dropModel: () => new Group() };
  const hud = legacyDouble<EliteEnteredOwners['hud']>({ toast: text => { events.push(['toast', text]); } });
  const audio = legacyDouble<EliteEnteredOwners['audio']>({ pickupHum: inside => { events.push(['hum', inside]); } });
  const music = legacyDouble<EliteEnteredOwners['music']>({ sting: name => { events.push(['sting', name]); }, combat: intensity => { events.push(['combat', intensity]); } });
  let saved = '';
  try {
    return withOwner(scope, () => {
      const bar = new EliteBar(), elites = new Elites({ scene, camera, player: { position: new Vector3() }, condition: rule => rule === 'always',
        ...(!entered ? { addInteractable: (it: Interactable): void => { interactables.push(it); }, removeInteractable: (it: Interactable): void => { const index = interactables.indexOf(it); if (index !== -1) interactables.splice(index, 1); },
          toast: (text: string): void => { hud.toast(text); }, pickupHum: (inside: boolean): void => { audio.pickupHum(inside); },
          sting: (event: 'banner' | 'phase2' | 'kill'): void => { if (event === 'kill') music.sting('chunk'); else music.combat(event === 'phase2' ? 1 : .8); } } : {}),
        ownSkin: skin => { events.push(['own', skin]); },
      }, bar, 'reed-marsh', { read: () => ({}), write: value => { saved = JSON.stringify(value); } });
      elites.add(script);
      if (entered) elites.bindEnteredPresentation({ scope, interactables, hud, audio, music }, rows);
      elites.initialize(); elites.update(.1, 0); body.hp = 5; elites.update(.1, .1); body.alive = false; elites.update(.1, .2);
      const labels = interactables.map(it => it.label), view = portraitHeldFrame(scene.children), markup = bar.root.outerHTML;
      const drop = interactables[0]; if (drop === undefined) throw new Error('Missing elite skin');
      camera.position.copy(drop.position); elites.update(.016, .216); drop.onInteract(); drop.onInteract();
      expect(interactables).toHaveLength(0); expect(elites.owned(def.id)).toBe(true);
      return { events, labels, view, bar: markup, saved };
    });
  } finally { scope.dispose(); }
}

test('entered rows retain the real banner, phase, skin orb, prompt, score and reward sequence', () => {
  const legacy = trace(false), entered = trace(true);
  expect(entered).toEqual(legacy);
  expect(entered.labels).toEqual(['Take the REED sword skin']);
  expect(entered.events).toEqual([['combat', .8], ['combat', 1], ['trophy'], ['sting', 'chunk'], ['hum', true], ['hum', false], ['own', 'reed'], ['hum', false], ['toast', 'REED sword skin — woven reed grip']]);
  expect(JSON.parse(entered.saved)).toEqual({ [def.id]: { timer: 60 - .016, discovered: true, skinTaken: true, kills: 1, retired: false } });
});

test('entered binding refuses foreign, retired, duplicate or mismatched concrete owners', () => {
  const scope = new Scope('elite.owner'), foreign = new Scope('foreign'), retired = new Scope('retired'); retired.dispose();
  try {
    withOwner(scope, () => {
      const elites = new Elites({ scene: new Scene(), camera: new PerspectiveCamera(), player: { position: new Vector3() }, condition: () => false }, new EliteBar(), 'reed', { read: () => ({}), write: () => undefined });
      const owners = { scope, interactables: [], hud: legacyDouble<EliteEnteredOwners['hud']>({}), audio: legacyDouble<EliteEnteredOwners['audio']>({}), music: legacyDouble<EliteEnteredOwners['music']>({}) };
      expect(() => elites.bindEnteredPresentation({ ...owners, scope: foreign }, {})).toThrow('owner');
      expect(() => elites.bindEnteredPresentation({ ...owners, scope: retired }, {})).toThrow('owner');
      expect(() => elites.bindEnteredPresentation(owners, rows)).toThrow('identities');
      elites.bindEnteredPresentation(owners, {});
      expect(() => elites.bindEnteredPresentation(owners, {})).toThrow('owner');
      expect(() => elites.add(legacyDouble<EliteScript>({ def }))).toThrow('identities');
    });
  } finally { scope.dispose(); foreign.dispose(); }
});

test('presentation admission is finite JSON with no callback or effect registry', () => {
  const row = rows[def.id]; if (row === undefined) throw new Error('Missing presentation');
  for (const bad of [{ ...row, callback: () => undefined }, { ...row, sting: { ...row.sting, banner: Number.NaN } }, { ...row, sting: { ...row.sting, kill: 'arbitrary' } }, { ...row, prompt: () => 'Take' }]) {
    expect(() => v.parse(EliteEnteredPresentationSchema, { [def.id]: bad })).toThrow();
  }
});
