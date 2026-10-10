/**
 * The horizon inside a cell (SHARD-PLATFORM G321 part 4): a shard whose own sky owns its cell owns its horizon too, as on
 * SHARD SELECT, where nothing stands beyond the shard. What stands outside that cell (the road's deck, seams, curtain,
 * boulevard and rail; the neighbours' far proxies, haze bands and ring tiles) dithers out by how much the cells' own skies
 * own the frame (the grid frame's `horizon`, 0..1), from `HORIZON_FADE.near` metres in front of the camera to fully gone
 * at `far`. The same screen-door dither as the void floor (`voidLook.ts`): no blending and no second program, one discard
 * at the top of each fragment shader. What stands near the player (the road at the edge they walk to) stays solid; on the
 * road (share 0) nothing changes.
 *
 * A lit built-in material knows its fragment's world position (`vViewPosition` and the view matrix), so its discard is also
 * limited to fragments outside the owning cell: a material a neighbour shares with the cell's own world (a shardfile
 * family material) never thins the cell itself. A material without it fades by distance alone, so only materials the
 * grid owns outright take that (`patch(…, 'owned')`); a shared one is left whole (`'outside'`).
 */
import { Material, Mesh, Vector4, type Object3D } from 'three';
import type { Scope } from '@wildshard/engine/app/scope';
import { PATCH_ORDER, patchShader } from '@wildshard/engine/render/shaderPatches';

/** The view depth (m) where the fade starts and where it is whole. */
export const HORIZON_FADE = { near: 60, far: 140 } as const;

/**
 * Whose a patched material is: `'owned'` the grid's own (the road, a far proxy, a haze band: it fades by distance where it
 * cannot tell its position), `'outside'` possibly shared with a cell's world (a ring tile: it fades only where it can tell
 * the fragment stands outside the owning cell).
 */
export type HorizonMaterial = 'owned' | 'outside';

/** The fade's uniforms and the patch that puts them in a material's fragment shader. */
export interface HorizonFade {
  /**
   * how much the cells' own skies own the frame (the grid frame's `horizon`, 0..1), and the cell that owns most of it in
   * the page's world frame (its centre and half size; null on the road)
   */
  readonly set: (owned: number, cell: { readonly x: number; readonly z: number; readonly half: number } | null) => void;
  /** dither a material (or every mesh material under a root, once each) out by the share beyond `near` */
  readonly patch: (target: Material | Object3D, kind?: HorizonMaterial) => void;
  /** the share as last set (the readout) */
  readonly owned: () => number;
}

const MAIN = /void\s+main\s*\(\s*(?:void)?\s*\)\s*\{/;
const f = (n: number): string => n.toFixed(1);
const DITHER = 'fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))))';
/** 1 / gl_FragCoord.w is the fragment's view depth under a perspective camera (1 under an orthographic one: no fade) */
const DEPTH = `smoothstep(${f(HORIZON_FADE.near)}, ${f(HORIZON_FADE.far)}, 1.0 / gl_FragCoord.w)`;

/** Make the fade; every patch comes off with `scope`. */
export function horizonFade(scope: Scope): HorizonFade {
  // the owning cell as min x, min z, max x, max z (page world); empty (min > max): everything is outside
  const owned = { value: 0 }, cell = { value: new Vector4(1, 1, -1, -1) }, patched = new WeakSet<Material>();
  const one = (material: Material, kind: HorizonMaterial): void => {
    if (patched.has(material)) return;
    patched.add(material);
    patchShader(material, 'g321-horizon', PATCH_ORDER.decorate, (shader): void => {
      const placed = /varying\s+vec3\s+vViewPosition\s*;/.test(shader.fragmentShader);
      if (!placed && kind === 'outside') return;
      shader.uniforms['wsHorizonOwned'] = owned; shader.uniforms['wsHorizonCell'] = cell;
      const outside = placed
        ? '\n  vec3 wsHorizonAt = transpose(mat3(viewMatrix)) * (-vViewPosition - viewMatrix[3].xyz);'
          + '\n  if (max(max(wsHorizonCell.x - wsHorizonAt.x, wsHorizonAt.x - wsHorizonCell.z), max(wsHorizonCell.y - wsHorizonAt.z, wsHorizonAt.z - wsHorizonCell.w)) > 0.0)'
        : '';
      shader.fragmentShader = shader.fragmentShader.replace(MAIN, (main) => `uniform float wsHorizonOwned;\nuniform vec4 wsHorizonCell;\n${main}\n`
        + `  if (wsHorizonOwned > 0.0) {${outside}\n  if (${DITHER} < wsHorizonOwned * ${DEPTH}) discard;\n  }\n`);
    }, { key: (prior) => `${prior}|g321-horizon-${kind}`, scope });
    material.needsUpdate = true;
  };
  return {
    set: (share, owner) => {
      owned.value = Math.min(1, Math.max(0, share));
      if (owner === null) cell.value.set(1, 1, -1, -1);
      else cell.value.set(owner.x - owner.half, owner.z - owner.half, owner.x + owner.half, owner.z + owner.half);
    },
    patch: (target, kind = 'owned') => {
      if (target instanceof Material) { one(target, kind); return; }
      target.traverse((node) => {
        if (!(node instanceof Mesh)) return;
        const material: unknown = node.material, list: readonly unknown[] = Array.isArray(material) ? material : [material];
        for (const m of list) if (isMaterial(m)) one(m, kind);
      });
    },
    owned: () => owned.value,
  };
}

function isMaterial(value: unknown): value is Material { return value instanceof Material; }
