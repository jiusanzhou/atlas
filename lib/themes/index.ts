import { normalizeThemeName, type ThemeName } from "../schema";
import type { ThemeTokens } from "./types";
import { hearthstone } from "./hearthstone";
import { minimal } from "./minimal";

/**
 * Only fully implemented themes are registered. `business` / `blueprint` still
 * live in this folder as unfinished palettes but are deliberately not wired up:
 * they inherited hearthstone's geometry, so switching to them looked identical
 * to hearthstone and read as a bug. See lib/themes/business.ts.
 */
export const themes: Record<ThemeName, ThemeTokens> = {
  hearthstone,
  minimal,
};

export function getTheme(name: ThemeName | string | undefined): ThemeTokens {
  const resolved = normalizeThemeName(name);
  return resolved ? themes[resolved] : hearthstone;
}

export type {
  ThemeTokens,
  RarityStyle,
  CardMetrics,
  ThemeVariant,
  ThemeGeometry,
} from "./types";
export { hearthstone, minimal };
