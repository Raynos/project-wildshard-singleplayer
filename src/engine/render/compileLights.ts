import { DirectionalLight, PointLight, SpotLight, type Light } from 'three';

type ShadowLight = DirectionalLight | PointLight | SpotLight;
const shadowLight = (light: Light): light is ShadowLight => light instanceof DirectionalLight || light instanceof PointLight || light instanceof SpotLight;
interface Copy { readonly source: ShadowLight; readonly light: ShadowLight; borrowed: ShadowLight['shadow']['map'] }

/** Warm-up-only lights preserve the future program's light counts. Borrow an
 * existing shadow without redrawing it; a missing map may be built privately.
 * The warm owns those private maps, never the source light or its attachments. */
export class CompileLights {
  private readonly copies: Copy[] = [];

  copy(source: Light): Light {
    const light = source.clone(false);
    if (shadowLight(source) && shadowLight(light)) this.copies.push({ source, light, borrowed: null });
    return light;
  }

  /** Refresh before each synchronous compile: another painted slice may have
   * resized the page's maps. Suppress writes only on the borrowed shadow. */
  prepare(): void {
    for (const copy of this.copies) {
      const { source, light, borrowed } = copy, map = source.shadow.map;
      if (map !== null) {
        if (light.shadow.map !== null && light.shadow.map !== borrowed) light.shadow.dispose();
        light.shadow.map = map;
        light.shadow.mapPass = null;
        copy.borrowed = map;
      } else if (borrowed !== null) {
        light.shadow.map = null;
        copy.borrowed = null;
      }
      light.shadow.autoUpdate = false;
      light.shadow.needsUpdate = light.shadow.map === null;
    }
  }

  /** Always settle after compile/link/upload, including a cancellation. A
   * borrowed depth texture remains owned and usable by the actual light. */
  dispose(): void {
    for (const { light, borrowed } of this.copies) {
      if (light.shadow.map === borrowed) light.shadow.map = null;
      light.dispose();
      light.removeFromParent();
    }
    this.copies.length = 0;
  }
}
