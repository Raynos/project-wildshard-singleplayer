import { expect, it } from 'vitest';
import { BoxGeometry } from 'three';
import { createOwnedGeometry } from '../src/engine/models/ownedGeometry';

it('copies borrowed input and transfers adopted geometry without retaining it', async () => {
  const source = new BoxGeometry(), intake = createOwnedGeometry('/owned.glb');
  try {
    expect(() => intake.copy()).toThrow('not loaded');
    await intake.load(source);
    const copy = intake.copy(), taken = intake.take();
    expect(taken).not.toBe(source);
    expect(copy.getAttribute('position').array.buffer).not.toBe(taken.getAttribute('position').array.buffer);
    expect(() => intake.take()).toThrow('not loaded');
    intake.adopt(taken);
    expect(() => intake.adopt(copy)).toThrow('already loaded');
    expect(intake.take()).toBe(taken);
    expect(() => intake.copy()).toThrow('not loaded');
    intake.adopt(copy);
    expect(intake.take()).toBe(copy);
    copy.dispose(); taken.dispose();
  } finally { source.dispose(); }
});
