import * as THREE from 'three';
import { cascadeOf, ghostOf } from '../../world/cascadeLights';
import { atmosphereTerms } from '../../world/Atmosphere';

/** Scene inputs that change generated node code, excluding live uniform values
 * and the identities of replacement lights, fogs and environment textures. */
export class SceneShaderKeys {
  private readonly identities = new WeakMap<object, number>();
  private next = 0;

  private identity(value: object): number {
    const held = this.identities.get(value);
    if (held !== undefined) return held;
    const id = this.next++;
    this.identities.set(value, id);
    return id;
  }

  private light(light: THREE.Light): string | null {
    const builtins = [THREE.AmbientLight, THREE.DirectionalLight, THREE.HemisphereLight,
      THREE.PointLight, THREE.SpotLight, THREE.RectAreaLight];
    if (!builtins.some(kind => Object.getPrototypeOf(light) === kind.prototype)
      || (Reflect.get(light, 'colorNode') !== undefined && Reflect.get(light, 'colorNode') !== null)) return null;
    const fields: unknown[] = [light.type, light.castShadow];
    if (light instanceof THREE.SpotLight && light.map !== null) return null;
    const shadow: unknown = Reflect.get(light, 'shadow');
    if (light.castShadow && typeof shadow === 'object' && shadow !== null) {
      if (Reflect.get(shadow, 'shadowNode') !== undefined && Reflect.get(shadow, 'shadowNode') !== null) return null;
      const filter: unknown = Reflect.get(shadow, 'filterNode');
      if (filter !== undefined && filter !== null && typeof filter !== 'function') return null;
      // A custom filter remains keyed by its actual function, never its name.
      fields.push(typeof filter === 'function' ? this.identity(filter) : null,
        Reflect.get(shadow, 'normalBias') !== 0);
    }
    const cascade = cascadeOf(light);
    if (cascade !== undefined) fields.push(cascade.index, cascade.set.csm.cascades,
      ghostOf(cascade.set, cascade.index) !== undefined);
    return JSON.stringify(fields);
  }

  /** Null keeps stock identity keys for custom scene/light inputs. Call only
   * after the node handler has installed the current render's builtin lights. */
  key(scene: THREE.Object3D, lights: readonly unknown[]): string | null {
    if (!(scene instanceof THREE.Scene)) return null;
    const lightKeys: string[] = [];
    const sorted = lights.slice().sort((a, b) => a instanceof THREE.Light && b instanceof THREE.Light ? a.id - b.id : 0);
    for (const light of sorted) {
      if (!(light instanceof THREE.Light)) return null;
      const key = this.light(light);
      if (key === null) return null;
      lightKeys.push(key);
    }
    const fog = scene.fog;
    if (fog !== null && Object.getPrototypeOf(fog) !== THREE.Fog.prototype
      && Object.getPrototypeOf(fog) !== THREE.FogExp2.prototype) return null;
    const env = scene.environment;
    if (env !== null && env.mapping !== THREE.CubeUVReflectionMapping) return null;
    const texture = env === null ? null : [env.constructor.name, env.mapping, env.format, env.type,
      env.colorSpace, env.flipY, Reflect.get(env, 'isCubeTexture') === true,
      env.isRenderTargetTexture,
      // PMREM's cube-UV dimensions are constants in its generated shader.
      typeof env.image === 'object' && env.image !== null ? Reflect.get(env.image, 'width') : null,
      typeof env.image === 'object' && env.image !== null ? Reflect.get(env.image, 'height') : null];
    return JSON.stringify([lightKeys, fog?.constructor.name ?? null, texture, atmosphereTerms()]);
  }
}
