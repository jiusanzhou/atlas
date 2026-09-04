import type { ThemeTokens } from "./types";

const GOLD = "#eab308";
const INK = "#404040";

/**
 * Avatar + name only; everything else moves into the hover panel. Light and
 * neutral on purpose, so it reads as the opposite of the Hearthstone mood.
 */
export const minimal: ThemeTokens = {
  name: "minimal",
  label: "Minimal",
  variant: "minimal",
  card: {
    width: 100,
    height: 130,
    avatarSize: 64,
    borderRadius: 8,
  },
  // Cards are 2.4x smaller, so the whole tree tightens up with them.
  geometry: {
    cardGap: 10,
    columns: 4,
    padding: 12,
    headerHeight: 30,
    minNodeWidth: 160,
    nodeGapX: 32,
    levelGapY: 60,
  },
  // Transparent: the minimal card leans on avatar + name, not a frame.
  cardBackground: "transparent",
  cardBackgroundFlat: "#ffffff",
  cardHoverBackground: "rgba(115, 115, 115, 0.12)",
  accent: "#525252",
  accentSoft: "rgba(115, 115, 115, 0.22)",
  textPrimary: INK,
  textSecondary: "#737373",
  domainBackground: "transparent",
  domainBorder: "rgba(115, 115, 115, 0.28)",
  domainBanner: "transparent",
  canvasBackground: "#fafafa",
  gridColor: "rgba(23, 23, 23, 0.07)",
  tagBackground: "#f5f5f5",
  tagText: "#525252",
  gapBorder: "#d4d4d4",
  gapBackground: "#f5f5f5",
  gapBackgroundFlat: "#f5f5f5",
  gapSilhouetteBackground: "#f5f5f5",
  gapText: "#a3a3a3",
  loanBadgeBackground: "#e5e5e5",
  loanBadgeText: "#404040",
  loanArrow: "rgba(163, 163, 163, 0.85)",
  loanOutBackground: "#ea9a5b",
  loanInBackground: "#7ba6dd",
  // Both loan ends often sit in the same tree here, and the pale dashed arrow
  // is quiet enough not to fight the layout.
  showLoanArrows: true,
  leadMarker: GOLD,
  commentMarker: "#facc15",
  panelBackground: "#ffffff",
  panelBorder: "#e5e5e5",
  panelShadow: "0 12px 32px rgba(23, 23, 23, 0.14)",
  treeLink: "rgba(163, 163, 163, 0.55)",
  // No frames in this theme, so rarity only survives as the panel's small
  // caption. Borders are kept neutral rather than colour-coded.
  rarity: {
    common: { border: "#e5e5e5", glow: "rgba(163, 163, 163, 0.18)", label: "普通" },
    rare: { border: "#d4d4d4", glow: "rgba(163, 163, 163, 0.2)", label: "稀有" },
    epic: { border: "#c4b5fd", glow: "rgba(167, 139, 250, 0.22)", label: "史诗" },
    legendary: { border: "#fcd34d", glow: "rgba(234, 179, 8, 0.28)", label: "传说" },
  },
  // Slightly deeper than hearthstone's so the dots hold up on a white canvas.
  priority: {
    low: "#9ca3af",
    medium: "#d97706",
    high: "#ea580c",
    critical: "#dc2626",
  },
  headingFont: "'Helvetica Neue', 'PingFang SC', system-ui, sans-serif",
  bodyFont: "'Helvetica Neue', 'PingFang SC', system-ui, sans-serif",
};

export default minimal;
