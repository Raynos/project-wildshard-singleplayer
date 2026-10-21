import { Box3, BufferAttribute, BufferGeometry, Material, Mesh, MeshStandardMaterial, Raycaster, Vector3, type Intersection, type SkinnedMesh } from 'three';

export interface PracticeNativeMeshContact { readonly point: Vector3; readonly distance: number; readonly headshot: boolean }

/** Arena-only exact triangle queries for a bounded rigidly skinned native source. The render rig remains
 * the sole pose consumer. Queries read its current published locals, never publish a different endpoint,
 * interpolate, advance a clock, or touch physics. Between fixed publication and rendering this intentionally
 * hits the last displayed pose, not an invisible future endpoint. No legacy capsule gates this query.
 *
 * Deformed local positions are cached once per changed mesh/bone matrix, not once per sword sweep ray.
 * The private CPU-only mesh is never attached/rendered. Only its owned geometry is disposed here. */
export class PracticeNativeMeshHit {
  private readonly geometry = new BufferGeometry();
  private readonly query: Mesh;
  private readonly ray = new Raycaster();
  private readonly intersections: Intersection[] = [];
  private readonly vertex = new Vector3();
  private readonly worldBounds = new Box3();
  private readonly matrices: Float64Array;
  private readonly owners: Uint8Array;
  private readonly head: number;
  private initialized = false;
  private disposed = false;
  private readonly sourceGeometry;
  private readonly sourcePosition;
  private readonly sourceIndex;

  constructor(private readonly source: SkinnedMesh) {
    this.validateMaterial();
    const geometry = source.geometry;
    if (!['position', 'skinIndex', 'skinWeight'].every(name => geometry.hasAttribute(name))) throw new Error('Missing native source hit attributes');
    const position = geometry.getAttribute('position');
    const indices = geometry.getAttribute('skinIndex'), weights = geometry.getAttribute('skinWeight');
    const bones = source.skeleton.bones, index = geometry.getIndex();
    const count = index?.count ?? position.count;
    // A lower opt-in admission bound, not an expansion of any source/physics cap.
    if (position.count < 3 || position.count > 16384 || count > 49152 || count % 3 !== 0
      || bones.length === 0 || bones.length > 32 || indices.itemSize !== 4 || weights.itemSize !== 4
      || indices.count !== position.count || weights.count !== position.count
      || Object.keys(geometry.morphAttributes).length > 0) throw new Error('Unsupported native source hit geometry');
    this.head = bones.findIndex(bone => bone.name === 'head');
    if (this.head < 0 || bones.filter(bone => bone.name === 'head').length !== 1) throw new Error('Missing native hit head owner');
    this.owners = new Uint8Array(position.count);
    for (let i = 0; i < position.count; i++) {
      const owner = indices.getX(i);
      if (!Number.isInteger(owner) || owner < 0 || owner >= bones.length || weights.getX(i) !== 1
        || weights.getY(i) !== 0 || weights.getZ(i) !== 0 || weights.getW(i) !== 0
        || ![position.getX(i), position.getY(i), position.getZ(i)].every(Number.isFinite))
        throw new Error('Native source hits require finite single-owner vertices');
      this.owners[i] = owner;
    }
    for (let i = 0; i < count; i += 3) {
      const corners = [index?.getX(i) ?? i, index?.getX(i + 1) ?? i + 1, index?.getX(i + 2) ?? i + 2];
      if (corners.some(corner => !Number.isInteger(corner) || corner < 0 || corner >= position.count)
        || new Set(corners.map(corner => this.owners[corner])).size !== 1)
        throw new Error('Native source hit triangles require one coherent owner');
    }
    this.sourceGeometry = geometry; this.sourcePosition = position; this.sourceIndex = index;
    this.geometry.setAttribute('position', new BufferAttribute(new Float64Array(position.count * 3), 3));
    // Copy indices rather than acquiring ownership of the live rig's buffer.
    if (index !== null) this.geometry.setIndex(index.clone());
    this.query = new Mesh(this.geometry, source.material); this.query.matrixAutoUpdate = false;
    this.matrices = new Float64Array((bones.length + 3) * 16);
  }

  private validateMaterial(): void {
    const materials = Array.isArray(this.source.material) ? this.source.material : [this.source.material];
    const material = materials[0];
    if (materials.length !== 1 || material === undefined) throw new Error('Native source hits require one material');
    // Node-backed practice looks may style colour/light, but may not move the source vertices.
    const node = Reflect.get(material, 'isMeshStandardNodeMaterial') === true;
    if (node) {
      if (['positionNode', 'vertexNode', 'geometryNode'].some(key => Reflect.get(material, key) !== null)
        || Reflect.get(material, 'displacementMap') !== null) throw new Error('Native source hits reject GPU displacement');
    } else if (!(material instanceof MeshStandardMaterial) || material.displacementMap !== null
      || material.onBeforeCompile !== Material.prototype.onBeforeCompile)
      throw new Error('Native source hits reject unverified shader geometry');
  }

  private refresh(): void {
    this.validateMaterial();
    const source = this.source;
    if (source.geometry !== this.sourceGeometry || source.geometry.getAttribute('position') !== this.sourcePosition
      || source.geometry.getIndex() !== this.sourceIndex) throw new Error('Native source hit topology changed');
    source.parent?.updateWorldMatrix(true, false); source.updateMatrixWorld(true);
    let changed = !this.initialized, offset = 0;
    for (const matrix of [source.matrixWorld, source.bindMatrix, source.bindMatrixInverse, ...source.skeleton.bones.map(bone => bone.matrixWorld)]) {
      for (const value of matrix.elements) {
        if (!Number.isFinite(value)) throw new Error('Non-finite native source hit pose');
        if (this.matrices[offset] !== value) changed = true;
        this.matrices[offset++] = value;
      }
    }
    if (changed) {
      const positions = this.geometry.getAttribute('position');
      for (let i = 0; i < positions.count; i++) {
        source.getVertexPosition(i, this.vertex);
        if (![this.vertex.x, this.vertex.y, this.vertex.z].every(Number.isFinite)) throw new Error('Non-finite native source hit vertex');
        positions.setXYZ(i, this.vertex.x, this.vertex.y, this.vertex.z);
      }
      this.geometry.computeBoundingBox(); this.geometry.computeBoundingSphere(); this.initialized = true;
    }
    this.geometry.clearGroups();
    for (const group of source.geometry.groups) this.geometry.addGroup(group.start, group.count, group.materialIndex);
    this.geometry.setDrawRange(source.geometry.drawRange.start, source.geometry.drawRange.count);
    this.query.material = source.material; this.query.matrixWorld.copy(source.matrixWorld);
  }

  /** Conservative current-mesh broadphase only. The triangle ray remains the actual hit test. */
  inReach(origin: Vector3, range: number): boolean {
    if (this.disposed || !this.source.visible) return false;
    if (![origin.x, origin.y, origin.z, range].every(Number.isFinite) || range < 0) throw new Error('Invalid native source hit reach');
    this.refresh();
    const bounds = this.geometry.boundingBox;
    if (bounds === null) throw new Error('Missing native source hit bounds');
    return this.worldBounds.copy(bounds).applyMatrix4(this.source.matrixWorld).distanceToPoint(origin) <= range;
  }

  cast(origin: Vector3, direction: Vector3, maxDistance: number): PracticeNativeMeshContact | null {
    if (this.disposed || !this.source.visible) return null;
    if (![origin.x, origin.y, origin.z, direction.x, direction.y, direction.z, maxDistance].every(Number.isFinite)
      || maxDistance < 0 || Math.abs(direction.lengthSq() - 1) > 1e-6) throw new Error('Invalid native source hit ray');
    this.refresh();
    this.ray.set(origin, direction); this.ray.near = 0; this.ray.far = maxDistance;
    this.intersections.length = 0; this.query.raycast(this.ray, this.intersections);
    let nearest: Intersection | undefined;
    for (const hit of this.intersections) if (nearest === undefined || hit.distance < nearest.distance) nearest = hit;
    if (nearest?.face === undefined || nearest.face === null) return null;
    return { point: nearest.point, distance: nearest.distance, headshot: this.owners[nearest.face.a] === this.head };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true; this.intersections.length = 0; this.geometry.dispose();
  }
}
