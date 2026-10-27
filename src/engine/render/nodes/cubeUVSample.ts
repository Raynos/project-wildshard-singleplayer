/**
 * three's cube-UV environment lookup (r186 `textureCubeUV`) with its arithmetic in shared layout functions (S1, D150).
 * three's `textureCubeUV` and `bilinearCubeUV` have no layout, so every environment read of every node build re-made
 * the roughness-to-mip ladder and both atlas coordinate walks inline: ~1,100 nodes a lit build, nearly half of a
 * Driftwood boot's node setup. `wsCubeUVMip` and `wsCubeUVCoord` are three's expressions in their order (its `getFace`,
 * `getUV` and `roughnessToMip` inside), and three generates a layout function's code once per renderer, so a build pays
 * a few calls a read. The atlas samples stay inline: a layout function takes no sampler.
 */
import { ConvertNode, type Node, type TextureNode } from 'three/webgpu';
import { Fn, If, abs, clamp, exp2, float, floor, fract, log2, max, mix, mul, select, vec2, vec3 } from 'three/tsl';

type CubeUVInputs = Readonly<Record<string, Node>>;
function cubeUVInput(inputs: CubeUVInputs, name: string): Node<'float'> {
  const value = inputs[name];
  if (value === undefined) throw new Error(`cubeUVSample: the cube-UV lookup lacks ${name}`);
  return new ConvertNode<'float'>(value, 'float');
}
function cubeUVDirection(inputs: CubeUVInputs): Node<'vec3'> {
  const value = inputs['direction'];
  if (value === undefined) throw new Error('cubeUVSample: the cube-UV lookup lacks its direction');
  return new ConvertNode<'vec3'>(value, 'vec3');
}

// three's cube-UV constants (r186 PMREMUtils)
const R0 = 1.0, M0 = -2, R1 = 0.8, M1 = -1, R4 = 0.4, M4 = 2.0, R5 = 0.305, M5 = 3.0, R6 = 0.21, M6 = 4.0;
const MIN_MIP_LEVEL = 4.0, MIN_TILE_SIZE = 16.0;

/** three's `roughnessToMip` */
const cubeUVMip = Fn<CubeUVInputs, Node>((inputs: CubeUVInputs): Node => {
  const roughness = cubeUVInput(inputs, 'roughness');
  const mip = float(0.0).toVar();
  If(roughness.greaterThanEqual(R1), () => {
    mip.assign(float(R0).sub(roughness).mul(float(M1).sub(M0)).div(float(R0).sub(R1)).add(M0));
  }).ElseIf(roughness.greaterThanEqual(R4), () => {
    mip.assign(float(R1).sub(roughness).mul(float(M4).sub(M1)).div(float(R1).sub(R4)).add(M1));
  }).ElseIf(roughness.greaterThanEqual(R5), () => {
    mip.assign(float(R4).sub(roughness).mul(float(M5).sub(M4)).div(float(R4).sub(R5)).add(M4));
  }).ElseIf(roughness.greaterThanEqual(R6), () => {
    mip.assign(float(R5).sub(roughness).mul(float(M6).sub(M5)).div(float(R5).sub(R6)).add(M5));
  }).Else(() => {
    mip.assign(float(-2).mul(log2(mul(1.16, roughness)))); // 1.16 = 1.79^0.25
  });
  return mip;
}).setLayout({ name: 'wsCubeUVMip', type: 'float', inputs: [{ name: 'roughness', type: 'float' }] });

/** three's `bilinearCubeUV` up to its sample: the atlas coordinate of `direction` at mip `mipInt` (its `getFace` and
 *  `getUV` inline) */
const cubeUVCoord = Fn<CubeUVInputs, Node>((inputs: CubeUVInputs): Node => {
  const direction = cubeUVDirection(inputs);
  const mipInt = float(cubeUVInput(inputs, 'mipInt')).toVar();
  // getFace
  const absDirection = vec3(abs(direction)).toVar();
  const face = float(-1).toVar();
  If(absDirection.x.greaterThan(absDirection.z), () => {
    If(absDirection.x.greaterThan(absDirection.y), () => {
      face.assign(select(direction.x.greaterThan(0.0), 0.0, 3.0));
    }).Else(() => {
      face.assign(select(direction.y.greaterThan(0.0), 1.0, 4.0));
    });
  }).Else(() => {
    If(absDirection.z.greaterThan(absDirection.y), () => {
      face.assign(select(direction.z.greaterThan(0.0), 2.0, 5.0));
    }).Else(() => {
      face.assign(select(direction.y.greaterThan(0.0), 1.0, 4.0));
    });
  });
  const filterInt = float(max(float(MIN_MIP_LEVEL).sub(mipInt), 0.0)).toVar();
  mipInt.assign(max(mipInt, MIN_MIP_LEVEL));
  const faceSize = float(exp2(mipInt)).toVar();
  // getUV (RH coordinate system; PMREM face-indexing convention)
  const plane = vec2().toVar();
  If(face.equal(0.0), () => {
    plane.assign(vec2(direction.z, direction.y).div(abs(direction.x))); // pos x
  }).ElseIf(face.equal(1.0), () => {
    plane.assign(vec2(direction.x.negate(), direction.z.negate()).div(abs(direction.y))); // pos y
  }).ElseIf(face.equal(2.0), () => {
    plane.assign(vec2(direction.x.negate(), direction.y).div(abs(direction.z))); // pos z
  }).ElseIf(face.equal(3.0), () => {
    plane.assign(vec2(direction.z.negate(), direction.y).div(abs(direction.x))); // neg x
  }).ElseIf(face.equal(4.0), () => {
    plane.assign(vec2(direction.x.negate(), direction.z).div(abs(direction.y))); // neg y
  }).Else(() => {
    plane.assign(vec2(direction.x, direction.y).div(abs(direction.z))); // neg z
  });
  const uv = vec2(mul(0.5, plane.add(1.0)).mul(faceSize.sub(2.0)).add(1.0)).toVar();
  If(face.greaterThan(2.0), () => {
    uv.y.addAssign(faceSize);
    face.subAssign(3.0);
  });
  uv.x.addAssign(face.mul(faceSize));
  uv.x.addAssign(filterInt.mul(mul(3.0, MIN_TILE_SIZE)));
  uv.y.addAssign(mul(4.0, exp2(cubeUVInput(inputs, 'maxMip')).sub(faceSize)));
  uv.x.mulAssign(cubeUVInput(inputs, 'texelWidth'));
  uv.y.mulAssign(cubeUVInput(inputs, 'texelHeight'));
  return uv;
}).setLayout({ name: 'wsCubeUVCoord', type: 'vec2', inputs: [
  { name: 'direction', type: 'vec3' }, { name: 'mipInt', type: 'float' }, { name: 'texelWidth', type: 'float' }, { name: 'texelHeight', type: 'float' },
  { name: 'maxMip', type: 'float' },
] });

/** the read's own expressions (three's `textureCubeUV` body): the mip from roughness, two atlas samples blended across it */
const cubeUVRead = Fn<CubeUVInputs & { readonly atlas: TextureNode }, Node>((inputs): Node => {
  const { atlas } = inputs, maxMip = cubeUVInput(inputs, 'maxMip');
  const direction = cubeUVDirection(inputs), texelWidth = cubeUVInput(inputs, 'texelWidth'), texelHeight = cubeUVInput(inputs, 'texelHeight');
  const mip = clamp(new ConvertNode<'float'>(cubeUVMip({ roughness: cubeUVInput(inputs, 'roughness') }), 'float'), M0, maxMip);
  const mipF = fract(mip);
  const mipInt = floor(mip);
  // disable anisotropic filtering, as bilinearCubeUV does
  const sample = (level: Node): Node<'vec3'> => new ConvertNode<'vec3'>(atlas.sample(cubeUVCoord({ direction, mipInt: level, texelWidth, texelHeight, maxMip })).grad(vec2(), vec2()), 'vec3');
  const color0 = sample(mipInt).toVar();
  If(mipF.notEqual(0.0), () => {
    const color1 = sample(mipInt.add(1.0)).toVar();
    color0.assign(mix(color0, color1, mipF));
  });
  return color0;
});

/** The PMREM atlas `atlas` read along `direction` at `roughness`, as three's `textureCubeUV` reads it. */
export function cubeUVSample(atlas: TextureNode, direction: Node, roughness: Node, texelWidth: Node, texelHeight: Node, maxMip: Node): Node {
  return cubeUVRead({ atlas, direction, roughness, texelWidth, texelHeight, maxMip });
}
