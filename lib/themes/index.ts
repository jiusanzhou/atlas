import type { ThemeName } from "../schema";
import type { ThemeTokens } from "./types";
import { hearthstone } from "./hearthstone";
import { business } from "./business";
import { blueprint } from "./blueprint";

export const themes: Record<ThemeName, ThemeTokens> = {
  hearthstone,
  business,
  blueprint,
};

export function getTheme(name: ThemeName | string | undefined): ThemeTokens {
  if (name && name in themes) return themes[name as ThemeName];
  return hearthstone;
}

export type { ThemeTokens, RarityStyle, CardMetrics } from "./types";
export { hearthstone, business, blueprint };
