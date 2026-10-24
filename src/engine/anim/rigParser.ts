import type { LoadingManager } from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { installGltfKtx2 } from '../core/ktx2';
import { pageScope } from '../app/resources';
import { workSlice, type WorkSlice } from '../core/workSlice';

// FileLoader starts every network read immediately. Only the parser's temporary
// meshopt/image/geometry allocations share this page-wide decode slot.
let decodeTail: Promise<void> = Promise.resolve();
let decodeSlice: WorkSlice | undefined;
/** The shared loader defers immutable bytes until its decode slot. Complete GLBs
 * lend their wire buffer: Three copies the BIN chunk before decoding geometry. */
export interface RigLoader extends GLTFLoader {
  parseBytesAsync: (bytes: Uint8Array, path: string) => Promise<GLTF>;
}
class BoundedRigLoader extends GLTFLoader implements RigLoader {
  override parse(...[data, path, onLoad, onError]: Parameters<GLTFLoader['parse']>): void {
    this.parseSource(() => data, path, onLoad, onError);
  }
  parseBytesAsync(bytes: Uint8Array, path: string): Promise<GLTF> {
    return new Promise((resolve, reject) => { this.parseSource(() => {
      const buffer = bytes.buffer;
      if (buffer instanceof ArrayBuffer && bytes.byteOffset === 0 && bytes.byteLength === buffer.byteLength && bytes.byteLength >= 12) {
        const header = new DataView(buffer);
        if (header.getUint32(0, true) === 0x46546c67 && header.getUint32(4, true) === 2 && header.getUint32(8, true) === bytes.byteLength) return buffer;
      }
      return Uint8Array.from(bytes).buffer;
    }, path, resolve, reject); });
  }
  private parseSource(read: () => Parameters<GLTFLoader['parse']>[0], path: string, onLoad: (file: GLTF) => void, onError?: Parameters<GLTFLoader['parse']>[3]): void {
    const parsed = decodeTail.then(async () => {
      // Cached CPU-only models otherwise chain every parse in microtasks. Let
      // uploads/frames and temporary-buffer retirement run between spent slices.
      if (typeof window !== 'undefined') await (decodeSlice ??= workSlice(undefined, pageScope)).check();
      return new Promise<GLTF>((resolve, reject) => { super.parse(read(), path, resolve, reject); });
    });
    // A failed file must release the slot as well as a successful one. Keep no
    // decoded scene in the tail after handing it to its existing resource owner.
    decodeTail = parsed.then(() => undefined, () => undefined);
    void parsed.then(onLoad, onError ?? ((error: unknown) => { console.error(error); }));
  }
}

/** One native parser policy for rigs, model pools and owned geometry. Reads stay
 * parallel; a page decodes one GLTF at a time, including direct parseAsync calls. */
export function createRigLoader(manager?: LoadingManager): RigLoader { installGltfKtx2(GLTFLoader); return new BoundedRigLoader(manager).setMeshoptDecoder(MeshoptDecoder); }

