"use client";

import { AlertCircle } from "lucide-react";
import type { ReactNode } from "react";
import type { DomainBox } from "@/lib/layout";
import type { ThemeTokens } from "@/lib/themes/types";

interface DomainCardProps {
  box: DomainBox;
  theme: ThemeTokens;
  children: ReactNode;
}

/**
 * Absolutely-positioned domain container. Coordinates come from computeLayout
 * so the web view and the drawio export stay in the same geometry.
 */
export function DomainCard({ box, theme, children }: DomainCardProps) {
  const label = box.domain.displayName ?? box.domain.name;
  const accent = box.color ?? theme.accent;

  return (
    <div
      className="absolute"
      style={{
        left: box.x,
        top: box.y,
        width: box.width,
        height: box.height,
        borderRadius: 10,
        // Boxes are siblings in the DOM, so nested ones must not paint over the
        // parent's cards.
        background: box.depth === 0 ? theme.domainBackground : "transparent",
        border: `1px solid ${box.color ?? theme.domainBorder}`,
        boxShadow: box.depth === 0 ? "0 10px 34px rgba(0,0,0,0.45)" : "none",
      }}
    >
      <div
        className="flex h-10 items-center justify-between rounded-t-[9px] px-3"
        style={{
          background: box.color ? `${box.color}` : theme.domainBanner,
          borderBottom: `1px solid ${accent}66`,
        }}
      >
        <div className="flex items-baseline gap-2 truncate">
          <span
            className="truncate font-bold"
            style={{
              color: theme.textPrimary,
              fontFamily: theme.headingFont,
              fontSize: box.depth === 0 ? 17 : 14,
            }}
          >
            {label}
          </span>
          {box.domain.description && (
            <span
              className="truncate text-[10px]"
              style={{ color: theme.textSecondary, fontFamily: theme.bodyFont }}
            >
              {box.domain.description}
            </span>
          )}
        </div>

        {box.gapCount > 0 && (
          <div
            className="flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
            style={{ background: theme.priority.critical, color: "#fff" }}
            title={`该领域及子领域共缺 ${box.gapCount} 人`}
          >
            <AlertCircle size={10} strokeWidth={3} />
            缺 {box.gapCount}
          </div>
        )}
      </div>

      {children}
    </div>
  );
}

export default DomainCard;
