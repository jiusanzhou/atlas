import type { ThemeName } from "../schema";
import type { ThemeTokens } from "./types";
import { hearthstone } from "./hearthstone";
import { minimal } from "./minimal";
import { business } from "./business";
import { blueprint } from "./blueprint";

export const themes: Record<ThemeName, ThemeTokens> = {
  hearthstone,
  minimal,
  business,
  blueprint,
};

export function getTheme(name: ThemeName | string | undefined): ThemeTokens {
  if (name && name in themes) return themes[name as ThemeName];
  return hearthstone;
}

export type {
  ThemeTokens,
  RarityStyle,
  CardMetrics,
  ThemeVariant,
  ThemeGeometry,
} from "./types";
export { hearthstone, minimal, business, blueprint };
