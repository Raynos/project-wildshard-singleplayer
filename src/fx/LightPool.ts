import * as THREE from 'three';

/**
 * LightPool — a fixed set of scene PointLights driven by intensity only (B7). three.js bakes the NUMBER of lights into
 * every lit program, so adding, removing or hiding (`visible = false`, or hiding a parent) a light mid-play recompiles
 * every lit material in view — a multi-second hitch on iOS. The pool's lights are created during boot (as they are
 * acquired), live in one always-visible group at the scene root, and are never removed: a released light just sits at
 * intensity 0. The pool SEALS itself on the scene's first real render (after the boot's precompile), so from then on
 * the light count is fixed: a mid-play `acquire()` reuses a released light, and when none is free it hands back a
 * detached light (not in the scene: it lights nothing, costs nothing, never recompiles) and warns once.
 *
 *   const light = LightPool.for(scene).acquire(0xffb257, 18, 11, 1.6);   // colour, intensity, distance, decay
 *   light.position.set(x, y, z);                                          // WORLD space (the pool group sits at the origin)
 *   light.intensity = …;                                                  // drive it every frame
 *   LightPool.for(scene).release(light);                                  // intensity 0, free for the next acquire
 *
 * Shadows are never cast by a pooled light. `LightPool.for(scene).size` / `.free` for the perf meter / dev.
 */
export class LightPool {
  private static pools = new WeakMap<THREE.Scene, LightPool>();
  /** the pool of `scene` (made, and hooked to seal on the first render, on first use) */
  static for(scene: THREE.Scene): LightPool {
    let p = LightPool.pools.get(scene);
    if (p === undefined) { p = new LightPool(scene); LightPool.pools.set(scene, p); }
    return p;
  }

  readonly group = new THREE.Group();
  private lights: THREE.PointLight[] = [];
  private busy = new Set<THREE.PointLight>();
  private sealed = false;
  private warned = false;

  private constructor(scene: THREE.Scene) {
    this.group.name = 'light-pool';
    scene.add(this.group);
    // seal on the first real render (compileAsync in the boot's precompile does not call it; firstFrame's render does)
    const prev = scene.onBeforeRender.bind(scene);
    scene.onBeforeRender = (...args) => { this.sealed = true; prev(...args); };
  }

  get size(): number { return this.lights.length; }
  get free(): number { return this.lights.length - this.busy.size; }
  /** stop growing now (tests / a dev harness that renders before its pickups exist) */
  seal(): void { this.sealed = true; }

  acquire(color: THREE.ColorRepresentation, intensity: number, distance: number, decay = 2): THREE.PointLight {
    let light = this.lights.find((l) => !this.busy.has(l));
    if (light === undefined) {
      light = new THREE.PointLight();
      light.castShadow = false;
      if (this.sealed) {
        if (!this.warned) { this.warned = true; console.warn('[LightPool] sealed and full: a mid-play light was asked for — handing out an unlit one (no recompile)'); }
        light.color.set(color); light.intensity = intensity; light.distance = distance; light.decay = decay;
        return light; // detached: never in the scene
      }
      this.lights.push(light); this.group.add(light);
    }
    this.busy.add(light);
    light.color.set(color); light.intensity = intensity; light.distance = distance; light.decay = decay;
    return light;
  }

  /** back to the pool: dark, still in the scene (a detached light from a full pool is simply dropped) */
  release(light: THREE.PointLight): void {
    light.intensity = 0;
    this.busy.delete(light);
  }
}
