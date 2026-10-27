import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { readNativeTerrain } from '@wildshard/sdk/bake/terrain';
import type { DecisionScriptRow } from '@wildshard/sdk/decisionScripts';
import { parseClientChannels } from '@wildshard/sdk/rows';
import { weatherDecision, STORM } from './weatherDecisionSource';
import { weatherPresentation } from './weatherPresentation';
import { skyRows, skyChannels } from './skyPresentation';
import { weatherFxChannels } from './weatherFxChannels';
import { nalatiDayChannels } from './dayChannels';
import { NALATI_FAR_HERD_CHANNELS } from './clientMotion';
import { NALATI_WEATHER_PROGRAMS, NALATI_TINT_PROGRAMS } from './weatherChannels';

/** Preserve the old canonical JSON handoff's order, absent fields and signed zero. */
function publicationRows<T>(source: T): T {
  const copy = structuredClone(source);
  const visit = (value: unknown): void => {
    if (typeof value !== 'object' || value === null) return;
    const entries = Object.keys(value).sort().map(key => [key, Reflect.get(value, key)] as const);
    for (const [key] of entries) Reflect.deleteProperty(value, key);
    for (const [key, child] of entries) {
      if (child === undefined) { if (Array.isArray(value)) Reflect.set(value, key, null); }
      else if (typeof child === 'number' && Object.is(child, -0)) Reflect.set(value, key, 0);
      else { visit(child); Reflect.set(value, key, child); }
    }
  };
  visit(copy);
  return copy;
}

/** Both original channel banks share the same deterministic terrain presentation. */
export function nalatiWeatherChannels(lattice: Uint8Array): {
  weather: { presentation: ReturnType<typeof weatherPresentation>; sky: ReturnType<typeof skyRows>; clientChannels: ReturnType<typeof parseClientChannels> };
  herd: { presentation: ReturnType<typeof weatherPresentation>; sky: ReturnType<typeof skyRows>; clientChannels: ReturnType<typeof parseClientChannels> };
} {
  const ground = readNativeTerrain(lattice), presentation = weatherPresentation(0x4a1a, ground.heightAt);
  return publicationRows({
    weather: { presentation, sky: skyRows(), clientChannels: parseClientChannels([...NALATI_WEATHER_PROGRAMS, ...NALATI_TINT_PROGRAMS, ...nalatiDayChannels(), ...weatherFxChannels(), ...skyChannels()]) },
    herd: { presentation, sky: skyRows(), clientChannels: parseClientChannels(NALATI_FAR_HERD_CHANNELS) },
  });
}

/** Construct weather rows and executable from injected tracked inputs, without scheduler outputs. */
export async function nalatiWeatherProgram(ctx: ProjectGenerationContext): Promise<NalatiWeather> {
  const lattice = '/assets/baked/nalati-grasslands/terrain.bin';
  const files = await ctx.cached({ id: 'weather-lattice', inputs: [lattice] }, inputs => {
    const bytes = inputs.get(lattice);
    if (bytes === undefined || bytes.length === 0) throw new Error('Missing weather native lattice');
    return new Map([['lattice.bin', bytes]]);
  });
  const bytes = files.get('lattice.bin');
  if (files.size !== 1 || bytes === undefined || bytes.length === 0) throw new Error('Weather lattice inventory differs');
  const { binary, ...program } = await weatherDecision(ctx);
  return { channels: nalatiWeatherChannels(bytes), rows: publicationRows({ ...program, ...STORM, compiled: { source: 'behaviour/weather.generated.wasm', bytes: binary.byteLength } }), binary };
}

/** The explicit metadata supplied to header and output composition. */
export interface NalatiWeather {
  readonly channels: {
    weather: { presentation: object; sky: object; clientChannels: ReturnType<typeof parseClientChannels> };
    herd: { presentation: object; sky: object; clientChannels: ReturnType<typeof parseClientChannels> };
  };
  readonly rows: { script: DecisionScriptRow; bytes: string; compiled: { source: string; bytes: number } };
  readonly binary: Uint8Array;
}
