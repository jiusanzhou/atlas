// TODO: v2 - full implementation
//
// Unfinished. This is a recolour of hearthstone that still inherits its
// geometry and `variant: "card"`, so on screen it is nearly indistinguishable
// from hearthstone. It was withdrawn from the theme picker in v1.6 for that
// reason and is kept only as a starting palette.
//
// To finish it: give it its own `geometry` overrides and decide whether it needs
// a distinct `variant`, then add "business" back to THEMES in lib/schema.ts and
// register it in lib/themes/index.ts (which also widens its type to ThemeTokens).
import type { DraftThemeTokens } from "./types";
import { hearthstone } from "./hearthstone";

export const business: DraftThemeTokens = {
  ...hearthstone,
  name: "business",
  label: "Business",
  card: { width: 240, height: 300, avatarSize: 96, borderRadius: 8 },
  cardBackground: "linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)",
  cardBackgroundFlat: "#f8fafc",
  cardHoverBackground: "rgba(29, 78, 216, 0.10)",
  accent: "#1d4ed8",
  accentSoft: "rgba(29, 78, 216, 0.18)",
  textPrimary: "#0f172a",
  textSecondary: "#475569",
  domainBackground: "#ffffff",
  domainBorder: "#cbd5e1",
  domainBanner: "linear-gradient(90deg, #1e3a8a 0%, #1d4ed8 100%)",
  canvasBackground: "#eef2f7",
  gridColor: "rgba(15, 23, 42, 0.10)",
  tagBackground: "#e2e8f0",
  tagText: "#1e3a8a",
  gapBorder: "#94a3b8",
  gapBackground: "#f1f5f9",
  gapBackgroundFlat: "#f1f5f9",
  gapSilhouetteBackground: "#ffffff",
  gapText: "#475569",
  loanBadgeBackground: "#1d4ed8",
  loanBadgeText: "#ffffff",
  loanArrow: "#1d4ed8",
  loanOutBackground: "#ea580c",
  loanInBackground: "#1d4ed8",
  leadMarker: "#f59e0b",
  commentMarker: "#f59e0b",
  panelBackground: "#ffffff",
  panelBorder: "#cbd5e1",
  panelShadow: "0 18px 40px rgba(15, 23, 42, 0.18)",
  treeLink: "#94a3b8",
  headingFont: "'Helvetica Neue', 'PingFang SC', system-ui, sans-serif",
  rarity: {
    common: { border: "#cbd5e1", glow: "rgba(148, 163, 184, 0.3)", label: "普通" },
    rare: { border: "#60a5fa", glow: "rgba(96, 165, 250, 0.35)", label: "稀有" },
    epic: { border: "#8b5cf6", glow: "rgba(139, 92, 246, 0.35)", label: "史诗" },
    legendary: { border: "#f59e0b", glow: "rgba(245, 158, 11, 0.4)", label: "传说" },
  },
};

export default business;
