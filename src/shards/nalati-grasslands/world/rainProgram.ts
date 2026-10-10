import { ShaderFamily } from '@wildshard/sdk/looks/shaderFamily';
import { RAIN_GLSL } from '../data/rainGlsl';

/** the GLSL below is data (data/rainGlsl.ts); `@{name}` splices the fragments this module passes */
const RAIN_GLSL_FAMILY = new ShaderFamily(RAIN_GLSL, {});

export const RAIN_PROGRAM = {
  vertexShader: RAIN_GLSL_FAMILY.glsl(RAIN_GLSL.vertexShader),
  fragmentShader: RAIN_GLSL_FAMILY.glsl(RAIN_GLSL.fragmentShader),
};
