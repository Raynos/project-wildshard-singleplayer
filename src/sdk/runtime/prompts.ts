import { createHeadlessPromptPicker as createPicker, bindHeadlessPrompts as bindPrompts, parsePromptRegistrations as parseRegistrations,
  type HeadlessPrompt as Prompt, type HeadlessPromptPicker as Picker, type PromptRegistration as Registration } from '@wildshard/game/quest/interactionRows';

/** A live native prompt with its command act, position, reach, weak priority and exact sight association. */
export type HeadlessPrompt = Prompt;
/** Native selection shares the page's strict reach, stable ties, strong priority and line of sight. */
export type HeadlessPromptPicker = Picker;
/** Captured page registration order and native sight metadata; live bindings own later movement and reach. */
export type PromptRegistration = Registration;
/** Validate ordered native prompt captures before binding them to an authoritative host. */
export function parsePromptRegistrations(input: unknown): Registration[] { return parseRegistrations(input); }
/** Preserve actual page order while borrowing each known prompt's live position/reach. */
export function bindHeadlessPrompts(registrations: readonly Registration[], resolve: (id: string) => Prompt | undefined): Prompt[] { return bindPrompts(registrations, resolve); }
/** Borrow the authoritative host eye/world without installing a clock or performing an interaction. */
export function createHeadlessPromptPicker(host: Parameters<typeof createPicker>[0]): Picker { return createPicker(host); }
