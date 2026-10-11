import * as THREE from 'three';
import { loadTrainingDummy } from '../../src/engine/practice/TrainingDummyAssets';
import { applyDummyStudio } from '../../src/engine/practice/DummyStudio';

window.captureFigure = async variant => {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(2); renderer.setSize(402, 760);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
  document.body.append(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x101d2c);
  const model = await loadTrainingDummy(variant); applyDummyStudio(model.root, renderer); scene.add(model.root);
  const camera = new THREE.PerspectiveCamera(36, 402 / 760, 0.1, 100);
  camera.position.set(3.2, 1.5, 5.2); camera.lookAt(0, 0.85, 0); camera.updateMatrixWorld(true);
  renderer.render(scene, camera); renderer.render(scene, camera);
  const gl = renderer.getContext(), pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
  gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', pixels))].map(value => value.toString(16).padStart(2, '0')).join('');
  return { digest, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, programs: renderer.info.programs.length,
    width: gl.drawingBufferWidth, height: gl.drawingBufferHeight, error: gl.getError() };
};
