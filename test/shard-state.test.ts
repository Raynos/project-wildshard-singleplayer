// src/core/shardState.ts (SHARD-CACHE M3, E155): each resident shard's module state is captured when it parks, reset
// before another shard builds and restored when it plays again.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { captureShardState, listSlot, resetShardState, restoreShardState, setSlot, shardSlot, stateSlot } from '../src/core/shardState';

describe('shard state slots', () => {
  it('a module variable: capture → reset → restore, and a fresh container for a new shard', () => {
    let v = new Map<string, number>();
    shardSlot('test.map', () => v, (x) => { v = x; }, () => new Map<string, number>());
    const first = v;
    first.set('a', 1);
    const a = captureShardState();
    resetShardState();
    expect(v).not.toBe(first); // a new shard never shares the first one's container
    expect(v.size).toBe(0);
    v.set('b', 2);
    restoreShardState(a);
    expect(v).toBe(first);
    expect(v.get('a')).toBe(1);
  });

  it('a uniform bag: values are copied into the live uniforms (materials keep their references)', () => {
    const bag = { uColor: { value: new THREE.Color(1, 0, 0) }, uAmt: { value: 0.5 }, uTex: { value: null as THREE.Texture | null } };
    stateSlot('test.bag', bag);
    const liveColor = bag.uColor.value, liveUniform = bag.uAmt;
    const tex = new THREE.Texture();
    bag.uColor.value.set(0, 1, 0); bag.uAmt.value = 0.9; bag.uTex.value = tex;
    const a = captureShardState();
    resetShardState();
    expect(bag.uColor.value).toBe(liveColor); // the same Color object …
    expect(bag.uColor.value.r).toBe(1); // … back to its first value
    expect(bag.uAmt).toBe(liveUniform);
    expect(bag.uAmt.value).toBe(0.5);
    expect(bag.uTex.value).toBeNull();
    restoreShardState(a);
    expect(bag.uColor.value.g).toBe(1);
    expect(bag.uAmt.value).toBe(0.9);
    expect(bag.uTex.value).toBe(tex); // a texture by reference
  });

  it('a hook object: a hook set by one shard is not another shard\'s', () => {
    const hooks: { onHit?: (() => void) | undefined } = {};
    stateSlot('test.hooks', hooks);
    const f = (): void => undefined;
    hooks.onHit = f;
    const a = captureShardState();
    resetShardState();
    expect(hooks.onHit).toBeUndefined();
    restoreShardState(a);
    expect(hooks.onHit).toBe(f);
  });

  it('lists and sets: their members per shard', () => {
    const list: number[] = [], set = new Set<number>();
    listSlot('test.list', list); setSlot('test.set', set);
    list.push(1, 2); set.add(3);
    const a = captureShardState();
    resetShardState();
    expect(list).toEqual([]); expect(set.size).toBe(0);
    list.push(9);
    restoreShardState(a);
    expect(list).toEqual([1, 2]); expect([...set]).toEqual([3]);
  });

  it('a slot registered after a capture resets when that capture is restored', () => {
    const a = captureShardState();
    let late = 1;
    shardSlot('test.late', () => late, (x) => { late = x; });
    late = 5;
    restoreShardState(a);
    expect(late).toBe(1);
  });
});
