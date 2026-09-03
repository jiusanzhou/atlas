"use client";

import { AlertCircle } from "lucide-react";
import type { ReactNode } from "react";
import type { DomainNode } from "@/lib/layout";
import type { ThemeTokens } from "@/lib/themes/types";

interface DomainCardProps {
  node: DomainNode;
  theme: ThemeTokens;
  children: ReactNode;
}

/**
 * A single node of the top-down domain tree. Coordinates come from
 * computeDomainTreeLayout so the web view and the drawio export share geometry.
 */
export function DomainCard({ node, theme, children }: DomainCardProps) {
  if (theme.variant === "minimal") {
    return (
      <MinimalDomainCard node={node} theme={theme}>
        {children}
      </MinimalDomainCard>
    );
  }
  return (
    <FramedDomainCard node={node} theme={theme}>
      {children}
    </FramedDomainCard>
  );
}

/** No fill and no frame: just a labelled rule above the roster. */
function MinimalDomainCard({ node, theme, children }: DomainCardProps) {
  const label = node.domain.displayName ?? node.domain.name;
  const isRoot = node.depth === 0;

  return (
    <div
      data-domain-id={node.id}
      className="absolute"
      style={{ left: node.x, top: node.y, width: node.width, height: node.height }}
    >
      <div
        className="flex items-baseline gap-2 px-1"
        style={{
          height: node.headerHeight,
          borderBottom: `1px solid ${node.color ?? theme.domainBorder}`,
        }}
      >
        <span
          className="truncate"
          style={{
            color: theme.textPrimary,
            fontFamily: theme.headingFont,
            fontSize: isRoot ? 15 : 13,
            fontWeight: isRoot ? 700 : 600,
          }}
        >
          {label}
        </span>
        {node.gapCount > 0 && (
          <span
            className="shrink-0 text-[10px] font-semibold"
            style={{ color: theme.priority.critical }}
            title={`该领域及子领域共缺 ${node.gapCount} 人`}
          >
            缺 {node.gapCount}
          </span>
        )}
      </div>

      {children}
    </div>
  );
}

/** The root node gets a heavier treatment since it heads the whole diagram. */
function FramedDomainCard({ node, theme, children }: DomainCardProps) {
  const label = node.domain.displayName ?? node.domain.name;
  const accent = node.color ?? theme.accent;
  const isRoot = node.depth === 0;

  return (
    <div
      data-domain-id={node.id}
      className="absolute"
      style={{
        left: node.x,
        top: node.y,
        width: node.width,
        height: node.height,
        borderRadius: 10,
        background: theme.domainBackground,
        border: `${isRoot ? 2 : 1}px solid ${accent}`,
        boxShadow: isRoot ? "0 10px 34px rgba(0,0,0,0.45)" : "0 4px 14px rgba(0,0,0,0.3)",
      }}
    >
      <div
        className="flex items-center justify-between rounded-t-[9px] px-3"
        style={{
          height: node.headerHeight,
          background: node.color ?? theme.domainBanner,
          borderBottom: `1px solid ${accent}66`,
        }}
      >
        <div className="flex min-w-0 flex-col justify-center">
          <span
            className="truncate font-bold leading-tight"
            style={{
              color: theme.textPrimary,
              fontFamily: theme.headingFont,
              fontSize: isRoot ? 18 : 14,
            }}
          >
            {label}
          </span>
          {node.domain.description && (
            <span
              className="truncate text-[10px] leading-tight"
              style={{ color: theme.textSecondary, fontFamily: theme.bodyFont }}
            >
              {node.domain.description}
            </span>
          )}
        </div>

        {node.gapCount > 0 && (
          <div
            className="flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
            style={{ background: theme.priority.critical, color: "#fff" }}
            title={`该领域及子领域共缺 ${node.gapCount} 人`}
          >
            <AlertCircle size={10} strokeWidth={3} />
            缺 {node.gapCount}
          </div>
        )}
      </div>

      {children}
    </div>
  );
}

export default DomainCard;
