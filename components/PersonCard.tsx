"use client";

import { motion } from "framer-motion";
import { Crown } from "lucide-react";
import { resolveAvatarSync } from "@/lib/avatar";
import type { PersonSlot } from "@/lib/layout";
import type { ThemeTokens } from "@/lib/themes/types";
import { LoanBadge } from "./LoanBadge";

interface PersonCardProps {
  slot: PersonSlot;
  theme: ThemeTokens;
  /** Disables hover/entry animation for the puppeteer render page. */
  still?: boolean;
}

export function PersonCard({ slot, theme, still = false }: PersonCardProps) {
  const { person, kind, rarity } = slot;
  const rarityStyle = theme.rarity[rarity];
  const isLead = kind === "lead";
  const avatar = resolveAvatarSync(person, { size: theme.card.avatarSize });
  const tags = (person.tags ?? []).slice(0, 3);

  return (
    <motion.div
      data-slot-id={slot.id}
      className="group relative select-none overflow-hidden"
      style={{
        width: slot.width,
        height: slot.height,
        borderRadius: theme.card.borderRadius,
        background: theme.cardBackground,
        border: `${isLead ? 3 : 2}px solid ${rarityStyle.border}`,
        boxShadow: isLead
          ? `0 0 24px ${rarityStyle.glow}, inset 0 0 30px rgba(0,0,0,0.5)`
          : `0 6px 18px rgba(0,0,0,0.45)`,
        fontFamily: theme.bodyFont,
      }}
      initial={still ? false : { opacity: 0, y: 12 }}
      animate={still ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      whileHover={
        still
          ? undefined
          : {
              y: -8,
              scale: 1.03,
              boxShadow: `0 0 34px ${rarityStyle.glow}, 0 14px 28px rgba(0,0,0,0.55)`,
            }
      }
    >
      {/* Gold sheen sweep on hover. */}
      {!still && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -translate-x-full opacity-0 transition-all duration-700 ease-out group-hover:translate-x-full group-hover:opacity-100"
          style={{
            background: `linear-gradient(105deg, transparent 30%, ${theme.accentSoft} 48%, rgba(255,255,255,0.35) 52%, transparent 70%)`,
          }}
        />
      )}

      {rarity === "legendary" && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(circle at 50% 18%, ${theme.accentSoft} 0%, transparent 55%)`,
          }}
        />
      )}

      {isLead && (
        <div
          className="absolute left-1/2 top-0 z-20 flex -translate-x-1/2 items-center gap-1 rounded-b-md px-2 py-0.5 text-[10px] font-bold"
          style={{ background: theme.accent, color: "#1a1410" }}
        >
          <Crown size={11} strokeWidth={2.5} />
          负责人
        </div>
      )}

      <LoanBadge badges={slot.badges} theme={theme} />

      <div className="relative z-10 flex h-full flex-col items-center px-3 pb-3 pt-5">
        <div
          className="relative shrink-0 overflow-hidden rounded-full"
          style={{
            width: theme.card.avatarSize,
            height: theme.card.avatarSize,
            border: `3px solid ${theme.accent}`,
            boxShadow: `0 0 14px ${theme.accentSoft}`,
          }}
        >
          {/* Avatar hosts are arbitrary (github/gravatar/dicebear), so next/image
              would require an open remotePatterns allowlist. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={avatar}
            alt={person.name}
            width={theme.card.avatarSize}
            height={theme.card.avatarSize}
            className="h-full w-full object-cover"
            loading="eager"
          />
        </div>

        <div className="mt-3 text-center leading-tight">
          <div
            className="font-bold"
            style={{
              color: theme.textPrimary,
              fontFamily: theme.headingFont,
              fontSize: person.name.length > 16 ? 15 : 18,
            }}
          >
            {person.name}
          </div>
          {person.title && (
            <div className="mt-1 text-[11px] italic" style={{ color: theme.textSecondary }}>
              {person.title}
            </div>
          )}
        </div>

        <div className="mt-auto w-full">
          <div
            className="mb-1.5 text-center text-[9px] uppercase tracking-widest"
            style={{ color: rarityStyle.border }}
          >
            {rarityStyle.label}
          </div>
          {tags.length > 0 && (
            <div className="flex w-full items-stretch gap-1">
              {tags.map((tag) => (
                <div
                  key={tag}
                  className="flex-1 truncate rounded px-1 py-1 text-center text-[9px] font-semibold"
                  style={{
                    background: theme.tagBackground,
                    color: theme.tagText,
                    border: `1px solid ${theme.accentSoft}`,
                  }}
                  title={tag}
                >
                  {tag}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default PersonCard;
