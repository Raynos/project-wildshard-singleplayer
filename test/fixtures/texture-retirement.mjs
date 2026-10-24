import * as THREE from 'three';
import { Scope } from '../../src/engine/app/scope';
import { emptyShardfile } from '../../src/sdk/author';
import { parseFamilyMaterial } from '../../src/format/materialFamilies';
import { clientMaterials } from '../../src/game/shardfile/clientMaterials';
import { splatArray } from '../../src/game/shardfile/clientSplatTerrain';
import { finalizeCompressedMipmaps } from '../../src/engine/render/compressedMipmaps';

// Raw RGBA8 KTX2, one 4x4 level. The actual loader supplies image.data and its mip alias.
function rawKtx2() {
  const descriptor = 92, offset = 104 + descriptor, pixels = new Uint8Array(64);
  for (let i = 0; i < 16; i++) pixels.set([i * 13, 255 - i * 11, i * 7, 255], i * 4);
  const bytes = new Uint8Array(offset + pixels.length), view = new DataView(bytes.buffer);
  bytes.set([171, 75, 84, 88, 32, 50, 48, 187, 13, 10, 26, 10]);
  [37, 1, 4, 4, 0, 0, 1, 1, 0, 104, descriptor].forEach((value, i) => { view.setUint32(12 + i * 4, value, true); });
  view.setBigUint64(80, BigInt(offset), true); view.setBigUint64(88, 64n, true); view.setBigUint64(96, 64n, true);
  view.setUint32(104, descriptor, true); view.setUint16(112, 2, true); view.setUint16(114, descriptor - 4, true);
  bytes.set([1, 1, 1], 116); bytes[124] = 4; bytes.set(pixels, offset);
  return { bytes, pixels };
}

function assert(condition, message) { if (!condition) throw new Error(message); }

/** Actual WebGL readback, including successful draws after the CPU levels retire. */
export async function textureRetirementProof() {
  const renderer = new THREE.WebGLRenderer({ antialias: false });
  renderer.setSize(32, 32); renderer.setPixelRatio(1); renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  const target = new THREE.WebGLRenderTarget(32, 32), scope = new Scope('texture-pixel-proof');
  const geometry = new THREE.PlaneGeometry(2, 2), camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 2);
  camera.position.z = 1; const scene = new THREE.Scene(), mesh = new THREE.Mesh(geometry);scene.add(mesh);
  const owned = [mesh.material], textures = [], results = [];
  const render = material => {
    mesh.material = material;renderer.setRenderTarget(target);renderer.render(scene, camera);
    const pixels = new Uint8Array(32 * 32 * 4);renderer.readRenderTargetPixels(target, 0, 0, 32, 32, pixels);return pixels;
  };
  const compare = (name, reference, candidate, beforeBytes, afterBytes) => {
    let differences = 0, lit = 0;
    for (let i = 0; i < reference.length; i++) { if (reference[i] !== candidate[i]) differences++; if (i % 4 !== 3 && reference[i] !== 0) lit++; }
    assert(lit > 0, `${name}: blank control`);assert(differences === 0, `${name}: ${differences} channels changed`);
    assert(beforeBytes > 0 && afterBytes === 0, `${name}: CPU copy did not retire`);
    results.push({ name, pixels: reference.length / 4, differingChannels: differences, beforeBytes, afterBytes });
  };
  try {
    const shard = emptyShardfile({ slug: 'texture-proof', name: 'Texture proof', author: 'Test', seed: 1, revision: 1 });
    shard.look.materials['raw'] = parseFamilyMaterial({ family: 'painterly', map: 'raw' });
    const raw = rawKtx2(), materials = await clientMaterials(shard, new Map([['raw', raw.bytes]]), renderer, scope, { graphs: false });
    const texture = materials.textures.get('raw');assert(texture instanceof THREE.DataTexture, 'Raw KTX2 did not decode to DataTexture');textures.push(texture);
    const reference = new THREE.DataTexture(raw.pixels, 4, 4);reference.flipY = texture.flipY;reference.colorSpace = texture.colorSpace;
    reference.minFilter = texture.minFilter;reference.magFilter = texture.magFilter;reference.generateMipmaps = texture.generateMipmaps;reference.needsUpdate = true;textures.push(reference);
    const control = new THREE.MeshBasicMaterial({ map: reference }), released = new THREE.MeshBasicMaterial({ map: texture });owned.push(control, released);
    const rawBefore = texture.image.data.byteLength, baseline = render(control);render(released);
    compare('raw KTX2', baseline, render(released), rawBefore, texture.image.data.byteLength);
    assert(texture.mipmaps.length === 0, 'Raw KTX2 retained its mip alias');

    assert(renderer.extensions.has('WEBGL_compressed_texture_s3tc'), 'Splat proof requires S3TC support');
    const layers = [0xf800, 0x07e0, 0x001f, 0xffff].map(colour => {
      const data = new Uint8Array(8), view = new DataView(data.buffer);view.setUint16(0, colour, true);view.setUint16(2, colour, true);
      const layer = new THREE.CompressedTexture([{ data, width: 4, height: 4 }], 4, 4, THREE.RGB_S3TC_DXT1_Format);textures.push(layer);return layer;
    });
    const array = splatArray('colour', layers, 1);textures.push(array);
    const shader = new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, uniforms: { image: { value: array }, layer: { value: 0 } },
      vertexShader: 'out vec2 tex; void main(){tex=uv;gl_Position=vec4(position,1.);}',
      fragmentShader: 'precision highp sampler2DArray; uniform sampler2DArray image; uniform float layer; in vec2 tex; out vec4 colour; void main(){colour=texture(image,vec3(tex,layer));}' });owned.push(shader);
    const before = array.mipmaps.reduce((bytes, mip) => bytes + mip.data.byteLength, 0), controls = [];
    for (let layer = 0; layer < 4; layer++) { shader.uniforms.layer.value = layer;controls.push(render(shader)); }
    // The engine retires finalized compressed levels only after a successful actual draw.
    finalizeCompressedMipmaps(array);
    for (let layer = 0; layer < 4; layer++) {
      shader.uniforms.layer.value = layer;
      compare(`splat layer ${layer}`, controls[layer], render(shader), before, array.mipmaps.reduce((bytes, mip) => bytes + mip.data.byteLength, 0));
    }
    assert(renderer.getContext().getError() === 0, 'WebGL reported an error');return results;
  } finally {
    scope.dispose();for (const material of owned) material.dispose();for (const texture of textures) texture.dispose();
    geometry.dispose();target.dispose();renderer.dispose();
  }
}
