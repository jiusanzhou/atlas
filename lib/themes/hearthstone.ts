import type { ThemeTokens } from "./types";

export const GOLD = "#d4af37";

export const hearthstone: ThemeTokens = {
  name: "hearthstone",
  label: "Hearthstone",
  variant: "card",
  card: {
    width: 240,
    height: 340,
    avatarSize: 120,
    borderRadius: 16,
  },
  geometry: {},
  cardBackground: "linear-gradient(160deg, #1a1410 0%, #2d1f14 55%, #1d1509 100%)",
  cardBackgroundFlat: "#241a10",
  cardHoverBackground: "rgba(212, 175, 55, 0.12)",
  accent: GOLD,
  accentSoft: "rgba(212, 175, 55, 0.35)",
  textPrimary: "#f5e6c8",
  textSecondary: "#c9a227",
  domainBackground: "rgba(28, 20, 12, 0.72)",
  domainBorder: "rgba(212, 175, 55, 0.45)",
  domainBanner: "linear-gradient(90deg, #3a2a15 0%, #6b4d1d 50%, #3a2a15 100%)",
  canvasBackground: "radial-gradient(circle at 50% 0%, #241a10 0%, #120d08 70%)",
  gridColor: "rgba(255, 255, 255, 0.10)",
  tagBackground: "rgba(0, 0, 0, 0.55)",
  tagText: GOLD,
  // Desaturated cousin of cardBackground so a vacancy reads as a dimmed card.
  gapBorder: "rgba(115, 115, 115, 0.6)",
  gapBackground: "linear-gradient(160deg, #0f0a06 0%, #1a1410 60%, #100b07 100%)",
  gapBackgroundFlat: "#141010",
  gapSilhouetteBackground: "rgba(0, 0, 0, 0.35)",
  gapText: "#9ca3af",
  loanBadgeBackground: "#a41e22",
  loanBadgeText: "#fff7ed",
  loanArrow: "#c2410c",
  loanOutBackground: "#c2410c",
  loanInBackground: "#1d4ed8",
  showLoanArrows: false,
  leadMarker: GOLD,
  commentMarker: GOLD,
  panelBackground: "#1a1410",
  panelBorder: "rgba(212, 175, 55, 0.45)",
  panelShadow: "0 18px 48px rgba(0, 0, 0, 0.6)",
  treeLink: "rgba(212, 175, 55, 0.5)",
  rarity: {
    common: {
      border: "#a97142",
      glow: "rgba(169, 113, 66, 0.45)",
      label: "普通",
    },
    rare: {
      border: "#c0c4cc",
      glow: "rgba(192, 196, 204, 0.5)",
      label: "稀有",
    },
    epic: {
      border: "#a855f7",
      glow: "rgba(168, 85, 247, 0.55)",
      label: "史诗",
    },
    legendary: {
      border: GOLD,
      glow: "rgba(212, 175, 55, 0.7)",
      label: "传说",
    },
  },
  // Red / orange / yellow / grey, bright enough to read against the dark frame.
  priority: {
    low: "#9ca3af",
    medium: "#eab308",
    high: "#f97316",
    critical: "#ef4444",
  },
  headingFont: "Georgia, 'Songti SC', 'Times New Roman', serif",
  bodyFont: "'Helvetica Neue', 'PingFang SC', system-ui, sans-serif",
};

export default hearthstone;
