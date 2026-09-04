"use client";

import { useState, type KeyboardEvent } from "react";
import { motion } from "framer-motion";
import { Crown, MessageCircle, UserPlus } from "lucide-react";
import type { GapSlot } from "@/lib/layout";
import { PRIORITY_LABEL } from "@/lib/schema";
import type { ThemeTokens } from "@/lib/themes/types";
import { CommentMarkdown, markdownVars } from "./markdown";
import { NO_ZOOM_ATTR } from "./Canvas";

interface GapCardProps {
  slot: GapSlot;
  theme: ThemeTokens;
  still?: boolean;
}

/**
 * An empty seat drawn as a person: same footprint as PersonCard, dashed frame,
 * silhouette where the avatar would be. A `lead` role gets the gold dashed
 * treatment plus a dashed crown, so a vacant lead seat is distinguishable from
 * a vacant member seat at a glance.
 */
export function GapCard({ slot, theme, still = false }: GapCardProps) {
  const { gap, role } = slot;
  const isLead = role === "lead";
  const priorityColor = theme.priority[gap.priority];
  const frame = isLead ? theme.accent : theme.gapBorder;
  const comment = gap.comment?.trim();
  const hasComment = Boolean(comment);

  const [flipped, setFlipped] = useState(false);
  const toggle = () => setFlipped((current) => !current);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    // Canvas arms pan on window-level space; don't let it through.
    event.stopPropagation();
    toggle();
  };

  const roleLabel = isLead ? `负责人 · ${gap.role}` : gap.role;

  return (
    <motion.div
      data-slot-id={slot.id}
      data-gap-role={role}
      data-flipped={flipped ? "true" : undefined}
      className="relative select-none overflow-hidden"
      style={{
        width: slot.width,
        height: slot.height,
        borderRadius: theme.card.borderRadius,
        background: theme.gapBackground,
        border: `2px dashed ${frame}`,
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
          : { y: -6, borderColor: priorityColor, boxShadow: `0 0 22px ${priorityColor}55` }
      }
      {...(hasComment
        ? {
            role: "button",
            tabIndex: 0,
            "aria-expanded": flipped,
            "aria-label": `${gap.role} 缺口的招聘要求`,
            onClick: toggle,
            onKeyDown,
          }
        : {})}
    >
      <div
        className="absolute inset-0"
        style={{
          transformStyle: "preserve-3d",
          transition: still ? undefined : "transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
          transform: `rotateY(${flipped ? 180 : 0}deg)`,
        }}
      >
        <div
          className="absolute inset-0 flex flex-col items-center px-3 pb-3 pt-6 text-center"
          style={{ backfaceVisibility: "hidden" }}
        >
          <span
            data-priority-dot
            className="absolute right-3 top-3 h-3.5 w-3.5 rounded-full"
            style={{ background: priorityColor, boxShadow: `0 0 10px ${priorityColor}` }}
            title={`优先级：${PRIORITY_LABEL[gap.priority]}`}
          />

          {gap.count > 1 && (
            <span
              data-gap-count
              className="absolute bottom-2.5 left-2.5 rounded px-1.5 py-0.5 text-[11px] font-black tabular-nums"
              style={{ color: priorityColor, border: `1px solid ${priorityColor}` }}
              title={`缺 ${gap.count} 人`}
            >
              ×{gap.count}
            </span>
          )}

          {hasComment && (
            <span
              className="absolute bottom-2 right-2 flex h-6 w-6 items-center justify-center rounded-full"
              style={{
                background: frame,
                color: theme.gapBackgroundFlat,
                boxShadow: `0 0 10px ${frame}88`,
              }}
              title="有招聘要求，点击查看"
            >
              <MessageCircle size={13} strokeWidth={2.5} />
            </span>
          )}

          {/* Silhouette stands in for the avatar, same diameter and position. */}
          <div
            data-gap-silhouette
            className="flex shrink-0 items-center justify-center rounded-full"
            style={{
              width: theme.card.avatarSize,
              height: theme.card.avatarSize,
              border: `2px dashed ${frame}`,
              background: theme.gapSilhouetteBackground,
            }}
          >
            <UserPlus
              size={Math.round(theme.card.avatarSize * 0.5)}
              strokeWidth={1.25}
              style={{ color: theme.gapText }}
            />
          </div>

          {isLead && (
            <span
              data-lead-gap-crown
              title="负责人空位"
              className="-mt-3 flex items-center justify-center rounded-full px-1.5 py-1"
              style={{ background: theme.gapBackgroundFlat, border: `1px dashed ${frame}` }}
            >
              <Crown
                size={14}
                strokeWidth={2}
                strokeDasharray="3 2"
                style={{ color: theme.accent }}
              />
            </span>
          )}

          <div
            className="mt-3 text-xs font-bold tracking-[0.2em]"
            style={{ color: theme.gapText, fontFamily: theme.headingFont }}
          >
            招募中
          </div>

          <div
            className="mt-1.5 px-1 text-base font-bold leading-tight"
            style={{ color: theme.textPrimary, fontFamily: theme.headingFont }}
          >
            {roleLabel}
          </div>

          {gap.note && (
            <div
              className="mt-2 line-clamp-3 px-1 text-[10px] leading-snug"
              style={{ color: theme.gapText }}
            >
              {gap.note}
            </div>
          )}

          <div
            className="mt-auto rounded px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
            style={{ color: priorityColor, border: `1px solid ${priorityColor}` }}
          >
            {PRIORITY_LABEL[gap.priority]}优先级
          </div>
        </div>

        {comment && (
          <div
            data-card-back
            className="absolute inset-0 flex flex-col px-3 pb-2 pt-2.5"
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
              // Opaque fill: the translucent gap wash would let the front face
              // show through the flip.
              background: theme.gapBackgroundFlat,
            }}
          >
            <div
              className="shrink-0 truncate border-b pb-1.5 text-center text-[11px] font-bold tracking-wide"
              style={{ color: frame, fontFamily: theme.headingFont, borderColor: `${frame}66` }}
            >
              {roleLabel}
            </div>

            <div
              {...{ [NO_ZOOM_ATTR]: true }}
              className="markdown-body atlas-scroll mt-2 max-h-[240px] flex-1 overflow-y-auto pr-1"
              style={markdownVars(theme)}
            >
              <CommentMarkdown source={comment} />
            </div>

            <div className="mt-1 shrink-0 text-center text-[9px]" style={{ color: theme.gapText }}>
              ← 点击返回
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default GapCard;
