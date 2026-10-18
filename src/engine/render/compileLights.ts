import { DirectionalLight, PointLight, SpotLight, type Light } from 'three';

type ShadowLight = DirectionalLight | PointLight | SpotLight;
const shadowLight = (light: Light): light is ShadowLight => light instanceof DirectionalLight || light instanceof PointLight || light instanceof SpotLight;
interface Copy { readonly source: ShadowLight; readonly light: ShadowLight; borrowed: ShadowLight['shadow']['map'] }

/** Warm-up-only lights preserve the future program's light counts. Borrow an
 * existing shadow without redrawing it; a missing map may be built privately.
 * The warm owns those private maps, never the source light or its attachments. */
export class CompileLights {
  private readonly copies: Copy[] = [];
  private readonly aliases: { source: Light; light: Light }[] = [];

  copy(source: Light): Light {
    const light = source.clone(false);
    this.aliases.push({ source, light });
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

  /** Use the real light identities for one synchronous compile. Node programs key
   * on light ids and retain their uniform sources, so stand-ins cannot warm them.
   * A traversal alias never reparents the source. Existing shadows stay read-only;
   * newly allocated maps belong to the source and redraw on its first real frame. */
  borrowSources(): () => void {
    const restores: (() => void)[] = [];
    const restore = (): void => { for (const release of restores.reverse()) release(); restores.length = 0; };
    try { for (const { source, light } of this.aliases) {
      const parent = light.parent;
      if (parent === null) continue;
      const index = parent.children.indexOf(light), children = source.children;
      if (index === -1) throw new Error('Compile light lost its traversal slot');
      const shadow = shadowLight(source) ? source.shadow : null;
      const map = shadow?.map, auto = shadow?.autoUpdate, needs = shadow?.needsUpdate;
      if (shadow !== null && map !== null) { shadow.autoUpdate = false; shadow.needsUpdate = false; }
      parent.children[index] = source; source.children = [];
      restores.push(() => {
        parent.children[index] = light; source.children = children;
        if (shadow !== null && auto !== undefined && needs !== undefined) {
          shadow.autoUpdate = auto; shadow.needsUpdate = needs || map === null && shadow.map !== null;
        }
      });
    } } catch (error) { restore(); throw error; }
    return restore;
  }

  /** Always settle after compile/link/upload, including a cancellation. A
   * borrowed depth texture remains owned and usable by the actual light. */
  dispose(): void {
    for (const { light, borrowed } of this.copies) {
      if (light.shadow.map === borrowed) light.shadow.map = null;
      light.dispose();
      light.removeFromParent();
    }
    this.copies.length = 0; this.aliases.length = 0;
  }
}
