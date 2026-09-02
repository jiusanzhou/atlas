"use client";

import { motion } from "framer-motion";
import { UserPlus } from "lucide-react";
import type { GapSlot } from "@/lib/layout";
import type { ThemeTokens } from "@/lib/themes/types";

const PRIORITY_LABEL: Record<string, string> = {
  low: "低",
  medium: "中",
  high: "高",
  critical: "紧急",
};

interface GapCardProps {
  slot: GapSlot;
  theme: ThemeTokens;
  still?: boolean;
}

export function GapCard({ slot, theme, still = false }: GapCardProps) {
  const { gap } = slot;
  const color = theme.priority[gap.priority];

  return (
    <motion.div
      data-slot-id={slot.id}
      className="relative flex select-none flex-col items-center justify-center px-3 text-center"
      style={{
        width: slot.width,
        height: slot.height,
        borderRadius: theme.card.borderRadius,
        background: theme.gapBackground,
        border: `2px dashed ${theme.gapBorder}`,
        fontFamily: theme.bodyFont,
      }}
      initial={still ? false : { opacity: 0, y: 12 }}
      animate={still ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      whileHover={
        still ? undefined : { y: -6, borderColor: color, boxShadow: `0 0 20px ${color}55` }
      }
    >
      <span
        className="absolute right-3 top-3 h-3.5 w-3.5 rounded-full"
        style={{ background: color, boxShadow: `0 0 10px ${color}` }}
        title={`优先级：${PRIORITY_LABEL[gap.priority]}`}
      />

      <UserPlus size={30} strokeWidth={1.5} style={{ color: theme.gapText }} />

      <div
        className="mt-3 text-sm font-bold tracking-widest"
        style={{ color: theme.gapText, fontFamily: theme.headingFont }}
      >
        招募中
      </div>

      <div className="mt-2 text-base font-bold" style={{ color: theme.textPrimary }}>
        {gap.role}
      </div>
      <div className="mt-0.5 text-xl font-black" style={{ color }}>
        ×{gap.count}
      </div>

      {gap.note && (
        <div className="mt-2 text-[10px] leading-snug" style={{ color: theme.gapText }}>
          {gap.note}
        </div>
      )}

      <div
        className="absolute bottom-3 rounded px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
        style={{ color, border: `1px solid ${color}` }}
      >
        {PRIORITY_LABEL[gap.priority]}
      </div>
    </motion.div>
  );
}

export default GapCard;
