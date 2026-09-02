import type { ThemeTokens } from "./types";

export const GOLD = "#d4af37";

export const hearthstone: ThemeTokens = {
  name: "hearthstone",
  label: "Hearthstone",
  card: {
    width: 240,
    height: 340,
    avatarSize: 120,
    borderRadius: 16,
  },
  cardBackground: "linear-gradient(160deg, #1a1410 0%, #2d1f14 55%, #1d1509 100%)",
  cardBackgroundFlat: "#241a10",
  accent: GOLD,
  accentSoft: "rgba(212, 175, 55, 0.35)",
  textPrimary: "#f5e6c8",
  textSecondary: "#c9a227",
  domainBackground: "rgba(28, 20, 12, 0.72)",
  domainBorder: "rgba(212, 175, 55, 0.45)",
  domainBanner: "linear-gradient(90deg, #3a2a15 0%, #6b4d1d 50%, #3a2a15 100%)",
  canvasBackground: "radial-gradient(circle at 50% 0%, #241a10 0%, #120d08 70%)",
  tagBackground: "rgba(0, 0, 0, 0.55)",
  tagText: GOLD,
  gapBorder: "#6b7280",
  gapBackground: "rgba(31, 31, 31, 0.6)",
  gapText: "#9ca3af",
  loanBadgeBackground: "#a41e22",
  loanBadgeText: "#fff7ed",
  loanArrow: "#c2410c",
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
  priority: {
    low: "#65a30d",
    medium: "#d97706",
    high: "#ea580c",
    critical: "#dc2626",
  },
  headingFont: "Georgia, 'Songti SC', 'Times New Roman', serif",
  bodyFont: "'Helvetica Neue', 'PingFang SC', system-ui, sans-serif",
};

export default hearthstone;
