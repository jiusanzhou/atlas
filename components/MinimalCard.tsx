"use client";

import { Crown, User } from "lucide-react";
import { resolveAvatarSync } from "@/lib/avatar";
import type { Slot } from "@/lib/layout";
import { PRIORITY_LABEL } from "@/lib/schema";
import type { ThemeTokens } from "@/lib/themes/types";

interface MinimalCardProps {
  slot: Slot;
  theme: ThemeTokens;
  /** Panel is open for this card: keep the hover highlight painted. */
  active?: boolean;
  still?: boolean;
}

/**
 * Avatar + one line of name, no frame. Everything else (title, tags, loans,
 * comment, gap detail) lives in PersonHoverPanel, which DomainTree opens.
 * Markers stay tiny on purpose so the grid keeps reading as a roster.
 */
export function MinimalCard({ slot, theme, active = false, still = false }: MinimalCardProps) {
  const isGap = slot.kind === "gap";
  const isLead = slot.role === "lead";
  const size = theme.card.avatarSize;
  const hasComment = Boolean(
    (isGap ? slot.gap.comment : slot.person.comment)?.trim(),
  );

  const label = isGap ? `招募中 · ${slot.gap.role}` : slot.person.name;

  return (
    <div
      data-slot-id={slot.id}
      data-minimal-card
      {...(isGap ? { "data-gap-role": slot.role } : {})}
      className="flex select-none flex-col items-center justify-start px-1 pt-2 transition-colors"
      style={{
        width: slot.width,
        height: slot.height,
        borderRadius: theme.card.borderRadius,
        background: active ? theme.cardHoverBackground : "transparent",
        fontFamily: theme.bodyFont,
        cursor: "pointer",
      }}
    >
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        {isGap ? (
          <div
            data-gap-silhouette
            className="flex h-full w-full items-center justify-center rounded-full"
            style={{
              background: theme.gapBackground,
              // Gold dashes mark an empty lead seat, grey a member one.
              border: `1px dashed ${isLead ? theme.leadMarker : theme.gapBorder}`,
            }}
          >
            <User size={size * 0.42} strokeWidth={1.5} style={{ color: theme.gapText }} />
          </div>
        ) : (
          <div
            className="h-full w-full overflow-hidden rounded-full"
            style={{ border: `1px solid ${theme.panelBorder}` }}
          >
            {/* Avatar hosts are arbitrary (github/gravatar/dicebear), so next/image
                would require an open remotePatterns allowlist. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={resolveAvatarSync(slot.person, { size: size * 2 })}
              alt={slot.person.name}
              width={size}
              height={size}
              className="h-full w-full object-cover"
              loading="eager"
            />
          </div>
        )}

        {isLead && (
          <span
            data-lead-marker
            {...(isGap ? { "data-lead-gap-crown": true } : {})}
            title={isGap ? "负责人空位" : "负责人"}
            className="absolute -bottom-0.5 left-1/2 flex -translate-x-1/2 items-center justify-center rounded-full"
            style={{
              width: 16,
              height: 16,
              background: theme.panelBackground,
              boxShadow: isGap
                ? `0 0 0 1px ${theme.leadMarker}`
                : `0 0 0 1px ${theme.panelBorder}`,
            }}
          >
            <Crown
              size={11}
              strokeWidth={2.5}
              strokeDasharray={isGap ? "3 2" : undefined}
              style={{ color: theme.leadMarker }}
            />
          </span>
        )}

        {isGap && (
          <span
            data-priority-dot
            title={`优先级：${PRIORITY_LABEL[slot.gap.priority]}`}
            className="absolute right-0 top-0 rounded-full"
            style={{
              width: 8,
              height: 8,
              background: theme.priority[slot.gap.priority],
              boxShadow: `0 0 0 1.5px ${theme.canvasBackground}`,
            }}
          />
        )}

        {hasComment && (
          <span
            data-comment-dot
            title={isGap ? "有招聘要求" : "有备注"}
            // Gaps already put the priority dot top-right, so theirs sits left.
            className={`absolute top-0 rounded-full ${isGap ? "left-0" : "right-0"}`}
            style={{
              width: 7,
              height: 7,
              background: theme.commentMarker,
              boxShadow: `0 0 0 1.5px ${theme.panelBackground}`,
            }}
          />
        )}
      </div>

      <div
        className="mt-1.5 w-full truncate text-center text-[13px] leading-tight"
        style={{
          color: isGap ? theme.gapText : theme.textPrimary,
          fontWeight: isLead ? 600 : 400,
        }}
        title={label}
      >
        {label}
      </div>

      {/* Static export needs the loan direction visible without a hover panel. */}
      {still && !isGap && slot.badges.length > 0 && (
        <div className="mt-0.5 w-full truncate text-center text-[9px]" style={{ color: theme.textSecondary }}>
          {slot.badges
            .map((badge) => `${badge.direction === "out" ? "→" : "←"} ${badge.domain}`)
            .join(" ")}
        </div>
      )}
    </div>
  );
}

export default MinimalCard;
