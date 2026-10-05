import type { Scene } from 'three';

/** Bind the resident fight's damage and scene callbacks only while its home is entered. */
export function installEnteredKingBindings<T>(scene: Scene, damage: { read: () => T; write: (value: T) => void },
  value: T, atmosphere: () => void, entered: (install: () => () => void) => void): void {
  entered(() => {
    const parentDamage = damage.read(), descriptor = Object.getOwnPropertyDescriptor(scene, 'onBeforeRender');
    const previous = scene.onBeforeRender.bind(scene);
    damage.write(value);
    scene.onBeforeRender = (...args) => { atmosphere(); previous(...args); };
    return () => {
      damage.write(parentDamage);
      if (descriptor === undefined) Reflect.deleteProperty(scene, 'onBeforeRender');
      else Object.defineProperty(scene, 'onBeforeRender', descriptor);
    };
  });
}
