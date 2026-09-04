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

/**
 * Which render branch the card components take. `card` is the framed
 * Hearthstone-style face; `minimal` is avatar + name with a hover panel.
 */
export type ThemeVariant = "card" | "minimal";

/**
 * Geometry a theme may override on top of DEFAULT_LAYOUT. Declared here rather
 * than reusing LayoutOptions so themes stay importable from the layout module.
 */
export interface ThemeGeometry {
  cardGap: number;
  columns: number;
  padding: number;
  headerHeight: number;
  minNodeWidth: number;
  nodeGapX: number;
  levelGapY: number;
}

/**
 * A theme that is not yet registered in `ThemeName`. Same token surface, but the
 * name is a free string so an in-progress palette can live in the repo without
 * being selectable. Promote to `ThemeTokens` by adding the name to `THEMES`.
 */
export type DraftThemeTokens = Omit<ThemeTokens, "name"> & { name: string };

export interface ThemeTokens {
  name: ThemeName;
  label: string;
  variant: ThemeVariant;
  card: CardMetrics;
  /** Layout overrides merged over DEFAULT_LAYOUT by layoutFromTheme. */
  geometry: Partial<ThemeGeometry>;
  /** CSS gradient for the card face. */
  cardBackground: string;
  /** Flat colour used by drawio, which cannot express gradients per-cell. */
  cardBackgroundFlat: string;
  /** Highlight painted behind a card on hover. Carries the minimal variant. */
  cardHoverBackground: string;
  accent: string;
  accentSoft: string;
  textPrimary: string;
  textSecondary: string;
  domainBackground: string;
  domainBorder: string;
  domainBanner: string;
  canvasBackground: string;
  /** Colour of the canvas grid dots/lines, so light themes stay visible. */
  gridColor: string;
  tagBackground: string;
  tagText: string;
  gapBorder: string;
  gapBackground: string;
  /** Opaque variant of gapBackground: needed behind the flipped card's back
   *  face, and by drawio, which cannot express gradients or alpha per cell. */
  gapBackgroundFlat: string;
  /** Fill inside the silhouette ring on a gap card. */
  gapSilhouetteBackground: string;
  gapText: string;
  loanBadgeBackground: string;
  loanBadgeText: string;
  loanArrow: string;
  /** Orange-ish: this person is lent out to another top-level domain. */
  loanOutBackground: string;
  /** Blue-ish: this person is borrowed in from another top-level domain. */
  loanInBackground: string;
  /**
   * Draw dashed loan arrows for loans whose both ends live in the current tree.
   * Cross-tree loans stay badge/annotation only regardless of this flag.
   */
  showLoanArrows: boolean;
  /** Marks the domain lead (crown). */
  leadMarker: string;
  /** Marks a person carrying a markdown comment. */
  commentMarker: string;
  /** Surface of the minimal variant's hover panel. */
  panelBackground: string;
  panelBorder: string;
  panelShadow: string;
  /** Parent-to-child connector in the domain tree. Solid, not dashed. */
  treeLink: string;
  rarity: Record<Rarity, RarityStyle>;
  priority: Record<Priority, string>;
  /** Font stack shared by web render and drawio export. */
  headingFont: string;
  bodyFont: string;
}
