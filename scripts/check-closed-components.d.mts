import type { Component, ComponentInventory } from './shard-components.mjs';

export type ClosedComponents = Record<string, Component[]>;
export type ClosingComponents = Record<string, Partial<Record<Component, number>>>;
export function closingComponents(input?: unknown): ClosingComponents;
export function closedComponents(input?: unknown): ClosedComponents;
export function compareClosedComponents(before: unknown, after: unknown, beforeClosing?: unknown, afterClosing?: unknown): string[];
export function closedComponentFailures(rows: Record<string, {components?: ComponentInventory}>, input: unknown, closing?: unknown): string[];
export function closedComponentSources(root: string, input: unknown, closing?: unknown): string[];
