// Dev-only: the app's own three.js instance + the glTF loader, for scripts that inject objects into the running game
// through page.evaluate (scripts/nalati-models-compare.mjs): `const { THREE, GLTFLoader, MeshoptDecoder } = await import('/src/dev/threeKit.ts')`.
// Importing through a src module keeps ONE three.js in the page (a second copy breaks instanceof checks and materials).
export * as THREE from 'three';
export { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
export { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
