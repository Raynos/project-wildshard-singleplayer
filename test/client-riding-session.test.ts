import { expect, test } from 'vitest';
import { NALATI_RIDING_PROGRAMS } from './fixtures/nalati-riding';
import { parse } from 'valibot';
import { ClientRidingSessionSchema, cleanMountName } from '../src/format/riding';
import { nalatiRidingSession } from '../src/shards/nalati-grasslands/generators/clientRiding';
import { HeldClaims } from '../src/game/loadout/claims';
import { installClientRiding } from '../src/game/riding/client';
import { entryOwner } from '../src/game/shardfile/entryOwners';
import type { ShardContext } from '../src/game/plugin/context';
import { legacyDouble } from '@wildshard/engine/test/FakeGame';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { emptyShardfile } from '../src/sdk/author';
import { lendNalatiRiding } from './fixtures/nalati-return-modules';
import { Scope } from '../src/engine/app/scope';

test('client session rejects callback ports and admits an unrelated ride profile', () => {
  const rows = structuredClone(nalatiRidingSession(NALATI_RIDING_PROGRAMS));
  rows.preset.mountableLabel = 'Orchard deer'; rows.profile.speeds.gallop = 9;
  rows.naming.maximum = 8; rows.naming.notice = 'Your companion is '; rows.naming.bondedFeat = 'befriend';
  rows.rest = { x: 23, z: -41, face: { x: 0, z: 1 } }; rows.taming.rail = { x: 25, z: -40 };
  const admitted = parse(ClientRidingSessionSchema, rows);
  expect(admitted.rest).toEqual(rows.rest); expect(admitted.naming.maximum).toBe(8);
  for (const bad of [{ ...rows, naming: { ...rows.naming, maximum: 129 } },
    { ...rows, naming: { ...rows.naming, onSave: () => undefined } },
    { ...rows, figure: { row: { build: () => null } } },
    { ...rows, taming: { ...rows.taming, owner: 'borrowed', path: ['herds'] } }])
    expect(() => parse(ClientRidingSessionSchema, bad)).toThrow();
});

test('native names keep unicode graphemes, reject markup and respect the row cap', () => {
  expect(cleanMountName('  ka<ra>   jorga<script>  ', 10)).toBe('Kara Jorga');
  expect(cleanMountName(' e\u0301clair and an extra word ', 6)).toBe('Éclair');
  expect(cleanMountName('\u200B<>&', 16)).toBe('');
  expect(() => cleanMountName('Camp horse', 0)).toThrow('limit');
  expect(() => cleanMountName('Camp horse', 1.5)).toThrow('limit');
});

test('the session cannot bind an unbuilt or disposed equipment authority', () => {
  const scope = new Scope('orchard.kit');
  const arsenal=HeldClaims.fromSlots({version:1,id:'orchard.kit',slots:[{id:'blade',kind:'blade',item:'weapon.blade',source:{kind:'passes',file:'blade.json'}}],
    registration:['blade'],equipment:{primary:'blade',extras:[]},selection:{unlock:[]},mount:[],refills:[],upgrades:[]});
  expect(arsenal.pageKit({ scope })).toBeNull();scope.dispose();
  expect(arsenal.pageKit({ scope })).toBeNull();
});


test('declared frame publication borrows the same installed session and waits for native entry', async () => {
  const scope = new Scope('orchard.frame'), rows = structuredClone(nalatiRidingSession(NALATI_RIDING_PROGRAMS)); delete rows.figure;
  let reads = 0;
  const shardfile = emptyShardfile({ slug: 'orchard', name: 'Orchard', author: 'Test', revision: 1, seed: 8 });
  const product = createShardProduct({ slug: 'orchard', revision: 1, shardfile, sections: new Map(),
    files: new Map([['orchard.json', { hash: 'a'.repeat(64), url: '/orchard.json' }]]),
    read: () => { reads++; return Promise.resolve(new TextEncoder().encode(JSON.stringify(rows))); } });
  const ctx = legacyDouble<ShardContext>({ scope, product });
  lendNalatiRiding(scope);
  try {
    await installClientRiding(ctx, { kind: 'riding.session', file: 'orchard.json', owner: 'orchard.frame' });
    const owner = entryOwner(scope, 'world-frame', 'orchard.frame');
    owner.update(1 / 30, 1234.5); owner.late(1 / 30, 1234.5);
    expect(reads).toBe(1); expect(entryOwner(scope, 'world-frame', 'orchard.frame')).toBe(owner);
    await expect(installClientRiding(ctx, { kind: 'riding.session', file: 'orchard.json', owner: 'orchard.frame' })).rejects.toThrow('owner');
    expect(reads).toBe(1);
    scope.dispose(); expect(() => owner.update(1, 2000)).toThrow('owner'); expect(() => owner.late(1, 2000)).toThrow('owner');
  } finally { scope.dispose(); }
});

test('frame publication refuses an admission-time reader replacement without publishing', async () => {
  const scope = new Scope('orchard.frame'), rows = structuredClone(nalatiRidingSession(NALATI_RIDING_PROGRAMS)); delete rows.figure;
  let finish: (value: Uint8Array) => void = () => { throw new Error('Read has not started'); };
  const shardfile = emptyShardfile({ slug: 'orchard', name: 'Orchard', author: 'Test', revision: 1, seed: 8 });
  const product = createShardProduct({ slug: 'orchard', revision: 1, shardfile, sections: new Map(),
    files: new Map([['orchard.json', { hash: 'a'.repeat(64), url: '/orchard.json' }]]),
    read: () => new Promise<Uint8Array>(resolve => { finish = resolve; }) });
  const ctx = legacyDouble<ShardContext>({ scope, product });
  try {
    const pending = installClientRiding(ctx, { kind: 'riding.session', file: 'orchard.json', owner: 'orchard.frame' });
    Object.defineProperty(product, 'json', { value: () => Promise.resolve(rows) });
    finish(new TextEncoder().encode(JSON.stringify(rows)));
    await expect(pending).rejects.toThrow('owner changed');
    expect(() => entryOwner(scope, 'world-frame', 'orchard.frame')).toThrow('Missing live entry owner');
  } finally { scope.dispose(); }
});


test('a held ancestor retirement refuses frame admission without reading', async () => {
  const parent = new Scope('orchard.world'), scope = parent.child('orchard.entered');
  let reads = 0;
  const shardfile = emptyShardfile({ slug: 'orchard', name: 'Orchard', author: 'Test', revision: 1, seed: 8 });
  const product = createShardProduct({ slug: 'orchard', revision: 1, shardfile, sections: new Map(), files: new Map(),
    read: () => { reads++; return Promise.reject(new Error('Must not read')); } });
  const ctx = legacyDouble<ShardContext>({ scope, product });
  parent.onDispose(() => undefined); const retiring = parent.disposeSteps(); retiring.next();
  try {
    expect(scope.disposed).toBe(false); expect(scope.disposing).toBe(true);
    await expect(installClientRiding(ctx, { kind: 'riding.session', file: 'orchard.json', owner: 'orchard.frame' })).rejects.toThrow('owner');
    expect(reads).toBe(0);
  } finally { for (const step of retiring) void step; parent.dispose(); }
});
