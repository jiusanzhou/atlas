"use client";

import { useState, type KeyboardEvent } from "react";
import { motion } from "framer-motion";
import { Crown, MessageCircle } from "lucide-react";
import { resolveAvatarSync } from "@/lib/avatar";
import type { PersonSlot } from "@/lib/layout";
import type { ThemeTokens } from "@/lib/themes/types";
import { LoanBadge } from "./LoanBadge";
import { CommentMarkdown, markdownVars } from "./markdown";
import { NO_ZOOM_ATTR } from "./Canvas";

interface PersonCardProps {
  slot: PersonSlot;
  theme: ThemeTokens;
  /** Disables hover/entry animation for the puppeteer render page. */
  still?: boolean;
}

/**
 * The framed, flippable card face. Themes with `variant: "minimal"` render
 * MinimalCard + PersonHoverPanel instead; DomainTree does that dispatch.
 */
export function PersonCard({ slot, theme, still = false }: PersonCardProps) {
  const { person, kind, rarity } = slot;
  const [flipped, setFlipped] = useState(false);
  const rarityStyle = theme.rarity[rarity];
  const isLead = kind === "lead";
  const avatar = resolveAvatarSync(person, { size: theme.card.avatarSize });
  const tags = (person.tags ?? []).slice(0, 3);
  const comment = person.comment?.trim();
  const hasComment = Boolean(comment);

  const toggle = () => setFlipped((current) => !current);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    // Canvas listens for space on window to arm pan; don't let it through.
    event.stopPropagation();
    toggle();
  };

  return (
    <motion.div
      data-slot-id={slot.id}
      data-flipped={flipped ? "true" : undefined}
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
        perspective: 1000,
        cursor: hasComment ? "pointer" : "default",
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
      {...(hasComment
        ? {
            role: "button",
            tabIndex: 0,
            "aria-expanded": flipped,
            "aria-label": `${person.name} 的备注`,
            onClick: toggle,
            onKeyDown,
          }
        : {})}
    >
      {/* Gold sheen sweep on hover. */}
      {!still && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-30 -translate-x-full opacity-0 transition-all duration-700 ease-out group-hover:translate-x-full group-hover:opacity-100"
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

      {/* Only the content flips; the frame above stays put. */}
      <div
        className="absolute inset-0"
        style={{
          transformStyle: "preserve-3d",
          transition: still ? undefined : "transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
          transform: `rotateY(${flipped ? 180 : 0}deg)`,
        }}
      >
        <div className="absolute inset-0" style={{ backfaceVisibility: "hidden" }}>
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

          {hasComment && (
            <div
              className="absolute bottom-1.5 right-1.5 z-20 flex h-6 w-6 items-center justify-center rounded-full"
              style={{
                background: theme.accent,
                color: "#1a1410",
                boxShadow: `0 0 10px ${theme.accentSoft}`,
              }}
              title="有备注，点击查看"
            >
              <MessageCircle size={13} strokeWidth={2.5} />
            </div>
          )}

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
        </div>

        {comment && (
          <div
            data-card-back
            className="absolute inset-0 flex flex-col px-3 pb-2 pt-2.5"
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
              // Must be the theme's own card fill: a hardcoded dark scrim would
              // put dark text on dark in the light `business` theme.
              background: theme.cardBackground,
              boxShadow: "inset 0 0 40px rgba(0,0,0,0.28)",
            }}
          >
            <div
              className="shrink-0 truncate border-b pb-1.5 text-center text-[11px] font-bold tracking-wide"
              style={{
                color: theme.accent,
                fontFamily: theme.headingFont,
                borderColor: theme.accentSoft,
              }}
            >
              {person.name}
            </div>

            <div
              {...{ [NO_ZOOM_ATTR]: true }}
              className="markdown-body atlas-scroll mt-2 max-h-[220px] flex-1 overflow-y-auto pr-1"
              style={markdownVars(theme)}
            >
              <CommentMarkdown source={comment} />
            </div>

            <div
              className="mt-1 shrink-0 text-center text-[9px]"
              style={{ color: theme.textSecondary }}
            >
              ← 点击返回
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default PersonCard;
