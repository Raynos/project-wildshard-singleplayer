/**
 * RopeBridge — where the gully's rope bridge hangs (E306 / E315 M1: the bridge is the model
 * src/shards/driftwood-isle/models/ropeBridge.ts; this is the world side). It places the bridge on its span: the model
 * is built for its ends (the terrain under them) and handed over in its own space, placed `single` back at end a; this
 * side hands its deck to the physics chain and poses the drawn deck from it.
 *
 *   const bridge = new RopeBridge(sky, { a: [52, 48], b: [64, 60], sag: 1.1 }).place(registry);  // the game: piece `bridge`
 *   const chain = new RopeChain(physics, bridge.chainSpec());                                     // the deck
 *   game.onFixed('post', () => { chain.capture(); });
 *   game.onUpdate(() => { bridge.setPoses(chain, game.alpha); });
 */
import type * as THREE from 'three';
import { modelContext } from '@wildshard/engine/models/model';
import { place, type Placed } from '@wildshard/engine/models/place';
import type { BoxSpec as Collider } from '@wildshard/engine/physics/box';
import type { WorldRegistry } from '@wildshard/engine/world/registry';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import { ropeBridge, ropeBridgeLayout, type DeckPoses, type RopeBridgeLayout, type RopeBridgeParams, type RopeBridgeSpec } from '../models/ropeBridge';


export class RopeBridge {
  /** the posts (static), the planks and ropes (instanced, posed by `setPoses`), and one holder per deck segment */
  mesh!: THREE.Object3D;
  /** the legacy boxes (the posts, the rails), world space */
  colliders: Collider[] = [];
  private readonly params: RopeBridgeParams;
  private lay: RopeBridgeLayout | null = null;
  /** its placements (the named places' sets read them, src/shards/driftwood-isle/world/places.ts) */
  placed: Placed | null = null;

  constructor(private sky: Sky, spec: RopeBridgeSpec) { this.params = { span: spec, ground: heightAt }; }

  /** the game's: placed and registered (piece `bridge`, the catalog's Rope bridge) */
  place(registry: WorldRegistry): this {
    const lay = this.lay = ropeBridgeLayout(this.sky, this.params), o = lay.o;
    const placed = place(ropeBridge, [{ x: o.x, y: o.y, z: o.z, params: this.params }], { ctx: modelContext(this.sky), draw: 'single', registry,
      piece: { id: 'bridge', floor: (px, pz) => this.floorHeightAt(px, pz), solidFloor: true } });
    this.mesh = placed.object;
    this.placed = placed;
    this.colliders = lay.colliders;
    return this;
  }

  /** the deck for src/engine/physics/ropeChain.ts: the segments at rest (world), their size and weight, their holders as owners */
  chainSpec(): ReturnType<RopeBridgeLayout['chainSpec']> { return this.layout().chainSpec(); }

  /** Pose the drawn deck: from `deck` (a RopeChain, interpolated by `alpha`), or at rest when null. */
  setPoses(deck: DeckPoses | null, alpha: number): void { this.layout().setPoses(deck, alpha); }

  /** the plank height under (x, z) when over the span (the live deck while a chain poses it), else undefined */
  floorHeightAt(x: number, z: number): number | undefined { return this.layout().floorHeightAt(x, z); }

  private layout(): RopeBridgeLayout { return (this.lay ??= ropeBridgeLayout(this.sky, this.params)); }
}
