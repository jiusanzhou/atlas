"use client";

import { ArrowLeft, ArrowRight, Crown, Pin, UserPlus } from "lucide-react";
import { resolveAvatarSync } from "@/lib/avatar";
import type { GapSlot, PersonSlot, Slot } from "@/lib/layout";
import { PRIORITY_LABEL } from "@/lib/schema";
import type { ThemeTokens } from "@/lib/themes/types";
import { CommentMarkdown, markdownVars } from "./markdown";
import { NO_ZOOM_ATTR } from "./Canvas";

export const PANEL_WIDTH = 240;
export const PANEL_GAP = 10;
const PANEL_AVATAR = 80;

export type PanelSide = "right" | "left" | "bottom";

/**
 * Where the panel fits next to a card that is currently on screen at `scale`.
 * Falls back to `bottom` when neither side has room.
 */
export function pickPanelSide(cardRect: DOMRect, scale: number): PanelSide {
  const needed = (PANEL_WIDTH + PANEL_GAP) * scale;
  if (cardRect.right + needed <= window.innerWidth - 8) return "right";
  if (cardRect.left - needed >= 8) return "left";
  return "bottom";
}

/** Panel position in the same world coordinates the slot carries. */
function positionFor(side: PanelSide, slot: Slot) {
  if (side === "right") return { left: slot.x + slot.width + PANEL_GAP, top: slot.y };
  if (side === "left") return { left: slot.x - PANEL_WIDTH - PANEL_GAP, top: slot.y };
  return { left: slot.x, top: slot.y + slot.height + PANEL_GAP };
}

interface PersonHoverPanelProps {
  slot: Slot;
  theme: ThemeTokens;
  side: PanelSide;
  pinned: boolean;
  /** Keeps the panel open while the pointer is over it. */
  onPointerEnter: () => void;
  onPointerLeave: () => void;
}

/**
 * The full detail view for the minimal theme, which keeps almost everything off
 * the card itself. Lives inside the canvas' transformed layer in world
 * coordinates, so it pans and zooms with the card it belongs to.
 */
export function PersonHoverPanel({
  slot,
  theme,
  side,
  pinned,
  onPointerEnter,
  onPointerLeave,
}: PersonHoverPanelProps) {
  const position = positionFor(side, slot);

  return (
    <div
      data-person-panel={slot.id}
      data-panel-side={side}
      data-panel-pinned={pinned ? "true" : undefined}
      role="dialog"
      aria-label={slot.kind === "gap" ? `${slot.gap.role} 缺口详情` : `${slot.person.name} 详情`}
      {...(slot.kind === "gap" ? { "data-gap-role": slot.role } : {})}
      className="absolute cursor-default overflow-hidden rounded-xl"
      style={{
        left: position.left,
        top: position.top,
        width: PANEL_WIDTH,
        background: theme.panelBackground,
        border: `1px solid ${theme.panelBorder}`,
        boxShadow: theme.panelShadow,
        fontFamily: theme.bodyFont,
        pointerEvents: "auto",
      }}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      {pinned && (
        <div
          className="absolute right-2 top-2 flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-semibold"
          style={{ background: theme.tagBackground, color: theme.textSecondary }}
        >
          <Pin size={9} strokeWidth={2.5} />
          已钉住
        </div>
      )}

      {slot.kind === "gap" ? (
        <GapPanelBody slot={slot} theme={theme} />
      ) : (
        <PersonPanelBody slot={slot} theme={theme} />
      )}
    </div>
  );
}

function PersonPanelBody({ slot, theme }: { slot: PersonSlot; theme: ThemeTokens }) {
  const { person } = slot;
  const comment = person.comment?.trim();
  const tags = person.tags ?? [];
  const avatar = resolveAvatarSync(person, { size: PANEL_AVATAR * 2 });
  const isLead = slot.role === "lead";

  return (
    <div className="flex flex-col p-3.5">
      <div className="flex items-center gap-3">
        <div
          className="relative shrink-0 overflow-hidden rounded-full"
          style={{
            width: PANEL_AVATAR,
            height: PANEL_AVATAR,
            border: `2px solid ${theme.panelBorder}`,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={avatar}
            alt={person.name}
            width={PANEL_AVATAR}
            height={PANEL_AVATAR}
            className="h-full w-full object-cover"
            loading="eager"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div
            className="flex items-center gap-1 text-sm font-bold leading-tight"
            style={{ color: theme.textPrimary, fontFamily: theme.headingFont }}
          >
            <span className="min-w-0 break-words">{person.name}</span>
            {isLead && (
              <Crown
                size={12}
                strokeWidth={2.5}
                className="shrink-0"
                style={{ color: theme.leadMarker }}
                aria-label="负责人"
              />
            )}
          </div>
          {person.title && (
            <div className="mt-0.5 text-[11px] leading-tight" style={{ color: theme.textSecondary }}>
              {person.title}
            </div>
          )}
          <div className="mt-1 text-[9px] uppercase tracking-widest" style={{ color: theme.textSecondary }}>
            {theme.rarity[slot.rarity].label}
          </div>
        </div>
      </div>

      {tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{
                background: theme.tagBackground,
                color: theme.tagText,
                border: `1px solid ${theme.panelBorder}`,
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {slot.badges.length > 0 && (
        <div className="mt-3 flex flex-col gap-1">
          {slot.badges.map((badge) => {
            const out = badge.direction === "out";
            return (
              <div
                key={`${badge.direction}-${badge.domain}`}
                className="flex items-center gap-1.5 rounded px-1.5 py-1 text-[10px] leading-tight"
                style={{
                  background: out ? theme.loanOutBackground : theme.loanInBackground,
                  color: theme.loanBadgeText,
                }}
              >
                {out ? (
                  <ArrowRight size={10} strokeWidth={3} className="shrink-0" />
                ) : (
                  <ArrowLeft size={10} strokeWidth={3} className="shrink-0" />
                )}
                <span className="font-semibold">{out ? "借出" : "借入"}</span>
                <span className="min-w-0 flex-1 truncate">
                  {out ? badge.domain : `来自 ${badge.domain}`}
                  {badge.role ? ` · ${badge.role}` : ""}
                </span>
                <span className="shrink-0 font-bold tabular-nums">
                  {Math.round(badge.ratio * 100)}%
                </span>
              </div>
            );
          })}
        </div>
      )}

      {comment && (
        <div
          {...{ [NO_ZOOM_ATTR]: true }}
          className="markdown-body atlas-scroll mt-3 max-h-[200px] overflow-y-auto border-t pr-1 pt-2"
          style={{ ...markdownVars(theme), borderColor: theme.panelBorder }}
        >
          <CommentMarkdown source={comment} />
        </div>
      )}
    </div>
  );
}

function GapPanelBody({ slot, theme }: { slot: GapSlot; theme: ThemeTokens }) {
  const { gap } = slot;
  const color = theme.priority[gap.priority];
  const isLead = slot.role === "lead";
  const comment = gap.comment?.trim();

  return (
    <div className="flex flex-col p-3.5">
      <div className="flex items-center gap-2.5">
        <div
          className="relative flex shrink-0 items-center justify-center rounded-full"
          style={{
            width: 44,
            height: 44,
            background: theme.gapBackground,
            border: `1px dashed ${isLead ? theme.leadMarker : theme.gapBorder}`,
          }}
        >
          <UserPlus size={20} strokeWidth={1.75} style={{ color: theme.gapText }} />
          {isLead && (
            <span
              data-lead-gap-crown
              className="absolute -bottom-1 left-1/2 flex h-4 w-4 -translate-x-1/2 items-center justify-center rounded-full"
              style={{
                background: theme.panelBackground,
                boxShadow: `0 0 0 1px ${theme.leadMarker}`,
              }}
            >
              <Crown
                size={10}
                strokeWidth={2.5}
                strokeDasharray="3 2"
                style={{ color: theme.leadMarker }}
              />
            </span>
          )}
        </div>
        <div className="min-w-0">
          <div className="text-[10px] font-semibold tracking-widest" style={{ color: theme.gapText }}>
            {isLead ? "负责人空缺 · 招募中" : "招募中"}
          </div>
          <div
            className="text-sm font-bold leading-tight"
            style={{ color: theme.textPrimary, fontFamily: theme.headingFont }}
          >
            {gap.role}
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <span
          className="rounded px-2 py-0.5 text-[11px] font-bold tabular-nums"
          style={{ background: theme.tagBackground, color: theme.textPrimary }}
        >
          缺 {gap.count} 人
        </span>
        <span
          className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold"
          style={{ color, border: `1px solid ${color}` }}
        >
          <span className="h-2 w-2 rounded-full" style={{ background: color }} />
          {PRIORITY_LABEL[gap.priority]}优先级
        </span>
      </div>

      {gap.note && (
        <div
          className="mt-3 border-t pt-2 text-[11px] leading-snug"
          style={{ color: theme.textSecondary, borderColor: theme.panelBorder }}
        >
          {gap.note}
        </div>
      )}

      {comment && (
        <div
          {...{ [NO_ZOOM_ATTR]: true }}
          className="markdown-body atlas-scroll mt-3 max-h-[220px] overflow-y-auto border-t pr-1 pt-2"
          style={{ ...markdownVars(theme), borderColor: theme.panelBorder }}
        >
          <CommentMarkdown source={comment} />
        </div>
      )}
    </div>
  );
}

export default PersonHoverPanel;
