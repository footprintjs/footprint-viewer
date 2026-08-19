/**
 * Capability accounting for slot replacements. In dev builds the capability
 * props handed to a replacement pane are ACCESS-TRACKED (a proxy flips a flag
 * on first read), so "never used" is a measured fact, not a guess. A pane
 * that never reads a capability the shipped pane offers gets ONE named
 * console line — silenced only by declaring the drop in writing:
 *
 *   slots: { detail: { component: MyPane, drops: ['tracing'] } }
 *
 * Production builds carry no tracking and no warning.
 */

import type * as React from 'react';

import type { PaneCapability, PaneSlot, ViewerPaneProps } from '../config/types.js';

/** One shape for both spellings of a slot. */
export function normalizePaneSlot(slot: PaneSlot): {
  readonly component: React.ComponentType<ViewerPaneProps>;
  readonly drops: readonly PaneCapability[];
} {
  if (typeof slot === 'function') return { component: slot, drops: [] };
  return { component: slot.component, drops: slot.drops ?? [] };
}

/** The capability entries `ViewerPaneProps` carries today, and what each one
 *  makes unreachable when a replacement ignores it. */
export const TRACKED_CAPABILITIES: ReadonlyArray<{
  readonly capability: PaneCapability;
  readonly prop: 'tracing';
  readonly loss: string;
}> = [
  { capability: 'tracing', prop: 'tracing', loss: 'value-click tracing is now unreachable from this pane' },
];

/** Wrap one capability value so its first read flips the flag. The wrapper is
 *  transparent — copying the props object copies the proxy reference without
 *  touching its insides, so only the PANE's own reads count. */
export function trackAccess<T extends object>(value: T, onAccess: () => void): T {
  return new Proxy(value, {
    get(target, prop, receiver) {
      onAccess();
      return Reflect.get(target, prop, receiver);
    },
    has(target, prop) {
      onAccess();
      return Reflect.has(target, prop);
    },
  });
}

/** The audit sentence, verbatim (the design page's, with the replacement's
 *  own name in the suggestion). */
export function capabilityAuditLine(args: {
  readonly slotName: string;
  readonly shippedPaneName: string;
  readonly capability: PaneCapability;
  readonly loss: string;
  readonly componentName: string;
}): string {
  return (
    `footprint-viewer: the ${args.slotName} slot replaced the ${args.shippedPaneName}, ` +
    `and the replacement never used \`${args.capability}\` — ${args.loss}. ` +
    `The shipped pane offers it; if dropping it is intended, say so: ` +
    `slots: { ${args.slotName}: { component: ${args.componentName}, drops: ['${args.capability}'] } }.`
  );
}

/** A component's best human name, for the audit's suggestion. */
export function componentNameOf(component: React.ComponentType<ViewerPaneProps>): string {
  const named = component as { displayName?: string; name?: string };
  return named.displayName || named.name || 'MyPane';
}
