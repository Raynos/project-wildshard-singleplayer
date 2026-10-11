import { expect, it } from 'vitest';
import { parseItems } from '@wildshard/format/items';
import { parseWeaponProfile } from '@wildshard/format/weaponProfiles';
import { PINE_ITEMS } from '../src/shards/pine-hollow/data/items';
import { LEVER_WEAPON_PROFILE as profile } from '../src/shards/pine-hollow/data/leverProfile';
import { LeverAction, LEVER_PROFILE, parseLeverProfile } from '../src/shards/pine-hollow/weapons/leverAction';
import { LeverAction as ShippingAction } from './fixtures/weapon-oracle/leverAction';

it('declares the actual chamber/tube owner on firearm and delivers its hitscan numbers without changing the view recipe', () => {
  const row = parseItems(PINE_ITEMS).rows.find(item => item.id === 'weapon.lever');
  if (row?.kind !== 'weapon') throw new Error('Missing real lever item');
  expect(row.family).toBe('firearm'); expect(row.profile).toEqual(profile); expect(row.view.recipe).toBe('pine-hollow.lever');
  expect(parseWeaponProfile(profile)).toEqual(profile);
  for (const key of ['action', 'magazine', 'reserve', 'interval', 'reload', 'damageScale', 'range', 'spreadAds', 'spreadHip', 'spreadRadius', 'bloomShot', 'bloomMax', 'movingSpread', 'movingAimReduction'] as const) {
    expect(LEVER_PROFILE[key]).toEqual(profile[key]);
  }
});

it('retains the shipping chamber/gate state and event order over 10k mixed-frame firing, dry pulls, reload interruption and restore', () => {
  const actual = new LeverAction({ reserve: 21 }), shipping = new ShippingAction({ reserve: 21 });
  const actualEvents: string[] = [], shippingEvents: string[] = [];
  const hooks = (events: string[]) => ({ cycle: () => { events.push('cycle'); }, eject: () => { events.push('eject'); }, chambered: () => { events.push('chambered'); },
    reloadStart: () => { events.push('reloadStart'); }, round: () => { events.push('round'); }, reloadEnd: () => { events.push('reloadEnd'); } });
  const state = (action: LeverAction | ShippingAction) => ({ tube: action.tube, chambered: action.chambered, caseInChamber: action.caseInChamber, hammerCocked: action.hammerCocked,
    phase: action.phase, phaseT: action.phaseT, fed: action.fed, planned: action.planned, stopAfter: action.stopAfter, dryAtStart: action.dryAtStart,
    reloadProgress: action.reloadProgress, store: { ...action.store }, cycleU: action.cycleU, rounds: action.rounds, action: action.action });
  for (let tick = 0; tick < 10000; tick++) {
    const dt = [1 / 60, 1 / 30, 1 / 20][tick % 3]; if (dt === undefined) throw new Error('Missing sampled delta');
    for (const action of [actual, shipping]) {
      if (tick % 19 === 0) {
        if (action.phase === 'reload') action.triggerWhileReloading();
        else if (action.phase === 'idle') {
          if (action.chambered) action.dropHammer(); else if (action.tube > 0) action.throwLever(); else action.beginReload();
        }
      }
      if (tick % 233 === 0) action.beginReload();
      if (tick % 751 === 0) action.store.reserve += 8;
    }
    actual.step(dt, actual.wantsAutoReload && tick % 5 === 0, hooks(actualEvents));
    shipping.step(dt, shipping.wantsAutoReload && tick % 5 === 0, hooks(shippingEvents));
    expect(state(actual)).toEqual(state(shipping)); expect(actualEvents).toEqual(shippingEvents);
    actualEvents.length = 0; shippingEvents.length = 0;
    if (tick === 4117) { const saved = state(actual); Object.assign(actual, { phase: saved.phase, phaseT: saved.phaseT, tube: saved.tube }); }
  }
});

it('changes native tube/cycle/gate timing from author data and refuses unsupported contracts before execution', () => {
  const authored = { ...profile, magazine: 3, interval: 1.12, reload: 0.8, lever: { ...profile.lever, cycleTime: 1 } };
  const action = new LeverAction({ reserve: 9 }, authored); authored.magazine = 50; authored.lever.cycleTime = 0.01;
  expect(action.tube).toBe(2); action.dropHammer();
  const hooks = { cycle: () => undefined, eject: () => undefined, chambered: () => undefined, reloadStart: () => undefined, round: () => undefined, reloadEnd: () => undefined };
  action.step(0.12, false, hooks); action.step(0.56, false, hooks); expect(action.phase).toBe('cycle');
  action.step(0.44, false, hooks); expect(action.phase).toBe('idle'); expect(action.tube).toBe(1);
  expect(action.beginReload()).toBe(true); action.step(0.62, false, hooks); expect(action.tube).toBe(1);
  action.step(0.4, false, hooks); expect(action.tube).toBe(2); expect(action.store.reserve).toBe(8);
  for (const bad of [{ ...profile, lever: undefined }, { ...profile, action: 'bolt' }, { ...profile, reloadMode: 'magazine' },
    { ...profile, bloomShot: 1 }, { ...profile, interval: 0.9 }, { ...profile, lever: { ...profile.lever, cycleTime: 0 } },
    { ...profile, projectile: { ...profile.projectile, delivery: 'flight' } }]) expect(() => parseLeverProfile(bad)).toThrow();
});
