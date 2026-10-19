import type { PostChainRow } from '@wildshard/format/scaledPost';
import { GRADE_GLSL } from './gradeProgram';

/** Author the painted grade and the desktop bloom; the client only binds uniforms. */
export function postChainRows(): { readonly chain: PostChainRow & { readonly bloom: NonNullable<PostChainRow['bloom']> }; readonly shadow: readonly number[]; readonly light: readonly number[]; readonly lum: readonly number[]; readonly uniforms: { readonly uV2Exposure: number; readonly uV2Sat: number; readonly uV2LookSat: number } } {
  const shadow = [0.92, 0.96, 1.05], light = [1.07, 0.99, 0.84], lum = [0.2126, 0.7152, 0.0722];
  const grade = GRADE_GLSL.V2_GRADE_GLSL.replaceAll('@{SHADOW_TONE}', shadow.join(', ')).replaceAll('@{LIGHT_TONE}', light.join(', '));
  const chain = { scene: true, effect: { name: 'GradeV2Effect', source: GRADE_GLSL.effect.replaceAll('@{V2_GRADE_GLSL}', grade) },
    bloom: { tiers: ['desktop'], intensity: 0.28, threshold: 0.95, smoothing: 0.3, radius: 0.7 } } satisfies PostChainRow;
  return { chain, shadow, light, lum, uniforms: { uV2Exposure: 1, uV2Sat: 1.05, uV2LookSat: 1 } };
}
