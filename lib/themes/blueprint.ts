// TODO: v2 - full implementation
//
// Unfinished. Cyan-on-navy drafting palette over hearthstone's geometry and
// `variant: "card"`, which makes it read as "hearthstone with different colours"
// rather than a distinct theme. Withdrawn from the theme picker in v1.6.
//
// To finish it: add `geometry` overrides (a blueprint look wants tighter,
// squarer cards), then add "blueprint" back to THEMES in lib/schema.ts and
// register it in lib/themes/index.ts.
import type { DraftThemeTokens } from "./types";
import { hearthstone } from "./hearthstone";

export const blueprint: DraftThemeTokens = {
  ...hearthstone,
  name: "blueprint",
  label: "Blueprint",
  card: { width: 240, height: 300, avatarSize: 96, borderRadius: 2 },
  cardBackground: "linear-gradient(180deg, #0b2545 0%, #10345c 100%)",
  cardBackgroundFlat: "#0e2c50",
  cardHoverBackground: "rgba(103, 232, 249, 0.12)",
  accent: "#67e8f9",
  accentSoft: "rgba(103, 232, 249, 0.25)",
  textPrimary: "#e0f2fe",
  textSecondary: "#7dd3fc",
  domainBackground: "rgba(8, 30, 56, 0.8)",
  domainBorder: "rgba(103, 232, 249, 0.4)",
  domainBanner: "linear-gradient(90deg, #082f49 0%, #0e7490 100%)",
  canvasBackground: "#071a30",
  gridColor: "rgba(103, 232, 249, 0.14)",
  tagBackground: "rgba(3, 22, 41, 0.75)",
  tagText: "#67e8f9",
  gapBorder: "#64748b",
  gapBackground: "rgba(8, 30, 56, 0.6)",
  gapBackgroundFlat: "#0a2340",
  gapSilhouetteBackground: "rgba(3, 22, 41, 0.55)",
  gapText: "#94a3b8",
  loanBadgeBackground: "#0e7490",
  loanBadgeText: "#ecfeff",
  loanArrow: "#22d3ee",
  loanOutBackground: "#b45309",
  loanInBackground: "#0369a1",
  leadMarker: "#67e8f9",
  commentMarker: "#67e8f9",
  panelBackground: "#0b2545",
  panelBorder: "rgba(103, 232, 249, 0.4)",
  panelShadow: "0 18px 44px rgba(0, 0, 0, 0.55)",
  treeLink: "rgba(103, 232, 249, 0.45)",
  headingFont: "'SF Mono', 'JetBrains Mono', ui-monospace, monospace",
  bodyFont: "'SF Mono', 'JetBrains Mono', ui-monospace, monospace",
  rarity: {
    common: { border: "#475569", glow: "rgba(71, 85, 105, 0.4)", label: "普通" },
    rare: { border: "#38bdf8", glow: "rgba(56, 189, 248, 0.4)", label: "稀有" },
    epic: { border: "#818cf8", glow: "rgba(129, 140, 248, 0.45)", label: "史诗" },
    legendary: { border: "#67e8f9", glow: "rgba(103, 232, 249, 0.55)", label: "传说" },
  },
};

export default blueprint;
