import type { SimHost } from "@wildshard/engine/sim";
import { pickPrompt, setPromptSight, type PromptTarget } from "@wildshard/engine/world/interact/prompts";
import * as v from "valibot";

const headlessPromptsFinite = v.pipe(v.number(), v.finite());
const headlessPromptsPoint = v.strictObject({ x: headlessPromptsFinite, y: headlessPromptsFinite, z: headlessPromptsFinite });
const nonnegative = v.pipe(headlessPromptsFinite, v.minValue(0));
const registration = v.strictObject({ id: v.nullable(v.pipe(v.string(), v.minLength(1), v.maxLength(128))), position: headlessPromptsPoint,
  radius: nonnegative, weak: v.exactOptional(v.boolean()), sight: v.strictObject({ slack: nonnegative, body: v.exactOptional(v.pipe(v.string(), v.minLength(1), v.maxLength(256))) }) });
/** Ordered native page captures; owner strings come from actual registered sight identities. */
export type PromptRegistration = v.InferOutput<typeof registration>;
/** Refuse unbounded rosters or malformed capture metadata before binding live host prompts. */
export function parsePromptRegistrations(input: unknown): PromptRegistration[] { return v.parse(v.pipe(v.array(registration), v.maxLength(1024)), input); }

/** A live prompt in actual page registration order; null acts still compete but have no hosted command. */
export interface HeadlessPrompt extends PromptTarget { readonly act: number | null }
/** A host borrows the authoritative eye and world; selection never performs the prompt's action. */
export interface HeadlessPromptPicker { pick: <T extends HeadlessPrompt>(candidates: readonly T[]) => T | undefined }

/** Bind the captured registration order to live native positions/reach; unhosted prompts still compete. */
export function bindHeadlessPrompts(registrations: readonly PromptRegistration[], resolve: (id: string) => HeadlessPrompt | undefined): HeadlessPrompt[] {
  return registrations.map(row => {
    const live = row.id === null ? undefined : resolve(row.id);
    if (row.id !== null && live === undefined) throw new Error(`Native prompt ${row.id} has no live host binding`);
    return { act: live?.act ?? null, get position() { return live?.position ?? row.position; }, get radius() { return live?.radius ?? row.radius; },
      ...(row.weak === undefined ? {} : { weak: row.weak }), sight: row.sight };
  });
}

/** Use the client prompt law against native host collision, from the player's eye 1.68 m above their feet. */
export function createHeadlessPromptPicker(host: Pick<SimHost, 'player' | 'physics'>): HeadlessPromptPicker {
  const eye = { x: 0, y: 0, z: 0 };
  return { pick: candidates => {
    eye.x = host.player.position.x; eye.y = host.player.position.y + 1.68; eye.z = host.player.position.z;
    for (const candidate of candidates) if (candidate.sight !== undefined) setPromptSight(candidate, candidate.sight);
    return pickPrompt(candidates, eye, host.physics);
  } };
}
