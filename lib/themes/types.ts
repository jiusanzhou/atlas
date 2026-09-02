import type { Priority, Rarity, ThemeName } from "../schema";

export interface CardMetrics {
  width: number;
  height: number;
  avatarSize: number;
  borderRadius: number;
}

export interface RarityStyle {
  border: string;
  glow: string;
  label: string;
}

export interface ThemeTokens {
  name: ThemeName;
  label: string;
  card: CardMetrics;
  /** CSS gradient for the card face. */
  cardBackground: string;
  /** Flat colour used by drawio, which cannot express gradients per-cell. */
  cardBackgroundFlat: string;
  accent: string;
  accentSoft: string;
  textPrimary: string;
  textSecondary: string;
  domainBackground: string;
  domainBorder: string;
  domainBanner: string;
  canvasBackground: string;
  tagBackground: string;
  tagText: string;
  gapBorder: string;
  gapBackground: string;
  gapText: string;
  loanBadgeBackground: string;
  loanBadgeText: string;
  loanArrow: string;
  rarity: Record<Rarity, RarityStyle>;
  priority: Record<Priority, string>;
  /** Font stack shared by web render and drawio export. */
  headingFont: string;
  bodyFont: string;
}
