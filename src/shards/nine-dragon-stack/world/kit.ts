import type { BufferGeometry } from 'three';

/** Ownership of one offline layout draw; no geometry writer or primitive operations. */
export class Kit {
  private geometry: BufferGeometry | null = null;
  private count = 0;
  static fromBake(geometry: BufferGeometry): Kit {
    const kit = new Kit(); kit.geometry = geometry; kit.count = geometry.getAttribute('position').count; return kit;
  }
  get vertexCount(): number { return this.count; }
  build(): BufferGeometry {
    if (this.geometry === null) throw new Error('Nine empty or released baked kit');
    return this.geometry;
  }
  release(): void { this.geometry = null; }
}
