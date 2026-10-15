import { loadLUT, preloadBakedTextures } from '@wildshard/engine/boot/bakedApi';
import { resourceScope } from '@wildshard/engine/app/resources';
import type { OffscreenPass, SkyBackdrop, SkyBackdropContext, SkyBackdropFactory, SkyBackdropPost, SkyBackdropTargets } from '@wildshard/engine/render/look';
import { prepareOffscreenBuild } from '@wildshard/engine/render/offscreenBuild';
import { SkyEnvironment, type SkyEnvironmentRefresh, type SkyEnvironmentSource } from '@wildshard/engine/render/skyEnvironment';
import type { DayCycle } from '@wildshard/engine/world/dayCycle';
import { lookGraphMaterials } from '@wildshard/game/plugin/shaderFamily';
import * as THREE from 'three';

/**
 * A day sky drawn on material graphs, as a backdrop (SHARD-PLATFORM W2 C2; Pine Hollow's keyed sky and Driftwood's
 * faceted day): the lifecycle every graph day sky shares, so a shard writes only its sky and its clock's frame.
 *
 * THE HOST compiles the sky's graphs from the shard's look catalogue on the page renderer (they leave with the backdrop's
 * owner), preloads the baked textures and the level's LUT beside them, adds the dome to the scene (the background off),
 * owns the image-based light (`SkyEnvironment`: the source PMREM'd in place, refreshed on its timer; a scene source may
 * build its first environment offscreen), runs the clock (`onSet`: wait for what the phase needs, snap every knob, redraw
 * the environment), keeps the dome on the camera when asked, and frees the dome, the environment pass and the environment
 * when the backdrop leaves (a grid region's layered sky, G223), reporting their GPU bytes.
 *
 * THE SHARD builds its sky from the compiled graphs (`build`): its dome, its environment source, its running clock
 * (`runDayClock`), its frame (`drive`: every knob the clock turns, from `bind` on, `snap` at a jump) and whatever it holds
 * beyond them (decoded keys: `prepare`, `bytes`, `ceiling`, `rebuild`, `dispose`). Nothing here knows a shard or its sky.
 *
 *   backdrop: graphDaySkyBackdrop({ name, source, ids: [dome, env], build: async (context, graphs) => ({ clock, dome, … }) })
 */

/** A day sky's compiled graphs: a material by look.materials id, and the checked param / texture setters. */
export interface DaySkyGraphs {
  readonly material: (id: string) => THREE.Material;
  readonly setParam: (id: string, name: string, value: number | number[]) => void;
  readonly setTexture: (id: string, name: string, texture: THREE.Texture) => void;
}

/** The image-based light a day sky refreshes: its source and timer; `offscreenFirst` builds a scene source's first PMREM
 *  offscreen (WebKit) when the backdrop builds, instead of on its first bind. */
export interface DaySkyEnvironment {
  readonly source: SkyEnvironmentSource;
  readonly refresh: SkyEnvironmentRefresh;
  readonly offscreenFirst?: boolean;
}

/** What a shard's day sky is, once built from its graphs. */
export interface DaySkyBody<K> {
  /** its running clock (`runDayClock`): the host sets its `onSet` */
  readonly clock: DayCycle<K>;
  /** its dome, added to the scene and freed with the backdrop */
  readonly dome: THREE.Mesh;
  /** true: the host keeps the dome on the camera; false: Game does (it is handed over as the backdrop's `clouds`) */
  readonly follow: boolean;
  readonly environment: DaySkyEnvironment;
  /** the colour of the horizon the sky's dressing fades into */
  readonly horizon: THREE.Color;
  /** every knob the clock turns, at its phase, each frame and at a jump (`snap`); `targets` null until `bind`, `post` until
   *  `attachPost` */
  readonly drive: (targets: SkyBackdropTargets | null, post: SkyBackdropPost | null, snap: boolean) => void;
  /** each frame, before the clock moves (the sky's own timers) */
  readonly tick?: (dt: number) => void;
  /** before a jump snaps: load what the clock's new phase needs (decoded keys) */
  readonly prepare?: () => Promise<void>;
  /** once at bind, before the first frame (a target the sky sets only once) */
  readonly bound?: (targets: SkyBackdropTargets) => void;
  /** GPU bytes the sky holds now / at most beyond the dome and the environment */
  readonly bytes?: () => number;
  readonly ceiling?: () => number;
  /** after a context loss, before the host re-snaps the clock: drop what the GPU lost */
  readonly rebuild?: () => void;
  /** free what the sky holds beyond the dome and the environment */
  readonly dispose?: () => void;
  /** the backdrop's other fields (update order, the planet, the palette a horizon matte blends with) */
  readonly backdrop?: Pick<SkyBackdrop, 'updateAt' | 'fadesPlanet' | 'palette'>;
}

/** What a graph day sky backdrop is built from. */
export interface GraphDaySkySpec<K> {
  /** the shard's name, for errors */
  readonly name: string;
  /** the shard's declaration, and the look.materials ids of the sky's graphs */
  readonly source: Parameters<typeof lookGraphMaterials>[2];
  readonly ids: readonly string[];
  readonly build: (context: SkyBackdropContext, graphs: DaySkyGraphs) => Promise<DaySkyBody<K>>;
}

/** free a mesh's geometry and material(s) */
function freeMesh(o: THREE.Object3D): void {
  if (!(o instanceof THREE.Mesh)) return;
  const geometry: unknown = o.geometry, material: unknown = o.material, list: unknown[] = Array.isArray(material) ? material : [material];
  if (geometry instanceof THREE.BufferGeometry) geometry.dispose();
  for (const m of list) if (m instanceof THREE.Material) m.dispose();
}

/** A shard's graph day sky as a sky backdrop (see the module comment). */
export function graphDaySkyBackdrop<K>(spec: GraphDaySkySpec<K>): SkyBackdropFactory {
  return async (context) => {
    const { scene, renderer, level } = context, owner = resourceScope();
    const [compiled, , lut] = await Promise.all([lookGraphMaterials(owner, context, spec.source, spec.ids), preloadBakedTextures(), loadLUT(level.id)]);
    const graphs: DaySkyGraphs = { setParam: compiled.setParam, setTexture: compiled.setTexture, material: (id) => {
      const m = compiled.materials.get(id);
      if (m === undefined) throw new Error(`${spec.name}: look.materials lacks the sky graph ${id}`);
      return m;
    } };
    const body = await spec.build(context, graphs), { clock, dome, environment } = body, source = environment.source;
    scene.background = null;
    scene.add(dome);
    const env = new SkyEnvironment(renderer, scene, source, environment.refresh);
    if (environment.offscreenFirst === true && source.kind === 'scene') {
      const prepared: { generator: THREE.PMREMGenerator | null } = { generator: null };
      try {
        const first = await prepareOffscreenBuild(renderer, (commands) => {
          prepared.generator = new THREE.PMREMGenerator(commands);
          return prepared.generator.fromScene(source.scene, 0, source.near, source.far, { size: source.size });
        }, () => !owner.disposed, { webKitOnly: true });
        env.adopt(prepared.generator, first);
      } catch (error) { prepared.generator?.dispose(); throw error; }
    }
    let targets: SkyBackdropTargets | null = null, post: SkyBackdropPost | null = null;
    const drive = (snap: boolean): void => { body.drive(targets, post, snap); };
    clock.onSet = async () => { await body.prepare?.(); drive(true); env.refresh(); };
    const pass: OffscreenPass | undefined = source.kind === 'equirect' ? { scene: source.scene, camera: source.camera, target: source.target } : undefined;
    return {
      clock, horizon: body.horizon, lut, ...body.backdrop,
      ...(body.follow ? {} : { clouds: dome }),
      ...(pass === undefined ? {} : { environmentPass: pass }),
      bind: (T) => {
        targets = T; body.bound?.(T); drive(true);
        if (environment.offscreenFirst !== true) env.refresh(); // an offscreen first build is already the sky of the hour
      },
      update: (dt, camera) => {
        body.tick?.(dt);
        clock.update(dt);
        if (body.follow) dome.position.copy(camera.position);
        drive(false);
        env.update(dt);
      },
      rebuild: () => { body.rebuild?.(); env.rebuild(); void clock.set(clock.phase); }, // a fresh generator: the old one's targets belong to the lost context
      attachPost: (p) => { post = p; drive(true); },
      dispose: () => {
        body.dispose?.();
        dome.removeFromParent(); freeMesh(dome);
        source.scene.traverse(freeMesh);
        if (source.kind === 'equirect') source.target.dispose();
        env.dispose(); // its target, its generator's ping-pong target, blur and GGX passes
      },
      gpuBytes: () => env.bytes() + (body.bytes?.() ?? 0),
      gpuCeiling: () => env.ceiling() + (body.ceiling?.() ?? 0),
    };
  };
}
