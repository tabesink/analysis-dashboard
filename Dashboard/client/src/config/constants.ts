/**
 * UI/UX Constants
 * Re-exports plot constants from settings.yaml via settings.ts
 */

export * from './settings';

// Default fallback color used by chart renderers (`ColorConfig.defaultColor`)
// when a curve cannot be resolved to a program/version palette color.
// Static UI default, not user-tunable, so it lives here rather than in
// the auto-generated settings.ts.
export const DEFAULT_HISTORICAL_COLOR = '#3b82f6';
